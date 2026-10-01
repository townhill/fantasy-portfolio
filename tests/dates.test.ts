import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateInterest, lastCompletedMonth } from '../server/services/cash/interest'
import { taxYearForDate } from '../server/services/tax/rules'
import { londonDate } from '../shared/utils/dates'

afterEach(() => {
  vi.useRealTimers()
})

describe('UK calendar date', () => {
  it('rolls over at midnight BST rather than midnight UTC on the 5/6 April boundary', () => {
    expect(londonDate(new Date('2027-04-05T22:59:59Z'))).toBe('2027-04-05')
    expect(londonDate(new Date('2027-04-05T23:00:00Z'))).toBe('2027-04-06')
    expect(londonDate(new Date('2027-04-05T23:30:00Z'))).toBe('2027-04-06')
  })

  it('matches the UTC date while the UK is on GMT', () => {
    expect(londonDate(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31')
    expect(londonDate(new Date('2027-01-01T00:30:00Z'))).toBe('2027-01-01')
  })

  it('defaults to the current instant', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-04-05T23:30:00Z'))
    expect(londonDate()).toBe('2027-04-06')
  })
})

describe('tax year at an instant', () => {
  it('starts the new tax year at 00:00 BST on 6 April', () => {
    expect(taxYearForDate(new Date('2027-04-05T22:59:59Z'))).toBe('2026/27')
    expect(taxYearForDate(new Date('2027-04-05T23:00:00Z'))).toBe('2027/28')
  })

  it('dates a withdrawal at 00:30 BST on 6 April into the new tax year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-04-05T23:30:00Z'))
    const date = londonDate()
    expect(date).toBe('2027-04-06')
    expect(taxYearForDate(date)).toBe('2027/28')
    expect(taxYearForDate(new Date())).toBe('2027/28')
  })

  it('still ends the old tax year at 23:59 BST on 5 April', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-04-05T22:30:00Z'))
    expect(londonDate()).toBe('2027-04-05')
    expect(taxYearForDate(new Date())).toBe('2026/27')
  })
})

describe('cash interest at a BST month end', () => {
  const movements = [{ date: '2026-09-01', amount: '10000' }]

  it('settles the finished month at 00:30 BST on the 1st', () => {
    const asOf = londonDate(new Date('2026-09-30T23:30:00Z'))
    expect(asOf).toBe('2026-10-01')
    expect(lastCompletedMonth(asOf)).toBe('2026-09')
    const result = calculateInterest({ movements, annualRatePercent: '2', fromMonth: '2026-09', asOf })
    expect(result.postings).toEqual([{ month: '2026-09', date: '2026-09-30', amount: '16.44' }])
    expect(result.accruedThisMonth).toBe('0.00')
  })

  it('keeps the month open until midnight BST on the last day', () => {
    const asOf = londonDate(new Date('2026-09-30T22:30:00Z'))
    expect(asOf).toBe('2026-09-30')
    expect(lastCompletedMonth(asOf)).toBe('2026-08')
    const result = calculateInterest({ movements, annualRatePercent: '2', fromMonth: '2026-09', asOf })
    expect(result.postings).toEqual([])
  })
})
