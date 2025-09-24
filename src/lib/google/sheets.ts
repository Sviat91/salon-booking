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

// === USER CONSENTS FUNCTIONS ===

/**
 * User consent record structure based on the Google Sheets format
 */
export interface UserConsent {
  phone: string // Column A
  email?: string // Column B (optional)
  name: string // Column C
  consentDate: string // Column D (ISO date string)
  ipHash: string // Column E (partially masked IP)
  consentPrivacyV10: boolean // Column F
  consentTermsV10: boolean // Column G  
  consentNotificationsV10: boolean // Column H
  consentWithdrawnDate?: string // Column I (ISO date string, empty if not withdrawn)
  withdrawalMethod?: string // Column J (empty if not withdrawn)
}

/**
 * Hash IP address partially for privacy compliance
 * Shows first 3 octets, masks last octet: 192.168.1.123 → 192.168.1.xxx
 */
function hashIpPartially(ip: string): string {
  // Handle IPv6 localhost
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.xxx'
  }
  
  // Handle IPv4
  const parts = ip.split('.')
  if (parts.length === 4) {
    const visible = parts.slice(0, 3).join('.') // Show first 3 octets
    return `${visible}.xxx` // Hide only last octet
  }
  
  // Handle IPv6 (simplify to avoid complexity)
  if (ip.includes(':')) {
    const parts = ip.split(':')
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:xxxx:xxxx`
    }
  }
  
  return 'xxx.xxx.xxx.xxx' // fallback for invalid IPs
}

/**
 * Save user consent to Google Sheets
 */
export async function saveUserConsent(consent: Omit<UserConsent, 'consentDate' | 'ipHash'> & { ip: string }): Promise<void> {
  const { sheets } = getClients()
  
  const now = new Date().toISOString()
  const ipHash = hashIpPartially(consent.ip)
  
  // Normalize phone for consistent storage (remove + and spaces)
  const normalizedPhone = consent.phone.replace(/[\s\+\-\(\)]/g, '')
  
  const values = [
    [
      normalizedPhone, // A - store phone without + and spaces
      consent.email || '', // B - email (optional)
      consent.name, // C - name
      now, // D - consent_date
      ipHash, // E - ip_hash
      consent.consentPrivacyV10 ? 'TRUE' : 'FALSE', // F - consent_privacy_v1.0
      consent.consentTermsV10 ? 'TRUE' : 'FALSE', // G - consent_terms_v1.0
      consent.consentNotificationsV10 ? 'TRUE' : 'FALSE', // H - consent_notifications_v1_0
      '', // I (withdrawn date - empty for new consents)
      '', // J (withdrawal method - empty for new consents)
    ]
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.USER_CONSENTS_GOOGLE_SHEET_ID,
    range: 'A:J', // Обновлен диапазон для новой структуры
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values
    }
  })
}

/**
 * Normalize name for comparison (remove extra spaces, lowercase)
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Find existing consent by phone number, name and optionally email for better security
 */
export async function findUserConsent(phone: string, name: string, email?: string): Promise<UserConsent | null> {
  const { sheets } = getClients()
  
  try {
    // Normalize inputs
    const normalizedPhone = phone.replace(/[\s\+\-\(\)]/g, '')
    const normalizedName = normalizeName(name)
    const normalizedEmail = email ? email.toLowerCase().trim() : ''
    
    const range = 'A:J' // Обновлен диапазон для новой структуры
    const res = await sheets.spreadsheets.values.get({ 
      spreadsheetId: config.USER_CONSENTS_GOOGLE_SHEET_ID, 
      range 
    })
    
    const rows = res.data.values ?? []
    if (rows.length <= 1) return null // No data or only headers
    
    // Skip header row and find matching phone AND name (AND email if provided)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || []
      const rowPhone = String(row[0] || '').trim()
      const rowEmail = String(row[1] || '').trim() 
      const rowName = String(row[2] || '').trim()
      
      const normalizedRowPhone = rowPhone.replace(/[\s\+\-\(\)]/g, '')
      const normalizedRowName = normalizeName(rowName)
      const normalizedRowEmail = rowEmail.toLowerCase().trim()
      
      // Phone AND name must match for security
      const phoneMatch = normalizedRowPhone === normalizedPhone
      const nameMatch = normalizedRowName === normalizedName
      
      // Email match (if provided by user and exists in record)
      let emailMatch = true // Default to true if no email validation needed
      if (normalizedEmail && normalizedRowEmail) {
        emailMatch = normalizedRowEmail === normalizedEmail
      }
      
      if (phoneMatch && nameMatch && emailMatch) {
        return {
          phone: rowPhone,
          email: rowEmail || undefined,
          name: rowName,
          consentDate: String(row[3] || '').trim(),
          ipHash: String(row[4] || '').trim(),
          consentPrivacyV10: String(row[5] || '').trim().toUpperCase() === 'TRUE',
          consentTermsV10: String(row[6] || '').trim().toUpperCase() === 'TRUE',
          consentNotificationsV10: String(row[7] || '').trim().toUpperCase() === 'TRUE',
          consentWithdrawnDate: String(row[8] || '').trim() || undefined,
          withdrawalMethod: String(row[9] || '').trim() || undefined,
        }
      }
    }
    return null
  } catch (err) {
    console.error('Error finding user consent:', err)
    return null
  }
}

/**
 * Find existing consent by phone number (legacy function for backward compatibility)
 */
export async function findUserConsentByPhone(phone: string): Promise<UserConsent | null> {
  console.warn('⚠️ findUserConsentByPhone is deprecated, use findUserConsent(phone, name) for better security')
  // For now, return null to force showing consent modal
  return null
}

/**
 * Check if user has valid (non-withdrawn) consent
 */
export async function hasValidConsent(phone: string, name: string, email?: string): Promise<boolean> {
  const consent = await findUserConsent(phone, name, email)
  if (!consent) return false
  
  // Check if consent was withdrawn
  if (consent.consentWithdrawnDate) return false
  
  // Check if required consents are given (privacy AND terms required)
  return consent.consentPrivacyV10 && consent.consentTermsV10
}