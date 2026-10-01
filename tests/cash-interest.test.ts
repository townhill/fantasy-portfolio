import { describe, expect, it } from 'vitest'
import { calculateInterest, cashBalance, cashMovement, lastCompletedMonth, monthAfter } from '../server/services/cash/interest'

const deposit = (date: string, amount: string) => ({ date, amount })

describe('cash account balance', () => {
  it('adds deposits and interest and subtracts cash taken out', () => {
    const movements = [
      cashMovement('CASH_DEPOSIT', '2026-09-01', '10000.00'),
      cashMovement('INTEREST', '2026-09-30', '16.44'),
      cashMovement('CASH_WITHDRAWAL', '2026-10-05', '2500.00')
    ].filter(item => item !== null)
    expect(cashBalance(movements)).toBe('7516.44')
    expect(cashBalance(movements, '2026-09-30')).toBe('10016.44')
    expect(cashMovement('ISA_SELL', '2026-09-01', '10000.00')).toBeNull()
  })
})

describe('cash interest', () => {
  it('accrues daily on the balance and pays at month end', () => {
    const result = calculateInterest({ movements: [deposit('2026-09-01', '10000')], annualRatePercent: '2', fromMonth: '2026-09', asOf: '2026-10-01' })
    expect(result.postings).toEqual([{ month: '2026-09', date: '2026-09-30', amount: '16.44' }])
    expect(result.accruedThisMonth).toBe('0.00')
  })

  it('only accrues from the day of a mid-month deposit', () => {
    const result = calculateInterest({ movements: [deposit('2026-09-16', '10000')], annualRatePercent: '2', fromMonth: '2026-09', asOf: '2026-10-01' })
    expect(result.postings[0]?.amount).toBe('8.22')
  })

  it('compounds paid interest into the following month', () => {
    const result = calculateInterest({ movements: [deposit('2026-09-01', '10000')], annualRatePercent: '2', fromMonth: '2026-09', asOf: '2026-11-01' })
    expect(result.postings.map(item => item.amount)).toEqual(['16.44', '17.01'])
  })

  it('reports the unfinished month as accrued rather than paid', () => {
    const result = calculateInterest({ movements: [deposit('2026-09-01', '10000')], annualRatePercent: '2', fromMonth: '2026-09', asOf: '2026-10-11' })
    expect(result.postings).toHaveLength(1)
    expect(result.accruedThisMonth).toBe('5.49')
  })

  it('reflects cash taken out during the month', () => {
    const result = calculateInterest({
      movements: [deposit('2026-09-01', '10000'), deposit('2026-09-11', '-4000')],
      annualRatePercent: '2', fromMonth: '2026-09', asOf: '2026-10-01'
    })
    expect(result.postings[0]?.amount).toBe('12.05')
  })

  it('does not accrue on a deposit made today', () => {
    const result = calculateInterest({ movements: [deposit('2026-10-01', '10000')], annualRatePercent: '2', fromMonth: '2026-10', asOf: '2026-10-01' })
    expect(result.postings).toEqual([])
    expect(result.accruedThisMonth).toBe('0.00')
  })

  it('continues from the month after the last posting without repeating it', () => {
    const result = calculateInterest({
      movements: [deposit('2026-09-01', '10000'), deposit('2026-09-30', '16.44')],
      annualRatePercent: '2', fromMonth: monthAfter('2026-09-30'), asOf: '2026-11-01'
    })
    expect(result.postings).toEqual([{ month: '2026-10', date: '2026-10-31', amount: '17.01' }])
  })

  it('pays nothing at a zero rate', () => {
    const result = calculateInterest({ movements: [deposit('2026-09-01', '10000')], annualRatePercent: '0', fromMonth: '2026-09', asOf: '2026-12-01' })
    expect(result.postings).toEqual([])
  })

  it('rolls months over year ends', () => {
    expect(monthAfter('2026-12-31')).toBe('2027-01')
    expect(lastCompletedMonth('2027-01-15')).toBe('2026-12')
    const result = calculateInterest({ movements: [deposit('2026-12-01', '10000')], annualRatePercent: '2', fromMonth: '2026-12', asOf: '2027-02-01' })
    expect(result.postings.map(item => item.date)).toEqual(['2026-12-31', '2027-01-31'])
  })
})
