import Decimal from 'decimal.js'

Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP })

export const D = (value: Decimal.Value | null | undefined = 0) => new Decimal(value ?? 0)
export const money = (value: Decimal.Value) => D(value).toDecimalPlaces(2).toFixed(2)
export const precise = (value: Decimal.Value, places = 12) => D(value).toDecimalPlaces(places).toFixed(places)
export const percent = (value: Decimal.Value) => D(value).toDecimalPlaces(4).toFixed(4)

export function ratioPercent(numerator: Decimal.Value, denominator: Decimal.Value) {
  const bottom = D(denominator)
  return bottom.eq(0) ? '0.0000' : percent(D(numerator).div(bottom).mul(100))
}
