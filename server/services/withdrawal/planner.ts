import type { InvestmentAccountType, TaxProfileInput, TaxRules, WithdrawalPreview } from '../../../shared/types/domain'
import { formatGbp } from '../../../shared/utils/format'
import { D, money, precise } from '../../utils/decimal'
import { calculateMarginalCgt } from '../tax/cgt'

export function planWithdrawal(input: {
  date: string
  account: InvestmentAccountType
  amount: string
  price: string
  units: string
  originalCost: string
  eriAdjustment: string
  cashBalance: string
  realisedGainsThisYear: string
  profile: TaxProfileInput
  rules: TaxRules
}): Omit<WithdrawalPreview, 'priceStale' | 'manualPrice'> {
  const requested = D(input.amount)
  const price = D(input.price)
  const units = D(input.units)
  if (requested.lte(0)) throw new Error('Enter a withdrawal amount greater than £0')
  if (price.lte(0)) throw new Error('A VUAG price greater than zero is required to sell units')
  const accountValue = D(money(units.mul(price)))
  if (requested.gt(accountValue)) {
    throw new Error(`The ${input.account} holds ${formatGbp(accountValue.toString())}; enter that amount or less`)
  }

  // Selling the full value clears the holding exactly instead of leaving fractional dust behind.
  const sellsEntireHolding = requested.eq(accountValue)
  const unitsToSell = sellsEntireHolding ? units : D(precise(requested.div(price)))
  const fraction = units.eq(0) ? D(0) : unitsToSell.div(units)
  const originalCostSold = D(money(D(input.originalCost).mul(fraction)))
  const eriAdjustmentSold = input.account === 'GIA' ? D(money(D(input.eriAdjustment).mul(fraction))) : D(0)
  const allocatedCost = originalCostSold.plus(eriAdjustmentSold)
  const gain = requested.minus(allocatedCost)

  let estimatedCgt = D(0)
  let cgtAnnualExemptionRemaining: string | null = null
  if (input.account === 'GIA') {
    const cgt = calculateMarginalCgt({ realisedGain: money(gain), realisedGainsThisYear: input.realisedGainsThisYear, profile: input.profile, rules: input.rules })
    estimatedCgt = D(cgt.estimatedCgt)
    cgtAnnualExemptionRemaining = money(D(cgt.annualExemptionAvailable).minus(cgt.annualExemptionUsed))
  }

  return {
    date: input.date,
    account: input.account,
    price: precise(price, 6),
    accountValue: money(accountValue),
    proceeds: money(requested),
    unitsToSell: precise(unitsToSell),
    sellsEntireHolding,
    originalCostSold: money(originalCostSold),
    eriAdjustmentSold: money(eriAdjustmentSold),
    allocatedCost: money(allocatedCost),
    gain: money(gain),
    estimatedCgt: money(estimatedCgt),
    cgtAnnualExemptionRemaining,
    accountValueAfter: money(accountValue.minus(requested)),
    cashBalanceAfter: money(D(input.cashBalance).plus(requested)),
    rulesAssumed: !input.rules.confirmed
  }
}
