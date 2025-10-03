/**
 * Date formatting utilities
 * Centralized Intl.DateTimeFormat instances for consistent date/time display
 * All formats use Polish locale (pl-PL)
 */

/**
 * Format time as HH:mm (24-hour format)
 * @example "14:30", "09:15"
 */
export const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * Format date as "weekday, day month year"
 * @example "poniedziałek, 15 stycznia 2024"
 */
export const fullDateFormatter = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * Format date as "weekday, day month" (without year)
 * @example "poniedziałek, 15 stycznia"
 */
export const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/**
 * Format date as "day.month.year"
 * @example "15.01.2024"
 */
export const shortDateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Format date as "short weekday, day short month"
 * @example "pon, 15 sty"
 */
export const compactDateFormatter = new Intl.DateTimeFormat('pl-PL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

/**
 * Format date as ISO date string (YYYY-MM-DD)
 * @example "2024-01-15"
 */
export function formatISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Format time range
 * @example "14:30–15:30"
 */
export function formatTimeRange(startDate: Date, endDate: Date): string {
  return `${timeFormatter.format(startDate)}–${timeFormatter.format(endDate)}`
}

/**
 * Format full date with time
 * @example "poniedziałek, 15 stycznia 2024, 14:30"
 */
export function formatFullDateTime(date: Date): string {
  return `${fullDateFormatter.format(date)}, ${timeFormatter.format(date)}`
}

/**
 * Format date with time (without year)
 * @example "poniedziałek, 15 stycznia, 14:30"
 */
export function formatDateTime(date: Date): string {
  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`
}
