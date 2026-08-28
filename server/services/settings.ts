import { desc, eq } from 'drizzle-orm'
import type { TaxProfileInput, TaxRules } from '../../shared/types/domain'
import { getDatabase } from '../database/client'
import { appSetting, portfolio, taxProfile, taxYear } from '../database/schema'
import { TAX_RULES_2026_27, taxYearDates } from './tax/rules'

export const DEFAULT_SETTINGS = {
  symbol: 'VUAG.L',
  isin: 'IE00BFMXXD54',
  currency: 'GBP',
  default_start_date: '2026-08-28',
  initial_investment: '100000.00',
  initial_isa_amount: '20000.00',
  initial_gia_amount: '80000.00',
  bed_isa_enabled: 'true',
  manual_price_enabled: 'false',
  manual_price_override: '',
  refresh_interval_minutes: '15'
} as const

export const DEFAULT_TAX_PROFILE: TaxProfileInput = {
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

export async function ensureApplicationDefaults() {
  const db = getDatabase()
  const now = new Date().toISOString()
  db.transaction(tx => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      tx.insert(appSetting).values({ key, value, updatedAt: now }).onConflictDoNothing().run()
    }
    const dates = taxYearDates(TAX_RULES_2026_27.taxYear)
    tx.insert(taxYear).values({
      label: TAX_RULES_2026_27.taxYear,
      ...dates,
      isaAllowance: TAX_RULES_2026_27.isaAllowance,
      cgtAnnualExemption: TAX_RULES_2026_27.cgtAnnualExemption,
      cgtBasicRate: TAX_RULES_2026_27.cgtBasicRate,
      cgtHigherRate: TAX_RULES_2026_27.cgtHigherRate,
      dividendAllowance: TAX_RULES_2026_27.dividendAllowance,
      dividendBasicRate: TAX_RULES_2026_27.dividendBasicRate,
      dividendHigherRate: TAX_RULES_2026_27.dividendHigherRate,
      dividendAdditionalRate: TAX_RULES_2026_27.dividendAdditionalRate,
      personalAllowance: TAX_RULES_2026_27.personalAllowance,
      basicRateBand: TAX_RULES_2026_27.basicRateBand,
      additionalRateThreshold: TAX_RULES_2026_27.additionalRateThreshold,
      confirmed: TAX_RULES_2026_27.confirmed,
      sourceNote: TAX_RULES_2026_27.sourceNote,
      updatedAt: now
    }).onConflictDoNothing().run()
    tx.insert(taxProfile).values({
      taxYear: DEFAULT_TAX_PROFILE.taxYear,
      employmentIncome: DEFAULT_TAX_PROFILE.employmentIncome,
      otherTaxableIncome: DEFAULT_TAX_PROFILE.otherTaxableIncome,
      otherDividendIncome: DEFAULT_TAX_PROFILE.otherDividendIncome,
      otherCapitalGains: DEFAULT_TAX_PROFILE.otherCapitalGains,
      capitalLosses: DEFAULT_TAX_PROFILE.capitalLosses,
      pensionContributions: DEFAULT_TAX_PROFILE.pensionContributions,
      personalAllowanceOverride: DEFAULT_TAX_PROFILE.personalAllowanceOverride,
      isaAllowanceUsed: DEFAULT_TAX_PROFILE.isaAllowanceUsed,
      mode: DEFAULT_TAX_PROFILE.mode,
      updatedAt: now
    }).onConflictDoNothing().run()
    const existing = tx.select({ id: portfolio.id }).from(portfolio).limit(1).all()
    if (!existing.length) {
      tx.insert(portfolio).values({
        name: 'VUAG Fantasy Portfolio',
        symbol: DEFAULT_SETTINGS.symbol,
        isin: DEFAULT_SETTINGS.isin,
        currency: DEFAULT_SETTINGS.currency,
        initialInvestment: DEFAULT_SETTINGS.initial_investment,
        startDate: DEFAULT_SETTINGS.default_start_date,
        status: 'PENDING',
        createdAt: now
      }).run()
    }
  })
}

export async function readSettings() {
  await ensureApplicationDefaults()
  const db = getDatabase()
  const [settings, profileRows, ruleRows, portfolioRows] = await Promise.all([
    db.select().from(appSetting),
    db.select().from(taxProfile),
    db.select().from(taxYear),
    db.select().from(portfolio).limit(1)
  ])
  return {
    settings: Object.fromEntries(settings.map(item => [item.key, item.value])),
    taxProfiles: profileRows.map(row => ({
      taxYear: row.taxYear,
      employmentIncome: row.employmentIncome,
      otherTaxableIncome: row.otherTaxableIncome,
      otherDividendIncome: row.otherDividendIncome,
      otherCapitalGains: row.otherCapitalGains,
      capitalLosses: row.capitalLosses,
      pensionContributions: row.pensionContributions,
      personalAllowanceOverride: row.personalAllowanceOverride,
      isaAllowanceUsed: row.isaAllowanceUsed,
      mode: row.mode
    } satisfies TaxProfileInput)),
    taxRules: ruleRows.map(toTaxRules),
    portfolio: portfolioRows[0] ?? null
  }
}

export async function getTaxContext(label: string) {
  await ensureApplicationDefaults()
  const db = getDatabase()
  const [rule] = await db.select().from(taxYear).where(eq(taxYear.label, label)).limit(1)
  const [profile] = await db.select().from(taxProfile).where(eq(taxProfile.taxYear, label)).limit(1)
  const fallbackRule = rule ?? (await db.select().from(taxYear).orderBy(desc(taxYear.startsOn)).limit(1))[0]
  if (!fallbackRule) throw new Error('No tax rules are configured')
  const resultRules = toTaxRules(fallbackRule)
  if (!rule) {
    resultRules.taxYear = label
    resultRules.confirmed = false
    resultRules.sourceNote = `Projection using ${fallbackRule.label} tax assumptions; ${label} is not configured.`
  }
  return {
    rules: resultRules,
    profile: profile ? ({
      taxYear: label,
      employmentIncome: profile.employmentIncome,
      otherTaxableIncome: profile.otherTaxableIncome,
      otherDividendIncome: profile.otherDividendIncome,
      otherCapitalGains: profile.otherCapitalGains,
      capitalLosses: profile.capitalLosses,
      pensionContributions: profile.pensionContributions,
      personalAllowanceOverride: profile.personalAllowanceOverride,
      isaAllowanceUsed: profile.isaAllowanceUsed,
      mode: profile.mode
    } satisfies TaxProfileInput) : { ...DEFAULT_TAX_PROFILE, taxYear: label }
  }
}

function toTaxRules(row: typeof taxYear.$inferSelect): TaxRules {
  return {
    taxYear: row.label,
    isaAllowance: row.isaAllowance,
    cgtAnnualExemption: row.cgtAnnualExemption,
    cgtBasicRate: row.cgtBasicRate,
    cgtHigherRate: row.cgtHigherRate,
    dividendAllowance: row.dividendAllowance,
    dividendBasicRate: row.dividendBasicRate,
    dividendHigherRate: row.dividendHigherRate,
    dividendAdditionalRate: row.dividendAdditionalRate,
    personalAllowance: row.personalAllowance,
    basicRateBand: row.basicRateBand,
    additionalRateThreshold: row.additionalRateThreshold,
    confirmed: row.confirmed,
    sourceNote: row.sourceNote
  }
}
