import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { z } from 'zod'
import { getDatabase } from '../database/client'
import { appSetting, portfolio, taxProfile, taxYear } from '../database/schema'
import { settleCashInterest } from '../services/portfolio'
import { ensureApplicationDefaults } from '../services/settings'
import { taxYearDates } from '../services/tax/rules'
import { apiError, parseWithZod } from '../utils/http'

const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/)
const rateString = z.string().regex(/^0(\.\d+)?$|^1(\.0+)?$/)
const schema = z.object({
  settings: z.object({
    default_start_date: z.iso.date(),
    initial_isa_amount: moneyString,
    initial_gia_amount: moneyString,
    bed_isa_enabled: z.enum(['true', 'false']),
    manual_price_enabled: z.enum(['true', 'false']),
    manual_price_override: z.union([z.literal(''), z.string().regex(/^\d+(\.\d{1,6})?$/)]),
    refresh_interval_minutes: z.string().regex(/^\d+$/).refine(value => Number(value) >= 5 && Number(value) <= 1440),
    cash_interest_rate: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/)
  }).partial(),
  taxProfile: z.object({
    taxYear: z.string().regex(/^\d{4}\/\d{2}$/),
    employmentIncome: moneyString,
    otherTaxableIncome: moneyString,
    otherDividendIncome: moneyString,
    otherCapitalGains: moneyString,
    capitalLosses: moneyString,
    pensionContributions: moneyString,
    personalAllowanceOverride: moneyString.nullable(),
    isaAllowanceUsed: moneyString,
    mode: z.enum(['simple', 'advanced'])
  }),
  taxRules: z.object({
    taxYear: z.string().regex(/^\d{4}\/\d{2}$/),
    isaAllowance: moneyString,
    cgtAnnualExemption: moneyString,
    cgtBasicRate: rateString,
    cgtHigherRate: rateString,
    dividendAllowance: moneyString,
    dividendBasicRate: rateString,
    dividendHigherRate: rateString,
    dividendAdditionalRate: rateString,
    personalAllowance: moneyString,
    basicRateBand: moneyString,
    additionalRateThreshold: moneyString,
    confirmed: z.boolean(),
    sourceNote: z.string().min(5).max(500)
  })
})

export default defineEventHandler(async event => {
  try {
    await ensureApplicationDefaults()
    const input = parseWithZod(schema, await readBody(event))
    if (input.settings.cash_interest_rate !== undefined) await settleCashInterest()
    const db = getDatabase()
    const now = new Date().toISOString()
    db.transaction(tx => {
      for (const [key, value] of Object.entries(input.settings)) {
        if (value === undefined) continue
        tx.insert(appSetting).values({ key, value, updatedAt: now })
          .onConflictDoUpdate({ target: appSetting.key, set: { value, updatedAt: now } }).run()
      }
      if (input.settings.default_start_date) {
        tx.update(portfolio).set({ startDate: input.settings.default_start_date })
          .where(eq(portfolio.status, 'PENDING')).run()
      }
      tx.insert(taxProfile).values({ ...input.taxProfile, updatedAt: now })
        .onConflictDoUpdate({
          target: taxProfile.taxYear,
          set: { ...input.taxProfile, updatedAt: now }
        }).run()
      const dates = taxYearDates(input.taxRules.taxYear)
      tx.insert(taxYear).values({
        label: input.taxRules.taxYear,
        ...dates,
        isaAllowance: input.taxRules.isaAllowance,
        cgtAnnualExemption: input.taxRules.cgtAnnualExemption,
        cgtBasicRate: input.taxRules.cgtBasicRate,
        cgtHigherRate: input.taxRules.cgtHigherRate,
        dividendAllowance: input.taxRules.dividendAllowance,
        dividendBasicRate: input.taxRules.dividendBasicRate,
        dividendHigherRate: input.taxRules.dividendHigherRate,
        dividendAdditionalRate: input.taxRules.dividendAdditionalRate,
        personalAllowance: input.taxRules.personalAllowance,
        basicRateBand: input.taxRules.basicRateBand,
        additionalRateThreshold: input.taxRules.additionalRateThreshold,
        confirmed: input.taxRules.confirmed,
        sourceNote: input.taxRules.sourceNote,
        updatedAt: now
      }).onConflictDoUpdate({
        target: taxYear.label,
        set: {
          ...dates,
          isaAllowance: input.taxRules.isaAllowance,
          cgtAnnualExemption: input.taxRules.cgtAnnualExemption,
          cgtBasicRate: input.taxRules.cgtBasicRate,
          cgtHigherRate: input.taxRules.cgtHigherRate,
          dividendAllowance: input.taxRules.dividendAllowance,
          dividendBasicRate: input.taxRules.dividendBasicRate,
          dividendHigherRate: input.taxRules.dividendHigherRate,
          dividendAdditionalRate: input.taxRules.dividendAdditionalRate,
          personalAllowance: input.taxRules.personalAllowance,
          basicRateBand: input.taxRules.basicRateBand,
          additionalRateThreshold: input.taxRules.additionalRateThreshold,
          confirmed: input.taxRules.confirmed,
          sourceNote: input.taxRules.sourceNote,
          updatedAt: now
        }
      }).run()
    })
    return { saved: true }
  } catch (error) {
    return apiError(error)
  }
})
