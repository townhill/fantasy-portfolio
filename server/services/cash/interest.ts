import type { TransactionType } from '../../../shared/types/domain'
import { D, money } from '../../utils/decimal'

export interface CashMovement {
  date: string
  amount: string
}

export interface InterestPosting {
  month: string
  date: string
  amount: string
}

const CASH_DIRECTION: Partial<Record<TransactionType, 1 | -1>> = {
  CASH_DEPOSIT: 1,
  INTEREST: 1,
  CASH_WITHDRAWAL: -1
}

export function cashMovement(type: TransactionType, date: string, grossValue: string): CashMovement | null {
  const direction = CASH_DIRECTION[type]
  return direction ? { date, amount: D(grossValue).mul(direction).toString() } : null
}

export function cashBalance(movements: CashMovement[], through?: string) {
  return money(movements
    .filter(item => through === undefined || item.date <= through)
    .reduce((sum, item) => sum.plus(item.amount), D(0)))
}

/**
 * Interest accrues daily at annualRatePercent / 365 on each day's closing balance and is paid on the
 * last day of each month. Only days before `asOf` accrue, so a deposit made today starts earning tomorrow
 * and the current month is reported as accrued rather than paid.
 */
export function calculateInterest(input: {
  movements: CashMovement[]
  annualRatePercent: string
  fromMonth: string
  asOf: string
}): { postings: InterestPosting[], accruedThisMonth: string } {
  const dailyRate = D(input.annualRatePercent).div(100).div(365)
  const movements = [...input.movements].sort((a, b) => a.date.localeCompare(b.date))
  const postings: InterestPosting[] = []
  let day = `${input.fromMonth}-01`
  let next = 0
  let balance = D(0)
  let accrued = D(0)

  while (day < input.asOf) {
    while (next < movements.length && movements[next]!.date <= day) {
      balance = balance.plus(movements[next]!.amount)
      next += 1
    }
    if (balance.gt(0)) accrued = accrued.plus(balance.mul(dailyRate))
    const following = addDays(day, 1)
    if (following.slice(0, 7) !== day.slice(0, 7)) {
      const amount = money(accrued)
      if (D(amount).gt(0)) {
        postings.push({ month: day.slice(0, 7), date: day, amount })
        balance = balance.plus(amount)
      }
      accrued = D(0)
    }
    day = following
  }

  return { postings, accruedThisMonth: money(accrued) }
}

export function lastCompletedMonth(asOf: string) {
  const value = new Date(`${asOf.slice(0, 7)}-01T12:00:00Z`)
  value.setUTCMonth(value.getUTCMonth() - 1)
  return value.toISOString().slice(0, 7)
}

export function monthAfter(date: string) {
  const value = new Date(`${date.slice(0, 7)}-01T12:00:00Z`)
  value.setUTCMonth(value.getUTCMonth() + 1)
  return value.toISOString().slice(0, 7)
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
