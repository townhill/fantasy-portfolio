import { describe, expect, it } from 'vitest'
import { planBedAndIsa } from '../server/services/bed-isa/planner'
import { basicProfile, rules } from './fixtures'

describe('Bed & ISA planner', () => {
  it('models the GIA disposal and separate ISA acquisition value', () => {
    const result = planBedAndIsa({
      date: '2026-08-28', price: '100', giaUnits: '1000', giaOriginalCost: '80000', giaEriAdjustment: '1000',
      isaValue: '25000', profile: basicProfile, rules
    })
    expect(result.suggestedAmount).toBe('20000.00')
    expect(result.unitsToSell).toBe('200.000000000000')
    expect(result.estimatedGain).toBe('3800.00')
    expect(result.estimatedCgt).toBe('144.00')
    expect(result.isaValueAfter).toBe('45000.00')
    expect(result.giaValueAfter).toBe('80000.00')
  })

  it('reduces the transfer when ISA allowance was used elsewhere', () => {
    const result = planBedAndIsa({
      date: '2026-08-28', price: '100', giaUnits: '1000', giaOriginalCost: '80000', giaEriAdjustment: '0',
      isaValue: '20000', requestedAmount: '20000', profile: { ...basicProfile, isaAllowanceUsed: '7500' }, rules
    })
    expect(result.availableIsaAllowance).toBe('12500.00')
    expect(result.suggestedAmount).toBe('12500.00')
  })

  it('also subtracts ISA subscriptions already made by this portfolio in the tax year', () => {
    const result = planBedAndIsa({
      date: '2026-08-28', price: '100', giaUnits: '1000', giaOriginalCost: '80000', giaEriAdjustment: '0',
      isaValue: '20000', portfolioIsaAllowanceUsed: '20000', profile: basicProfile, rules
    })
    expect(result.availableIsaAllowance).toBe('0.00')
    expect(result.suggestedAmount).toBe('0.00')
  })

  it('charges the extra CGT on top of gains already realised in the tax year', () => {
    const result = planBedAndIsa({
      date: '2026-08-28', price: '100', giaUnits: '1000', giaOriginalCost: '80000', giaEriAdjustment: '1000',
      isaValue: '25000', realisedGainsThisYear: '10000', profile: { ...basicProfile, employmentIncome: '40000.00' }, rules
    })
    expect(result.estimatedGain).toBe('3800.00')
    expect(result.cgtAnnualExemptionRemaining).toBe('0.00')
    expect(result.estimatedCgt).toBe('715.80')
  })
})
