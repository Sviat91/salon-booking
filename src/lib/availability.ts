import { format, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
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

  // Fetch busy in chunks (max 30 days per request) to avoid API range limits
  const busy: { start: string; end: string }[] = []
  const from = new Date(fromISO + 'T00:00:00Z')
  const until = new Date(untilISO + 'T23:59:59Z')
  for (let start = new Date(from); start <= until; ) {
    const chunkStart = new Date(start)
    const chunkEnd = new Date(Math.min(until.getTime(), start.getTime() + 29 * 24 * 3600 * 1000))
    const part = await freeBusy(chunkStart.toISOString(), chunkEnd.toISOString())
    busy.push(...part)
    // next day after chunkEnd
    const next = new Date(chunkEnd); next.setUTCDate(next.getUTCDate() + 1); next.setUTCHours(0,0,0,0)
    start = next
  }

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
      fromISO,
      untilISO,
    }
  }
  return result
}

// Generate concrete slots for a specific date in Europe/Warsaw
export async function getDaySlots(dateISO: string, minDuration: number, stepMin: number = 15) {
  const weekly = await readWeekly()
  const exceptions = await readExceptions()

  // Determine working hours for the specific date
  const base = new Date(dateISO + 'T00:00:00')
  const weekday = base.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  let hours = weekly[weekday]?.hours || ''
  let isDayOff = weekly[weekday]?.isDayOff || false
  if (exceptions[dateISO]) {
    const ex = exceptions[dateISO]
    if (ex.hours) hours = ex.hours
    isDayOff = ex.isDayOff
  }
  if (isDayOff || !hours) return { slots: [] as { startISO: string; endISO: string }[] }

  const open = parseRanges(hours)
  if (!open.length) return { slots: [] as { startISO: string; endISO: string }[] }

  // Query busy periods only for this day (in UTC, but interpreted with TZ on the API side)
  const dayStartUtc = fromZonedTime(dateISO + 'T00:00:00', TZ).toISOString()
  const dayEndUtc = fromZonedTime(dateISO + 'T23:59:59', TZ).toISOString()
  const busy = await freeBusy(dayStartUtc, dayEndUtc)

  // Convert busy intervals to minutes of the local day and clamp to [0..1440]
  const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
  const busyRanges: Range[] = busy.map(b => {
    const s = toZonedTime(new Date(b.start), TZ)
    const e = toZonedTime(new Date(b.end), TZ)
    let start = s.getHours() * 60 + s.getMinutes()
    let end = e.getHours() * 60 + e.getMinutes()
    start = clamp(start, 0, 24 * 60)
    end = clamp(end, 0, 24 * 60)
    return { start, end }
  }).filter(r => r.end > r.start)

  const free = minusBusy(open, busyRanges)

  // If the requested date is today (in Warsaw), hide past slots:
  // allow only starts from the next full hour.
  let minStartMin = 0
  const nowLocal = toZonedTime(new Date(), TZ)
  const todayISO = isoDate(nowLocal)
  if (dateISO === todayISO) {
    minStartMin = (nowLocal.getHours() + 1) * 60
  }

  // Build slots with step alignment
  const slots: { startISO: string; endISO: string }[] = []
  for (const r of free) {
    const windowStart = Math.max(r.start, minStartMin)
    let start = Math.ceil(windowStart / stepMin) * stepMin
    while (start + minDuration <= r.end) {
      const end = start + minDuration
      const hhS = String(Math.floor(start / 60)).padStart(2, '0')
      const mmS = String(start % 60).padStart(2, '0')
      const hhE = String(Math.floor(end / 60)).padStart(2, '0')
      const mmE = String(end % 60).padStart(2, '0')
      const localStartStr = `${dateISO}T${hhS}:${mmS}:00`
      const localEndStr = `${dateISO}T${hhE}:${mmE}:00`
      const startUtc = fromZonedTime(localStartStr, TZ)
      const endUtc = fromZonedTime(localEndStr, TZ)
      const startISO = formatInTimeZone(startUtc, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
      const endISO = formatInTimeZone(endUtc, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
      slots.push({ startISO, endISO })
      start += stepMin
    }
  }
  return { slots }
}
