import { config } from '../env'
import { getClients } from './auth'

export async function readProcedures() {
  const { sheets } = getClients()
  const range = `${config.SHEET_TABS.PROCEDURES}!A1:Z1000`
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: config.GOOGLE_SHEET_ID, range })
  return parseProcedures(res.data.values ?? [])
}

type Procedure = {
  id: string
  name_pl: string
  name_ru?: string
  category?: string
  duration_min: number
  price_pln?: number
  is_active: boolean
  order?: number
}

function parseProcedures(rows: any[][]): Procedure[] {
  if (!rows.length) return []
  const [headerRaw, ...rest] = rows
  const header = headerRaw.map(h => String(h ?? '').trim().toLowerCase())

  const find = (re: RegExp) => header.findIndex(h => re.test(h))
  const gi = {
    id: find(/^id$/),
    name_pl: (() => {
      const i = find(/name.*procedure|name_pl|name|nazwa/)
      return i
    })(),
    name_ru: find(/name_ru/),
    category: find(/category|kategoria/),
    duration_min: (() => {
      const i = find(/duration|czas|min/)
      return i
    })(),
    price_pln: find(/price|pln|cena/),
    is_active: find(/is.?active|active|aktyw/),
    order: find(/order|sort/),
  }

  const asBool = (v: any) => {
    const s = String(v ?? '').trim().toLowerCase()
    return s === 'yes' || s === '1' || s === 'true' || s === 'y'
  }
  const parseDuration = (v: any) => {
    const s = String(v ?? '').trim()
    if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(s)) {
      const [h, m] = s.split(':').map(Number); return h * 60 + m
    }
    const num = parseInt(s.replace(/\D/g, ''), 10)
    return Number.isFinite(num) && num > 0 ? num : 30
  }
  const asNum = (v: any) => Number.parseInt(String(v ?? '').replace(/\D/g, ''), 10) || 0

  const out: Procedure[] = []
  rest.forEach((r, idxRow) => {
    const name = gi.name_pl >= 0 ? String(r[gi.name_pl] ?? '').trim() : ''
    const duration = gi.duration_min >= 0 ? parseDuration(r[gi.duration_min]) : 30
    if (!name) return // skip empty
    const id = (gi.id >= 0 ? String(r[gi.id] ?? '').trim() : `${name}-${duration}`).slice(0, 100)
    out.push({
      id,
      name_pl: name,
      name_ru: gi.name_ru >= 0 ? String(r[gi.name_ru] ?? '') : undefined,
      category: gi.category >= 0 ? String(r[gi.category] ?? '') : undefined,
      duration_min: duration,
      price_pln: gi.price_pln >= 0 ? asNum(r[gi.price_pln]) : undefined,
      is_active: gi.is_active >= 0 ? asBool(r[gi.is_active]) : true,
      order: gi.order >= 0 ? asNum(r[gi.order]) : idxRow + 1,
    })
  })
  return out
}

// Weekly schedule: columns like [Weekday, Working Hours, Is Day Off]
export type DayRange = { start: string; end: string }
export type WeeklyMap = Record<string, { hours: string; isDayOff: boolean }>

export async function readWeekly(): Promise<WeeklyMap> {
  const { sheets } = getClients()
  const range = `${config.SHEET_TABS.WEEKLY}!A1:Z1000`
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: config.GOOGLE_SHEET_ID, range })
  const rows = res.data.values ?? []
  if (!rows.length) return {}

  // Some sheets have a merged title row above the real headers.
  // Find the first row that looks like headers (contains Weekday + Hours/Day Off).
  const normRow = (row: any[]) => row.map(c => String(c ?? '').replace(/\u00A0/g, ' ').trim().toLowerCase())
  let headerIdx = 0
  let gi = { weekday: -1, hours: -1, dayoff: -1 }
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const hdr = normRow(rows[i] as any[])
    const find = (pred: (s: string) => boolean) => hdr.findIndex(pred)
    const w = find(s => s.includes('weekday') || s.includes('week day') || s === 'weekday' || s === 'day')
    const h = find(s => s.includes('working') || s.includes('work') || s.includes('hours') || s.includes('godziny'))
    const d = find(s => s.includes('day off') || s.includes('closed') || s.includes('off') || s.includes('wolne'))
    if (w >= 0 && (h >= 0 || d >= 0)) { headerIdx = i; gi = { weekday: w, hours: h, dayoff: d }; break }
  }
  if (gi.weekday < 0) return {}

  const items = rows.slice(headerIdx + 1)
  const isYes = (v: any) => String(v ?? '').replace(/\u00A0/g, ' ').trim().toLowerCase() === 'yes' || String(v ?? '').trim() === '1' || String(v ?? '').trim().toLowerCase() === 'true'
  const norm = (s: any) => String(s ?? '').replace(/\u00A0/g, ' ').trim().toLowerCase()
  const weekly: WeeklyMap = {}
  for (const r of items) {
    const row = (r as any[]) || []
    const k = norm(row[gi.weekday]) // monday, ...
    if (!k || k === 'weekday') continue // skip accidental header rows
    weekly[k] = {
      hours: String(row[gi.hours] ?? '').replace(/\u00A0/g, ' ').trim(),
      isDayOff: isYes(row[gi.dayoff]),
    }
  }
  return weekly
}

export type ExceptionsMap = Record<string, { hours: string; isDayOff: boolean }>

export async function readExceptions(): Promise<ExceptionsMap> {
  const { sheets } = getClients()
  const range = `${config.SHEET_TABS.EXCEPTIONS}!A1:Z1000`
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: config.GOOGLE_SHEET_ID, range })
  const rows = res.data.values ?? []
  if (!rows.length) return {}

  const normRow = (row: any[]) => row.map(c => String(c ?? '').replace(/\u00A0/g, ' ').trim().toLowerCase())
  let headerIdx = 0
  let gi = { date: -1, hours: -1, dayoff: -1 }
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const hdr = normRow(rows[i] as any[])
    const find = (pred: (s: string) => boolean) => hdr.findIndex(pred)
    const date = find(s => s.includes('date') || s.includes('data'))
    const hours = find(s => s.includes('working') || s.includes('work') || s.includes('hours') || s.includes('special') || s.includes('godziny'))
    const dayoff = find(s => s.includes('day off') || s.includes('closed') || s.includes('off') || s.includes('wolne'))
    if (date >= 0 && (hours >= 0 || dayoff >= 0)) { headerIdx = i; gi = { date, hours, dayoff }; break }
  }
  if (gi.date < 0) return {}

  const items = rows.slice(headerIdx + 1)
  const isYes = (v: any) => String(v ?? '').replace(/\u00A0/g, ' ').trim().toLowerCase() === 'yes' || String(v ?? '').trim() === '1' || String(v ?? '').trim().toLowerCase() === 'true'
  const normDate = (s: any) => String(s ?? '').replace(/\u00A0/g, ' ').trim().slice(0, 10)
  const ex: ExceptionsMap = {}
  for (const r of items) {
    const row = (r as any[]) || []
    const d = normDate(row[gi.date])
    if (!d || d.toLowerCase() === 'date') continue // skip accidental header rows
    ex[d] = { hours: String(row[gi.hours] ?? '').replace(/\u00A0/g, ' ').trim(), isDayOff: isYes(row[gi.dayoff]) }
  }
  return ex
}
