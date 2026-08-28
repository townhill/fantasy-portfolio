import type { MarketQuote, PricePoint } from '../../../shared/types/domain'

export interface MarketDataProvider {
  readonly name: string
  getQuote(symbol: string): Promise<MarketQuote>
  getHistory(symbol: string, from: Date, to: Date): Promise<PricePoint[]>
}
