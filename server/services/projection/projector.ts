import type { InvestmentAccountType, ProjectionPoint, TaxProfileInput, TaxRules } from '../../../shared/types/domain'
import { D, money } from '../../utils/decimal'
import { calculateCgt } from '../tax/cgt'

export function projectPortfolio(input: {
  years: number
  annualReturnPercent: string
  startingIsaValue: string
  startingGiaValue: string
  startingGiaBaseCost: string
  startingCash?: string
  cashInterestPercent?: string
  annualWithdrawal?: string
  withdrawFrom?: InvestmentAccountType
  rules: TaxRules
  profile: TaxProfileInput
  startYear: number
}): ProjectionPoint[] {
  let isa = D(input.startingIsaValue)
  let gia = D(input.startingGiaValue)
  let giaBase = D(input.startingGiaBaseCost)
  let cash = D(input.startingCash ?? 0)
  let cumulativeTax = D(0)
  let sheltered = D(0)
  let cumulativeWithdrawn = D(0)
  const growth = D(1).plus(D(input.annualReturnPercent).div(100))
  const cashGrowth = D(1).plus(D(input.cashInterestPercent ?? 0).div(100))
  const annualWithdrawal = D(input.annualWithdrawal ?? 0)
  const sellOrder: InvestmentAccountType[] = input.withdrawFrom === 'GIA' ? ['GIA', 'ISA'] : ['ISA', 'GIA']
  const point = (year: number, label: string, withdrawn: ReturnType<typeof D>, shortfall: ReturnType<typeof D>, historical: boolean): ProjectionPoint => ({
    year,
    label,
    portfolioValue: money(isa.plus(gia).plus(cash)),
    isaValue: money(isa),
    giaValue: money(gia),
    cashValue: money(cash),
    withdrawn: money(withdrawn),
    cumulativeWithdrawn: money(cumulativeWithdrawn),
    shortfall: money(shortfall),
    estimatedCumulativeTax: money(cumulativeTax),
    amountSheltered: money(sheltered),
    historical
  })
  const output: ProjectionPoint[] = [point(0, 'Today', D(0), D(0), true)]

  for (let year = 1; year <= input.years; year += 1) {
    let yearGain = D(0)

    // Money to live on is taken at the start of each year: cash first, then the preferred account,
    // then the other account once the preferred one is empty.
    let needed = annualWithdrawal
    const fromCash = DecimalMin(cash, needed)
    cash = cash.minus(fromCash)
    needed = needed.minus(fromCash)
    for (const source of sellOrder) {
      if (needed.lte(0)) break
      if (source === 'ISA') {
        const sold = DecimalMin(isa, needed)
        isa = isa.minus(sold)
        needed = needed.minus(sold)
      } else {
        const sold = DecimalMin(gia, needed)
        const soldBase = gia.eq(0) ? D(0) : giaBase.mul(sold).div(gia)
        yearGain = yearGain.plus(sold.minus(soldBase))
        gia = gia.minus(sold)
        giaBase = giaBase.minus(soldBase)
        needed = needed.minus(sold)
      }
    }
    const withdrawn = annualWithdrawal.minus(needed)
    cumulativeWithdrawn = cumulativeWithdrawn.plus(withdrawn)

    isa = isa.mul(growth)
    gia = gia.mul(growth)
    cash = cash.mul(cashGrowth)
    const allowance = D(input.rules.isaAllowance)
    const transfer = DecimalMin(allowance, gia)
    const allocatedBase = gia.eq(0) ? D(0) : giaBase.mul(transfer).div(gia)
    yearGain = yearGain.plus(transfer.minus(allocatedBase))
    // Living-cost sales and the Bed & ISA transfer share one annual exemption and basic-rate band.
    const cgt = calculateCgt({ realisedGain: money(yearGain), profile: input.profile, rules: { ...input.rules, confirmed: year === 0 && input.rules.confirmed } })
    cumulativeTax = cumulativeTax.plus(cgt.estimatedCgt)
    gia = gia.minus(transfer)
    giaBase = giaBase.minus(allocatedBase)
    isa = isa.plus(transfer)
    sheltered = sheltered.plus(transfer)
    output.push(point(year, String(input.startYear + year), withdrawn, needed, false))
  }
  return output
}

function DecimalMin(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.lt(b) ? a : b
}
