import { D, money } from '../../utils/decimal'

export function calculateEri(eriPerUnit: string, applicableGiaUnits: string) {
  const amount = D(eriPerUnit).mul(applicableGiaUnits)
  return {
    eriPerUnit,
    applicableUnits: applicableGiaUnits,
    totalReportableIncome: money(amount),
    allowableBaseCostAdjustment: money(amount)
  }
}

export function adjustedCgtBaseCost(originalSection104Cost: string, cumulativeEriAdjustment: string) {
  return money(D(originalSection104Cost).plus(cumulativeEriAdjustment))
}
