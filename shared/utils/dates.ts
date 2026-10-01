export const UK_TIME_ZONE = 'Europe/London'

const londonParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: UK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

/**
 * The UK calendar date (YYYY-MM-DD) at an instant, defaulting to now. UK tax years and month ends follow
 * London time, so between 00:00 and 01:00 BST this is already the next day while the UTC date is not.
 */
export function londonDate(at: Date = new Date()) {
  const parts = Object.fromEntries(londonParts.formatToParts(at).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
