import type { MarketQuote, PricePoint } from '../../../shared/types/domain'
import { D, precise } from '../../utils/decimal'
import type { MarketDataProvider } from './provider'

export class DemoMarketDataProvider implements MarketDataProvider {
  readonly name = 'Demo fixture'

  async getQuote(symbol: string): Promise<MarketQuote> {
    const now = new Date().toISOString()
    return {
      symbol,
      price: '109.840000',
      previousClose: '109.080000',
      change: '0.760000',
      changePercent: '0.696736',
      marketTimestamp: now,
      fiftyTwoWeekHigh: '112.340000',
      fiftyTwoWeekLow: '78.120000',
      source: this.name,
      lastSuccessfulRefresh: now,
      stale: false,
      manual: false
    }
  }

  async getHistory(symbol: string, from: Date, to: Date): Promise<PricePoint[]> {
    const points: PricePoint[] = []
    const cursor = new Date(from)
    let index = 0
    while (cursor <= to) {
      const day = cursor.getUTCDay()
      if (day !== 0 && day !== 6) {
        const trend = D(82).plus(D(index).mul('0.085'))
        const wave = D(Math.sin(index / 12)).mul('2.4')
        points.push({
          date: cursor.toISOString().slice(0, 10),
          price: precise(trend.plus(wave), 6),
          source: this.name
        })
        index += 1
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return points
  }
}
