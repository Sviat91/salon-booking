import { format, addDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { readExceptions, readWeekly } from './google/sheets'
import { freeBusy } from './google/calendar'

const TZ = 'Europe/Warsaw'

type Range = { start: number; end: number } // minutes in day

const t2m = (t: string) => {
  const s = String(t || '').trim()
  // Support both HH:MM and HH.MM
  const m = s.match(/^(\d{1,2})[:\.](\d{2})$/)
  if (!m) return NaN
  const h = Number(m[1])
  const mm = Number(m[2])
  return h * 60 + mm
}
const parseRanges = (s: string): Range[] =>
  String(s || '')
    .replace(/\u00A0/g, ' ')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => x.split(/–|-/).map(y => y.trim()))
    .filter(p => p.length === 2)
    .map(([a, b]) => ({ start: t2m(a), end: t2m(b) }))
    .filter(r => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)

function minusBusy(open: Range[], busy: Range[]): Range[] {
  const res: Range[] = []
  const mergedBusy = [...busy].sort((a, b) => a.start - b.start)
  for (const o of open) {
    let cursor = o.start
    for (const b of mergedBusy) {
      if (b.end <= cursor || b.start >= o.end) continue
      if (b.start > cursor) res.push({ start: cursor, end: Math.min(b.start, o.end) })
      cursor = Math.max(cursor, b.end)
      if (cursor >= o.end) break
    }
    if (cursor < o.end) res.push({ start: cursor, end: o.end })
  }
  return res
}

function isoDate(d: Date) { return format(d, 'yyyy-MM-dd') }

export async function getAvailableDays(fromISO: string, untilISO: string, minDuration: number, opts?: { debug?: boolean }) {
  const weekly = await readWeekly()
  const exceptions = await readExceptions()

  // one freeBusy for the whole period
  const busy = await freeBusy(`${fromISO}T00:00:00Z`, `${untilISO}T23:59:59Z`)

  // bucket busy by date in Warsaw TZ
  const busyByDate = new Map<string, Range[]>()
  for (const b of busy) {
    const s = toZonedTime(new Date(b.start), TZ)
    const e = toZonedTime(new Date(b.end), TZ)
    const day = isoDate(s)
    const start = s.getHours() * 60 + s.getMinutes()
    const end = e.getHours() * 60 + e.getMinutes()
    const arr = busyByDate.get(day) ?? []
    arr.push({ start, end })
    busyByDate.set(day, arr)
  }

  // iterate days and decide availability
  const days: { date: string; hasWindow: boolean }[] = []
  let cursor = new Date(fromISO + 'T00:00:00')
  const endDate = new Date(untilISO + 'T00:00:00')
  while (cursor <= endDate) {
    const date = isoDate(cursor)
    const weekday = cursor.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    // derive open ranges
    let hours = weekly[weekday]?.hours || ''
    let isDayOff = weekly[weekday]?.isDayOff || false
    if (exceptions[date]) {
      const ex = exceptions[date]
      if (ex.hours) hours = ex.hours
      isDayOff = ex.isDayOff
    }
    let hasWindow = false
    if (!isDayOff && hours) {
      const open = parseRanges(hours)
      const dayBusy = busyByDate.get(date) ?? []
      const free = minusBusy(open, dayBusy)
      hasWindow = free.some(r => r.end - r.start >= minDuration)
    }
    days.push({ date, hasWindow })
    cursor = addDays(cursor, 1)
  }
  const result: any = { days }
  if (opts?.debug) {
    result.debug = {
      weeklyKeys: Object.keys(weekly).length,
      exceptionsCount: Object.keys(exceptions).length,
      busyCount: busy.length,
      minDuration,
    }
  }
  return result
}
