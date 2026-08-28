import { describe, expect, it } from 'vitest'
import { matchShareDisposal } from '../server/services/accounting/share-pool'

describe('UK share identification and Section 104 pool', () => {
  it('matches same-day, following 30-day, then pooled shares in order', () => {
    const result = matchShareDisposal({
      disposalDate: '2026-08-10', disposedUnits: '50', proceeds: '1000', poolUnits: '100', poolCost: '1000',
      acquisitions: [
        { id: 'same', date: '2026-08-10', units: '10', cost: '150' },
        { id: 'bnb', date: '2026-08-25', units: '5', cost: '100' },
        { id: 'late', date: '2026-09-20', units: '10', cost: '100' }
      ]
    })
    expect(result.matches.map(item => item.rule)).toEqual(['SAME_DAY', 'BED_AND_BREAKFAST', 'SECTION_104'])
    expect(result.allowableCost).toBe('600.00')
    expect(result.realisedGain).toBe('400.00')
    expect(result.remainingPoolUnits).toBe('65.000000000000')
    expect(result.remainingPoolCost).toBe('650.00')
  })

  it('allocates Section 104 cost proportionally on a partial disposal', () => {
    const result = matchShareDisposal({ disposalDate: '2026-09-01', disposedUnits: '200', proceeds: '24000', poolUnits: '1000', poolCost: '80000' })
    expect(result.allowableCost).toBe('16000.00')
    expect(result.realisedGain).toBe('8000.00')
    expect(result.remainingPoolCost).toBe('64000.00')
  })
})
