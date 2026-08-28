import type { TaxProfileInput, TaxRules } from '../shared/types/domain'

export const rules: TaxRules = {
  taxYear: '2026/27',
  isaAllowance: '20000.00',
  cgtAnnualExemption: '3000.00',
  cgtBasicRate: '0.18',
  cgtHigherRate: '0.24',
  dividendAllowance: '500.00',
  dividendBasicRate: '0.1075',
  dividendHigherRate: '0.3575',
  dividendAdditionalRate: '0.3935',
  personalAllowance: '12570.00',
  basicRateBand: '37700.00',
  additionalRateThreshold: '125140.00',
  confirmed: true,
  sourceNote: 'Test fixture'
}

export const basicProfile: TaxProfileInput = {
  taxYear: '2026/27',
  employmentIncome: '0.00',
  otherTaxableIncome: '0.00',
  otherDividendIncome: '0.00',
  otherCapitalGains: '0.00',
  capitalLosses: '0.00',
  pensionContributions: '0.00',
  personalAllowanceOverride: null,
  isaAllowanceUsed: '0.00',
  mode: 'simple'
}
