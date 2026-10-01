import { describe, expect, it } from 'vitest'
import { planWithdrawal } from '../server/services/withdrawal/planner'
import { basicProfile, rules } from './fixtures'

const base = { date: '2026-10-01', cashBalance: '0', realisedGainsThisYear: '0', profile: basicProfile, rules }

describe('withdrawal planner', () => {
  it('sells ISA units tax-free and allocates cost proportionally', () => {
    const result = planWithdrawal({ ...base, account: 'ISA', amount: '5000', price: '100', units: '250', originalCost: '20000', eriAdjustment: '0', cashBalance: '1000' })
    expect(result.unitsToSell).toBe('50.000000000000')
    expect(result.allocatedCost).toBe('4000.00')
    expect(result.gain).toBe('1000.00')
    expect(result.estimatedCgt).toBe('0.00')
    expect(result.cgtAnnualExemptionRemaining).toBeNull()
    expect(result.accountValueAfter).toBe('20000.00')
    expect(result.cashBalanceAfter).toBe('6000.00')
  })

  it('crystallises a GIA gain including the ERI base-cost adjustment', () => {
    const result = planWithdrawal({ ...base, account: 'GIA', amount: '20000', price: '100', units: '1000', originalCost: '80000', eriAdjustment: '1000' })
    expect(result.originalCostSold).toBe('16000.00')
    expect(result.eriAdjustmentSold).toBe('200.00')
    expect(result.gain).toBe('3800.00')
    expect(result.estimatedCgt).toBe('144.00')
    expect(result.cgtAnnualExemptionRemaining).toBe('0.00')
  })

  it('charges only the extra CGT when earlier gains already used the exemption and basic band', () => {
    const result = planWithdrawal({
      ...base, account: 'GIA', amount: '20000', price: '100', units: '1000', originalCost: '50000', eriAdjustment: '0',
      realisedGainsThisYear: '10000', profile: { ...basicProfile, employmentIncome: '40000.00' }
    })
    expect(result.gain).toBe('10000.00')
    expect(result.estimatedCgt).toBe('2203.80')
  })

  it('clears the whole holding when the full value is withdrawn', () => {
    const result = planWithdrawal({ ...base, account: 'ISA', amount: '20000.00', price: '60', units: '333.333333333333', originalCost: '20000', eriAdjustment: '0' })
    expect(result.sellsEntireHolding).toBe(true)
    expect(result.unitsToSell).toBe('333.333333333333')
    expect(result.originalCostSold).toBe('20000.00')
    expect(result.accountValueAfter).toBe('0.00')
  })

  it('rejects amounts above the account value or at zero', () => {
    const input = { ...base, account: 'ISA' as const, price: '100', units: '250', originalCost: '20000', eriAdjustment: '0' }
    expect(() => planWithdrawal({ ...input, amount: '25000.01' })).toThrow('£25,000.00')
    expect(() => planWithdrawal({ ...input, amount: '0' })).toThrow('greater than £0')
  })
})
