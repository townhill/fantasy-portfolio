import { and, desc, eq, gte, lte } from 'drizzle-orm'
import type { MarketQuote, PricePoint } from '../../../shared/types/domain'
import { appSetting, marketPrice } from '../../database/schema'
import { getDatabase } from '../../database/client'
import { DemoMarketDataProvider } from './demo'
import type { MarketDataProvider } from './provider'
import { YahooFinanceProvider } from './yahoo'
import { isFreshQuote, staleFallback } from './cache'

export class MarketDataService {
  private readonly provider: MarketDataProvider
  private readonly ttlMs: number

  constructor(provider?: MarketDataProvider, ttlMs?: number) {
    const config = useRuntimeConfig()
    const demoMode = process.env.DEMO_MODE
      ? process.env.DEMO_MODE === 'true'
      : Boolean(config.demoMode)
    const configuredTtl = process.env.MARKET_CACHE_TTL_MS || String(config.marketCacheTtlMs)
    this.provider = provider ?? (demoMode ? new DemoMarketDataProvider() : new YahooFinanceProvider())
    this.ttlMs = ttlMs ?? Number(configuredTtl)
  }

  async getQuote(symbol: string, force = false): Promise<MarketQuote> {
    const db = getDatabase()
    const settings = await db.select().from(appSetting)
    const settingMap = new Map(settings.map(item => [item.key, item.value]))
    if (settingMap.get('manual_price_enabled') === 'true' && settingMap.get('manual_price_override')) {
      const last = await this.latestCached(symbol)
      const now = new Date().toISOString()
      const price = settingMap.get('manual_price_override')!
      return {
        symbol,
        price,
        previousClose: last?.previousClose ?? last?.price ?? null,
        change: null,
        changePercent: null,
        marketTimestamp: now,
        fiftyTwoWeekHigh: last?.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: last?.fiftyTwoWeekLow ?? null,
        source: 'Manual price override',
        lastSuccessfulRefresh: now,
        stale: false,
        manual: true
      }
    }

    const cached = await this.latestCached(symbol)
    if (!force && cached && isFreshQuote(cached, this.ttlMs)) {
      return cached
    }

    try {
      const quote = await this.provider.getQuote(symbol)
      await db.insert(marketPrice).values({
        symbol: quote.symbol,
        marketTimestamp: quote.marketTimestamp,
        price: quote.price,
        previousClose: quote.previousClose,
        change: quote.change,
        changePercent: quote.changePercent,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        source: quote.source,
        retrievedAt: quote.lastSuccessfulRefresh
      }).onConflictDoNothing()
      return quote
    } catch (error) {
      return staleFallback(cached, error)
    }
  }

  async getHistory(symbol: string, from: Date, to: Date): Promise<PricePoint[]> {
    try {
      return await this.provider.getHistory(symbol, from, to)
    } catch (error) {
      const db = getDatabase()
      const cached = await db.select().from(marketPrice).where(and(
        eq(marketPrice.symbol, symbol),
        gte(marketPrice.marketTimestamp, from.toISOString()),
        lte(marketPrice.marketTimestamp, to.toISOString())
      )).orderBy(marketPrice.marketTimestamp)
      if (cached.length) {
        return cached.map(row => ({ date: row.marketTimestamp.slice(0, 10), price: row.price, source: `${row.source} cache` }))
      }
      throw new Error(`Historical market data unavailable: ${error instanceof Error ? error.message : 'unknown provider error'}`)
    }
  }

  async priceForDate(symbol: string, date: string) {
    const selected = new Date(`${date}T12:00:00Z`)
    const today = new Date().toISOString().slice(0, 10)
    if (date === today) {
      const quote = await this.getQuote(symbol)
      return { price: quote.price, date, source: quote.source, currentQuote: true }
    }
    const from = new Date(selected)
    from.setUTCDate(from.getUTCDate() - 7)
    const history = await this.getHistory(symbol, from, selected).catch(() => [])
    const exact = history.find(point => point.date === date)
    if (exact) return { price: exact.price, date: exact.date, source: exact.source, currentQuote: false }

    const previousClose = history.filter(point => point.date < date).at(-1)
    if (previousClose) {
      return { price: previousClose.price, date: previousClose.date, source: previousClose.source, currentQuote: false }
    }
    throw new Error(`No VUAG closing price is available for ${date}. Use the manual price override only if you have verified the price.`)
  }

  private async latestCached(symbol: string): Promise<MarketQuote | null> {
    const db = getDatabase()
    const row = (await db.select().from(marketPrice)
      .where(eq(marketPrice.symbol, symbol))
      .orderBy(desc(marketPrice.retrievedAt)).limit(1))[0]
    if (!row) return null
    return {
      symbol: row.symbol,
      price: row.price,
      previousClose: row.previousClose,
      change: row.change,
      changePercent: row.changePercent,
      marketTimestamp: row.marketTimestamp,
      fiftyTwoWeekHigh: row.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: row.fiftyTwoWeekLow,
      source: row.source,
      lastSuccessfulRefresh: row.retrievedAt,
      stale: false,
      manual: false
    }
  }
}
