export function formatGbp(value: string | number | null | undefined, maximumFractionDigits = 2) {
  const numeric = Number(value ?? 0)
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits
  }).format(numeric)
}

export function formatPercent(value: string | number | null | undefined, digits = 2) {
  return `${Number(value ?? 0).toFixed(digits)}%`
}

export function formatUnits(value: string | number | null | undefined) {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  }).format(Number(value ?? 0))
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not yet available'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
