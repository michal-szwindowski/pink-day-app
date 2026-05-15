export const APP_TIMEZONE = 'Europe/Warsaw'

export function getTodayDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1, day))

  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(utcDate)
}

export function getLongTodayLabel() {
  return formatDateKey(getTodayDateKey())
}

export function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function daysAgoDateKey(daysAgo: number) {
  return shiftDateKey(getTodayDateKey(), -daysAgo)
}

export function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}
