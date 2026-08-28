import { describe, expect, it } from 'vitest'
import type { MarketQuote } from '../shared/types/domain'
import { isFreshQuote, staleFallback } from '../server/services/market/cache'

const cached: MarketQuote = {
  symbol: 'VUAG.L', price: '100.00', previousClose: '99.00', change: '1.00', changePercent: '1.01',
  marketTimestamp: '2026-08-28T15:30:00.000Z', fiftyTwoWeekHigh: '105', fiftyTwoWeekLow: '75', source: 'Yahoo Finance',
  lastSuccessfulRefresh: '2026-08-28T15:31:00.000Z', stale: false, manual: false
}

describe('market data cache safety', () => {
  it('marks the most recent successful cache stale when the provider fails', () => {
    expect(staleFallback(cached, new Error('offline'))).toMatchObject({ price: '100.00', stale: true, lastSuccessfulRefresh: cached.lastSuccessfulRefresh })
  })

  it('throws rather than inventing a price when provider and cache are unavailable', () => {
    expect(() => staleFallback(null, new Error('offline'))).toThrow('no successful cached VUAG price')
  })

  it('uses a conservative TTL', () => {
    expect(isFreshQuote(cached, 15 * 60_000, new Date('2026-08-28T15:40:00.000Z').getTime())).toBe(true)
    expect(isFreshQuote(cached, 15 * 60_000, new Date('2026-08-28T16:00:00.000Z').getTime())).toBe(false)
  })
})
