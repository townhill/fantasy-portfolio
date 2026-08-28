import { describe, expect, it } from 'vitest'
import { projectPortfolio } from '../server/services/projection/projector'
import { basicProfile, rules } from './fixtures'

describe('portfolio projection', () => {
  it('keeps actual starting data separate from forecast years', () => {
    const result = projectPortfolio({ years: 5, annualReturnPercent: '0', startingIsaValue: '20000', startingGiaValue: '80000', startingGiaBaseCost: '80000', rules, profile: basicProfile, startYear: 2026 })
    expect(result).toHaveLength(6)
    expect(result[0]?.historical).toBe(true)
    expect(result.slice(1).every(point => !point.historical)).toBe(true)
    expect(result[1]?.isaValue).toBe('40000.00')
    expect(result.at(-1)?.giaValue).toBe('0.00')
    expect(result.at(-1)?.amountSheltered).toBe('80000.00')
  })
})
