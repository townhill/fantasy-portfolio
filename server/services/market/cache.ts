import type { MarketQuote } from '../../../shared/types/domain'

export function isFreshQuote(quote: MarketQuote, ttlMs: number, now = Date.now()) {
  return now - new Date(quote.lastSuccessfulRefresh).getTime() < ttlMs
}

export function staleFallback(quote: MarketQuote | null, providerError: unknown): MarketQuote {
  if (quote) return { ...quote, stale: true }
  throw new Error(`Market data unavailable and no successful cached VUAG price exists: ${providerError instanceof Error ? providerError.message : 'unknown provider error'}`)
}
