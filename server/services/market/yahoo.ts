import YahooFinance from 'yahoo-finance2'
import type { MarketQuote, PricePoint } from '../../../shared/types/domain'
import { precise } from '../../utils/decimal'
import type { MarketDataProvider } from './provider'

export class YahooFinanceProvider implements MarketDataProvider {
  readonly name = 'Yahoo Finance'
  private readonly client = new YahooFinance()

  async getQuote(symbol: string): Promise<MarketQuote> {
    const quote = await this.client.quote(symbol)
    if (typeof quote.regularMarketPrice !== 'number') {
      throw new Error(`Yahoo Finance returned no market price for ${symbol}`)
    }
    const timestamp = quote.regularMarketTime instanceof Date
      ? quote.regularMarketTime
      : new Date()
    const refreshed = new Date().toISOString()
    return {
      symbol,
      price: precise(quote.regularMarketPrice, 6),
      previousClose: typeof quote.regularMarketPreviousClose === 'number' ? precise(quote.regularMarketPreviousClose, 6) : null,
      change: typeof quote.regularMarketChange === 'number' ? precise(quote.regularMarketChange, 6) : null,
      changePercent: typeof quote.regularMarketChangePercent === 'number' ? precise(quote.regularMarketChangePercent, 6) : null,
      marketTimestamp: timestamp.toISOString(),
      fiftyTwoWeekHigh: typeof quote.fiftyTwoWeekHigh === 'number' ? precise(quote.fiftyTwoWeekHigh, 6) : null,
      fiftyTwoWeekLow: typeof quote.fiftyTwoWeekLow === 'number' ? precise(quote.fiftyTwoWeekLow, 6) : null,
      source: this.name,
      lastSuccessfulRefresh: refreshed,
      stale: false,
      manual: false
    }
  }

  async getHistory(symbol: string, from: Date, to: Date): Promise<PricePoint[]> {
    const exclusiveEnd = new Date(to)
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
    const result = await this.client.chart(symbol, {
      period1: from,
      period2: exclusiveEnd,
      interval: '1d',
      events: 'history'
    })
    return result.quotes
      .filter(point => typeof point.close === 'number')
      .map(point => ({
        date: point.date.toISOString().slice(0, 10),
        price: precise(point.close!, 6),
        source: this.name
      }))
  }
}
