import { describe, expect, it } from 'vitest'
import { projectPortfolio } from '../server/services/projection/projector'
import { basicProfile, rules } from './fixtures'

describe('portfolio projection', () => {
  it('keeps actual starting data separate from forecast years', () => {
    const result = projectPortfolio({ years: 5, annualReturnPercent: '0', startingIsaValue: '20000', startingGiaValue: '80000', startingGiaBaseCost: '80000', rules, profile: basicProfile, startYear: 2026 })
    expect(result).toHaveLength(6)
    expect(result[0]?.historical).toBe(true)
    expect(result.slice(1).every(point => !point.historical)).toBe(true)
    expect(result[1]?.isaValue).toBe('40000.00')
    expect(result.at(-1)?.giaValue).toBe('0.00')
    expect(result.at(-1)?.amountSheltered).toBe('80000.00')
  })

  const start = { years: 1, annualReturnPercent: '0', startingIsaValue: '20000', startingGiaValue: '80000', startingGiaBaseCost: '40000', rules, profile: basicProfile, startYear: 2026 }

  it('funds living withdrawals from cash first, then the ISA by default', () => {
    const [, year1] = projectPortfolio({ ...start, startingGiaBaseCost: '80000', startingCash: '5000', annualWithdrawal: '10000' })
    expect(year1?.cashValue).toBe('0.00')
    expect(year1?.isaValue).toBe('35000.00')
    expect(year1?.giaValue).toBe('60000.00')
    expect(year1?.withdrawn).toBe('10000.00')
    expect(year1?.shortfall).toBe('0.00')
    expect(year1?.portfolioValue).toBe('95000.00')
  })

  it('pays more CGT when living withdrawals come from the GIA first', () => {
    const fromIsa = projectPortfolio({ ...start, annualWithdrawal: '10000' })
    const fromGia = projectPortfolio({ ...start, annualWithdrawal: '10000', withdrawFrom: 'GIA' })
    expect(fromIsa[1]?.estimatedCumulativeTax).toBe('1260.00')
    expect(fromGia[1]?.estimatedCumulativeTax).toBe('2160.00')
  })

  it('reports a shortfall once the portfolio cannot fund the withdrawal', () => {
    const result = projectPortfolio({ ...start, years: 2, startingIsaValue: '5000', startingGiaValue: '0', startingGiaBaseCost: '0', annualWithdrawal: '10000' })
    expect(result[1]?.withdrawn).toBe('5000.00')
    expect(result[1]?.shortfall).toBe('5000.00')
    expect(result[2]?.shortfall).toBe('10000.00')
    expect(result[2]?.cumulativeWithdrawn).toBe('5000.00')
    expect(result[2]?.portfolioValue).toBe('0.00')
  })

  it('grows cash at the cash interest rate', () => {
    const result = projectPortfolio({ ...start, startingIsaValue: '0', startingGiaValue: '0', startingGiaBaseCost: '0', startingCash: '10000', cashInterestPercent: '2' })
    expect(result[0]?.cashValue).toBe('10000.00')
    expect(result[1]?.cashValue).toBe('10200.00')
  })
})
