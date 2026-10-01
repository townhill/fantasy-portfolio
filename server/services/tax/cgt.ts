import type { CgtResult, TaxProfileInput, TaxRules } from '../../../shared/types/domain'
import { D, money } from '../../utils/decimal'

export interface CgtInput {
  realisedGain: string
  realisedLosses?: string
  exemptionAlreadyUsed?: string
  profile: TaxProfileInput
  rules: TaxRules
}

export function calculateCgt(input: CgtInput): CgtResult {
  const gain = D(input.realisedGain)
  const losses = D(input.realisedLosses ?? input.profile.capitalLosses)
  const otherGains = D(input.profile.otherCapitalGains)
  const netGain = DecimalMax(gain.plus(otherGains).minus(losses), 0)
  const exemptionAvailable = DecimalMax(D(input.rules.cgtAnnualExemption).minus(input.exemptionAlreadyUsed ?? 0), 0)
  const exemptionUsed = DecimalMin(netGain, exemptionAvailable)
  const taxableGain = DecimalMax(netGain.minus(exemptionUsed), 0)

  const allowance = input.profile.personalAllowanceOverride === null
    ? D(input.rules.personalAllowance)
    : D(input.profile.personalAllowanceOverride)
  const nonSavingsIncome = DecimalMax(
    D(input.profile.employmentIncome)
      .plus(input.profile.otherTaxableIncome)
      .minus(input.profile.pensionContributions)
      .minus(allowance),
    0
  )
  const remainingBasicBand = DecimalMax(D(input.rules.basicRateBand).minus(nonSavingsIncome), 0)
  const basicRateGain = DecimalMin(taxableGain, remainingBasicBand)
  const higherRateGain = DecimalMax(taxableGain.minus(basicRateGain), 0)
  const basicRateTax = basicRateGain.mul(input.rules.cgtBasicRate)
  const higherRateTax = higherRateGain.mul(input.rules.cgtHigherRate)

  return {
    realisedGain: money(gain),
    netGainBeforeExemption: money(netGain),
    annualExemptionAvailable: money(exemptionAvailable),
    annualExemptionUsed: money(exemptionUsed),
    taxableGain: money(taxableGain),
    basicRateGain: money(basicRateGain),
    higherRateGain: money(higherRateGain),
    basicRateTax: money(basicRateTax),
    higherRateTax: money(higherRateTax),
    estimatedCgt: money(basicRateTax.plus(higherRateTax))
  }
}

/**
 * The change in a tax year's CGT caused by one more gain on top of the gains already realised that
 * year, so earlier disposals keep their share of the annual exemption and basic-rate band. Each field
 * is the difference this gain makes, except annualExemptionAvailable, which is what was left before it.
 * A loss that offsets earlier gains gives a negative estimate.
 */
export function calculateMarginalCgt(input: {
  realisedGain: string
  realisedGainsThisYear: string
  profile: TaxProfileInput
  rules: TaxRules
}): CgtResult {
  const before = calculateCgt({ realisedGain: input.realisedGainsThisYear, profile: input.profile, rules: input.rules })
  const after = calculateCgt({
    realisedGain: money(D(input.realisedGainsThisYear).plus(input.realisedGain)),
    profile: input.profile,
    rules: input.rules
  })
  const change = (key: keyof CgtResult) => money(D(after[key]).minus(before[key]))
  return {
    realisedGain: money(input.realisedGain),
    netGainBeforeExemption: change('netGainBeforeExemption'),
    annualExemptionAvailable: money(D(before.annualExemptionAvailable).minus(before.annualExemptionUsed)),
    annualExemptionUsed: change('annualExemptionUsed'),
    taxableGain: change('taxableGain'),
    basicRateGain: change('basicRateGain'),
    higherRateGain: change('higherRateGain'),
    basicRateTax: change('basicRateTax'),
    higherRateTax: change('higherRateTax'),
    estimatedCgt: change('estimatedCgt')
  }
}

function DecimalMin(a: ReturnType<typeof D>, b: ReturnType<typeof D> | string | number) {
  const right = D(b)
  return a.lt(right) ? a : right
}

function DecimalMax(a: ReturnType<typeof D>, b: ReturnType<typeof D> | string | number) {
  const right = D(b)
  return a.gt(right) ? a : right
}
