import type { ProjectionPoint, TaxProfileInput, TaxRules } from '../../../shared/types/domain'
import { D, money } from '../../utils/decimal'
import { calculateCgt } from '../tax/cgt'

export function projectPortfolio(input: {
  years: number
  annualReturnPercent: string
  startingIsaValue: string
  startingGiaValue: string
  startingGiaBaseCost: string
  rules: TaxRules
  profile: TaxProfileInput
  startYear: number
}): ProjectionPoint[] {
  let isa = D(input.startingIsaValue)
  let gia = D(input.startingGiaValue)
  let giaBase = D(input.startingGiaBaseCost)
  let cumulativeTax = D(0)
  let sheltered = D(0)
  const growth = D(1).plus(D(input.annualReturnPercent).div(100))
  const output: ProjectionPoint[] = [{
    year: 0,
    label: 'Today',
    portfolioValue: money(isa.plus(gia)),
    isaValue: money(isa),
    giaValue: money(gia),
    estimatedCumulativeTax: money(cumulativeTax),
    amountSheltered: money(sheltered),
    historical: true
  }]

  for (let year = 1; year <= input.years; year += 1) {
    isa = isa.mul(growth)
    gia = gia.mul(growth)
    const allowance = D(input.rules.isaAllowance)
    const transfer = DecimalMin(allowance, gia)
    const allocatedBase = gia.eq(0) ? D(0) : giaBase.mul(transfer).div(gia)
    const gain = transfer.minus(allocatedBase)
    const cgt = calculateCgt({ realisedGain: money(gain), profile: input.profile, rules: { ...input.rules, confirmed: year === 0 && input.rules.confirmed } })
    cumulativeTax = cumulativeTax.plus(cgt.estimatedCgt)
    gia = gia.minus(transfer)
    giaBase = giaBase.minus(allocatedBase)
    isa = isa.plus(transfer)
    sheltered = sheltered.plus(transfer)
    output.push({
      year,
      label: String(input.startYear + year),
      portfolioValue: money(isa.plus(gia)),
      isaValue: money(isa),
      giaValue: money(gia),
      estimatedCumulativeTax: money(cumulativeTax),
      amountSheltered: money(sheltered),
      historical: false
    })
  }
  return output
}

function DecimalMin(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.lt(b) ? a : b
}

function DecimalMax(a: ReturnType<typeof D>, b: number) {
  const right = D(b)
  return a.gt(right) ? a : right
}
