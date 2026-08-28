import { describe, expect, it } from 'vitest'
import { createInitialAllocations, calculateValuation, valueAccount } from '../server/services/accounting/portfolio'

describe('portfolio accounting', () => {
  it('creates a fixed £20,000 ISA and £80,000 GIA opening purchase', () => {
    const allocations = createInitialAllocations('80.00')
    expect(allocations).toEqual([
      { account: 'ISA', amount: '20000.00', units: '250.000000000000', price: '80.000000' },
      { account: 'GIA', amount: '80000.00', units: '1000.000000000000', price: '80.000000' }
    ])
    expect(allocations.reduce((sum, item) => sum + Number(item.amount), 0)).toBe(100000)
  })

  it('values fixed units without recalculating them when price changes', () => {
    const result = calculateValuation('1250', '100', '100000')
    expect(result).toEqual({ value: '125000.00', gain: '25000.00', gainPercent: '25.0000' })
  })

  it('keeps ISA ERI and portfolio tax base adjustments at zero', () => {
    const isa = valueAccount({ id: 1, type: 'ISA', units: '250', originalCost: '20000', eriAdjustment: '999', price: '100', totalPortfolioValue: '125000' })
    expect(isa.eriAdjustment).toBe('0.00')
    expect(isa.adjustedBaseCost).toBe('20000.00')
    expect(isa.gainLoss).toBe('5000.00')
  })
})
