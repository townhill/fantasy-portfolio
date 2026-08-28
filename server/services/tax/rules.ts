import type { TaxRules } from '../../../shared/types/domain'

export const TAX_RULES_2026_27: TaxRules = {
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
  sourceNote: 'Initial 2026/27 assumptions supplied with this fantasy portfolio. Verify against current HMRC guidance.'
}

export function taxYearForDate(value: Date | string) {
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T12:00:00Z`) : value
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const start = month > 3 || (month === 3 && day >= 6) ? year : year - 1
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
}

export function taxYearDates(label: string) {
  const startYear = Number(label.split('/')[0])
  return {
    startsOn: `${startYear}-04-06`,
    endsOn: `${startYear + 1}-04-05`
  }
}

export function rulesForTaxYear(label: string, configured?: TaxRules | null): TaxRules {
  if (configured) return configured
  if (label === TAX_RULES_2026_27.taxYear) return TAX_RULES_2026_27
  return {
    ...TAX_RULES_2026_27,
    taxYear: label,
    confirmed: false,
    sourceNote: `Projection using ${TAX_RULES_2026_27.taxYear} tax assumptions; rules for ${label} are not configured as confirmed.`
  }
}
