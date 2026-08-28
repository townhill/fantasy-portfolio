import type { AccountSnapshot } from '../../../shared/types/domain'
import { D, money, precise, ratioPercent } from '../../utils/decimal'

export interface InitialAllocation {
  account: 'ISA' | 'GIA'
  amount: string
  units: string
  price: string
}

export function createInitialAllocations(price: string, isaAmount = '20000', giaAmount = '80000'): InitialAllocation[] {
  const acquisitionPrice = D(price)
  if (!acquisitionPrice.isPositive()) throw new Error('Acquisition price must be greater than zero')
  return [
    {
      account: 'ISA',
      amount: money(isaAmount),
      units: precise(D(isaAmount).div(acquisitionPrice)),
      price: precise(acquisitionPrice, 6)
    },
    {
      account: 'GIA',
      amount: money(giaAmount),
      units: precise(D(giaAmount).div(acquisitionPrice)),
      price: precise(acquisitionPrice, 6)
    }
  ]
}

export function valueAccount(input: {
  id: number
  type: 'ISA' | 'GIA'
  units: string
  originalCost: string
  eriAdjustment: string
  price: string
  totalPortfolioValue: string
}): AccountSnapshot {
  const units = D(input.units)
  const value = units.mul(input.price)
  const originalCost = D(input.originalCost)
  const eriAdjustment = input.type === 'GIA' ? D(input.eriAdjustment) : D(0)
  const adjustedBaseCost = originalCost.plus(eriAdjustment)
  const gain = value.minus(adjustedBaseCost)
  return {
    id: input.id,
    type: input.type,
    value: money(value),
    units: precise(units),
    averageAcquisitionPrice: units.eq(0) ? '0.00' : money(originalCost.div(units)),
    originalCost: money(originalCost),
    eriAdjustment: money(eriAdjustment),
    adjustedBaseCost: money(adjustedBaseCost),
    gainLoss: money(gain),
    gainLossPercent: ratioPercent(gain, adjustedBaseCost),
    portfolioPercent: ratioPercent(value, input.totalPortfolioValue)
  }
}

export function calculateValuation(units: string, price: string, originalCost: string) {
  const value = D(units).mul(price)
  const gain = value.minus(originalCost)
  return {
    value: money(value),
    gain: money(gain),
    gainPercent: ratioPercent(gain, originalCost)
  }
}
