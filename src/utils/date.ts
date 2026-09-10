import type { LocalDate } from '@/types'

/** Local calendar day for a Date (never UTC — avoids off-by-one near midnight). */
export function toLocalDate(d: Date = new Date()): LocalDate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today(): LocalDate {
  return toLocalDate(new Date())
}

/** Parse a LocalDate into a Date at local midnight. */
export function fromLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = fromLocalDate(date)
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}

/** Inclusive list of days from `start` to `end`. */
export function dateRange(start: LocalDate, end: LocalDate): LocalDate[] {
  const out: LocalDate[] = []
  let cur = start
  // Guard against an inverted range producing an infinite loop.
  if (fromLocalDate(start) > fromLocalDate(end)) return out
  while (cur <= end) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

/** The last `n` days ending today (oldest first). */
export function lastNDays(n: number, end: LocalDate = today()): LocalDate[] {
  return dateRange(addDays(end, -(n - 1)), end)
}

export function daysBetween(a: LocalDate, b: LocalDate): number {
  const ms = fromLocalDate(b).getTime() - fromLocalDate(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function isWeekend(date: LocalDate): boolean {
  const d = fromLocalDate(date).getDay()
  return d === 0 || d === 6
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatDate(date: LocalDate, style: 'short' | 'long' | 'weekday' = 'short'): string {
  const d = fromLocalDate(date)
  if (style === 'weekday') return DAYS[d.getDay()]
  if (style === 'long') return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function relativeDayLabel(date: LocalDate): string {
  const diff = daysBetween(date, today())
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff === -1) return 'Tomorrow'
  return formatDate(date, 'long')
}

/** "HH:MM" → minutes past midnight. */
export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'

export function dayPart(hour: number = new Date().getHours()): DayPart {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

export function greeting(part: DayPart = dayPart()): string {
  switch (part) {
    case 'morning': return 'Good morning'
    case 'afternoon': return 'Good afternoon'
    case 'evening': return 'Good evening'
    case 'night': return 'Good evening'
  }
}
