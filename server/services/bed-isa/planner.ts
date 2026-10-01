import type { BedIsaPreview, TaxProfileInput, TaxRules } from '../../../shared/types/domain'
import { D, money, precise } from '../../utils/decimal'
import { calculateMarginalCgt } from '../tax/cgt'

export function planBedAndIsa(input: {
  date: string
  price: string
  giaUnits: string
  giaOriginalCost: string
  giaEriAdjustment: string
  isaValue: string
  requestedAmount?: string
  portfolioIsaAllowanceUsed?: string
  profile: TaxProfileInput
  rules: TaxRules
  realisedGainsThisYear?: string
}): BedIsaPreview {
  const giaValue = D(input.giaUnits).mul(input.price)
  const allowance = DecimalMax(
    D(input.rules.isaAllowance)
      .minus(input.profile.isaAllowanceUsed)
      .minus(input.portfolioIsaAllowanceUsed ?? 0),
    0
  )
  const requested = input.requestedAmount ? D(input.requestedAmount) : allowance
  const amount = DecimalMin(DecimalMin(requested, allowance), giaValue)
  const units = D(input.price).eq(0) ? D(0) : amount.div(input.price)
  const adjustedBase = D(input.giaOriginalCost).plus(input.giaEriAdjustment)
  const allocatedCost = D(input.giaUnits).eq(0) ? D(0) : adjustedBase.mul(units).div(input.giaUnits)
  const gain = amount.minus(allocatedCost)
  const cgt = calculateMarginalCgt({
    realisedGain: money(gain),
    realisedGainsThisYear: input.realisedGainsThisYear ?? '0',
    profile: input.profile,
    rules: input.rules
  })

  return {
    date: input.date,
    currentGiaValue: money(giaValue),
    availableIsaAllowance: money(allowance),
    suggestedAmount: money(amount),
    unitsToSell: precise(units),
    estimatedGain: money(gain),
    cgtAnnualExemptionRemaining: cgt.annualExemptionAvailable,
    estimatedCgt: cgt.estimatedCgt,
    isaValueAfter: money(D(input.isaValue).plus(amount)),
    giaValueAfter: money(giaValue.minus(amount)),
    price: money(input.price),
    rulesAssumed: !input.rules.confirmed,
    cgt
  }
}

function DecimalMin(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.lt(b) ? a : b
}

function DecimalMax(a: ReturnType<typeof D>, b: number) {
  const right = D(b)
  return a.gt(right) ? a : right
}
