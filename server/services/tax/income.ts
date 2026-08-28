import type { IncomeTaxResult, TaxProfileInput, TaxRules } from '../../../shared/types/domain'
import { D, money } from '../../utils/decimal'

export function calculateReportableIncomeTax(
  reportableIncome: string,
  profile: TaxProfileInput,
  rules: TaxRules
): IncomeTaxResult {
  const portfolioIncome = D(reportableIncome)
  const otherDividends = D(profile.otherDividendIncome)
  const allowance = D(rules.dividendAllowance)
  const allowanceUsedByOthers = DecimalMin(otherDividends, allowance)
  const allowanceAvailable = DecimalMax(allowance.minus(allowanceUsedByOthers), 0)
  const allowanceUsed = DecimalMin(portfolioIncome, allowanceAvailable)
  const taxablePortfolioIncome = DecimalMax(portfolioIncome.minus(allowanceUsed), 0)

  const personalAllowance = profile.personalAllowanceOverride === null
    ? D(rules.personalAllowance)
    : D(profile.personalAllowanceOverride)
  const nonDividendTaxable = DecimalMax(
    D(profile.employmentIncome)
      .plus(profile.otherTaxableIncome)
      .minus(profile.pensionContributions)
      .minus(personalAllowance),
    0
  )
  const otherTaxableDividends = DecimalMax(otherDividends.minus(allowanceUsedByOthers), 0)
  let bandPosition = nonDividendTaxable.plus(otherTaxableDividends)
  let remaining = taxablePortfolioIncome
  let tax = D(0)

  const remainingBasic = DecimalMax(D(rules.basicRateBand).minus(bandPosition), 0)
  const basicSlice = DecimalMin(remaining, remainingBasic)
  tax = tax.plus(basicSlice.mul(rules.dividendBasicRate))
  remaining = remaining.minus(basicSlice)
  bandPosition = bandPosition.plus(basicSlice)

  const higherBandCeiling = D(rules.additionalRateThreshold).minus(personalAllowance)
  const remainingHigher = DecimalMax(higherBandCeiling.minus(bandPosition), 0)
  const higherSlice = DecimalMin(remaining, remainingHigher)
  tax = tax.plus(higherSlice.mul(rules.dividendHigherRate))
  remaining = remaining.minus(higherSlice)
  tax = tax.plus(remaining.mul(rules.dividendAdditionalRate))

  return {
    reportableIncome: money(portfolioIncome),
    dividendAllowanceAvailable: money(allowanceAvailable),
    dividendAllowanceUsed: money(allowanceUsed),
    taxableReportableIncome: money(taxablePortfolioIncome),
    estimatedIncomeTax: money(tax)
  }
}

function DecimalMin(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.lt(b) ? a : b
}

function DecimalMax(a: ReturnType<typeof D>, b: ReturnType<typeof D> | number) {
  const right = D(b)
  return a.gt(right) ? a : right
}
