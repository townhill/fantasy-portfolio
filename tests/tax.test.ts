import { describe, expect, it } from 'vitest'
import { calculateCgt } from '../server/services/tax/cgt'
import { calculateReportableIncomeTax } from '../server/services/tax/income'
import { adjustedCgtBaseCost, calculateEri } from '../server/services/tax/eri'
import { rulesForTaxYear, taxYearForDate } from '../server/services/tax/rules'
import { basicProfile, rules } from './fixtures'

describe('CGT engine', () => {
  it('uses the annual exemption before charging CGT', () => {
    const result = calculateCgt({ realisedGain: '2800', profile: basicProfile, rules })
    expect(result.annualExemptionUsed).toBe('2800.00')
    expect(result.taxableGain).toBe('0.00')
    expect(result.estimatedCgt).toBe('0.00')
  })

  it('applies 18% within and 24% above the remaining basic-rate band', () => {
    const result = calculateCgt({
      realisedGain: '20000',
      profile: { ...basicProfile, employmentIncome: '40000.00' },
      rules
    })
    expect(result.taxableGain).toBe('17000.00')
    expect(result.basicRateGain).toBe('10270.00')
    expect(result.higherRateGain).toBe('6730.00')
    expect(result.estimatedCgt).toBe('3463.80')
  })

  it('accounts for other gains and capital losses deterministically', () => {
    const result = calculateCgt({
      realisedGain: '5000',
      profile: { ...basicProfile, otherCapitalGains: '2000', capitalLosses: '1000' },
      rules
    })
    expect(result.netGainBeforeExemption).toBe('6000.00')
    expect(result.taxableGain).toBe('3000.00')
  })
})

describe('reportable income and ERI', () => {
  it('calculates ERI from applicable GIA units and adds it to CGT base cost', () => {
    const result = calculateEri('0.25', '100')
    expect(result.totalReportableIncome).toBe('25.00')
    expect(result.allowableBaseCostAdjustment).toBe('25.00')
    expect(adjustedCgtBaseCost('80000', result.allowableBaseCostAdjustment)).toBe('80025.00')
  })

  it('uses the remaining dividend allowance and marginal dividend bands', () => {
    const result = calculateReportableIncomeTax('1500', { ...basicProfile, employmentIncome: '50000.00' }, rules)
    expect(result.dividendAllowanceUsed).toBe('500.00')
    expect(result.taxableReportableIncome).toBe('1000.00')
    expect(result.estimatedIncomeTax).toBe('290.00')
  })

  it('does not silently create reportable income when ERI data is absent', () => {
    const result = calculateReportableIncomeTax('0', basicProfile, rules)
    expect(result.reportableIncome).toBe('0.00')
    expect(result.estimatedIncomeTax).toBe('0.00')
  })
})

describe('tax years', () => {
  it('handles the 6 April UK tax-year boundary', () => {
    expect(taxYearForDate('2027-04-05')).toBe('2026/27')
    expect(taxYearForDate('2027-04-06')).toBe('2027/28')
  })

  it('labels future unconfigured rules as assumptions', () => {
    const future = rulesForTaxYear('2030/31')
    expect(future.confirmed).toBe(false)
    expect(future.sourceNote).toContain('Projection using')
  })
})
