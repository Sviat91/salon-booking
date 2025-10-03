import { createHash } from 'crypto'
import { formatInTimeZone } from 'date-fns-tz'

import { config } from '../env'
import { getClients } from './auth'
import { getLogger } from '../logger'
import { normalizePhoneDigitsOnly } from '../utils/phone-normalization'
import { normalizeNameForMatching, normalizeEmailForMatching } from '../utils/string-normalization'

const logger = getLogger({ module: 'google.consent-utils' })

export const PHONE_MASK_SALT = 'gdpr_withdraw_salt_v1'
const WARSAW_TZ = 'Europe/Warsaw'

export const DEFAULT_COLUMN_INDEX = {
  phone: 0,
  email: 1,
  name: 2,
  consentDate: 3,
  ipHash: 4,
  privacy: 5,
  terms: 6,
  notifications: 7,
  withdrawnDate: 8,
  withdrawalMethod: 9,
  requestErasureDate: 10, // K column
  erasureDate: 11,       // L column
  erasureMethod: 12,     // M column
} as const

export type ConsentColumnKey = keyof typeof DEFAULT_COLUMN_INDEX
export type ConsentColumnMap = Record<ConsentColumnKey, number>

const COLUMN_HINTS: Record<ConsentColumnKey, string[]> = {
  phone: ['phone', 'telefon'],
  email: ['email', 'mail'],
  name: ['name', 'imię', 'nazwisko'],
  consentDate: ['consentdate', 'timestamp', 'created', 'date'],
  ipHash: ['iphash', 'ip', 'address'],
  privacy: ['consentprivacy', 'privacy'],
  terms: ['consentterms', 'terms'],
  notifications: ['consentnotifications', 'notifications'],
  withdrawnDate: ['consentwithdrawn', 'withdrawn', 'withdrawaldate'],
  withdrawalMethod: ['withdrawalmethod', 'withdrawnmethod'],
  requestErasureDate: ['requesterasuredate', 'erasurerequest', 'erasurereqdate', 'requesterasure', 'requestera'],
  erasureDate: ['erasuredate', 'dateerasure', 'erased', 'erasure', 'erasureda'],
  erasureMethod: ['erasuremethod', 'methoderasure', 'erasedby'],
}

const REQUIRED_COLUMNS: ConsentColumnKey[] = [
  'phone',
  'name',
  'consentDate',
  'privacy',
  'terms',
  'withdrawnDate',
]

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function resolveConsentColumns(headerRow: string[] | undefined): ConsentColumnMap | null {
  if (!headerRow || !headerRow.length) {
    logger.error('[resolveConsentColumns] Missing header row for consent sheet')
    return null
  }

  const normalizedHeader = headerRow.map(cell => normalizeHeader(String(cell ?? '')))
  const columnMap = Object.fromEntries(
    (Object.keys(DEFAULT_COLUMN_INDEX) as ConsentColumnKey[]).map(key => [key, -1])
  ) as ConsentColumnMap

  ;(Object.keys(COLUMN_HINTS) as ConsentColumnKey[]).forEach(key => {
    const hints = COLUMN_HINTS[key]
    const resolvedIdx = normalizedHeader.findIndex(headerCell =>
      hints.some(hint => headerCell === hint || headerCell.includes(hint))
    )
    if (resolvedIdx >= 0) {
      columnMap[key] = resolvedIdx
    }
  })

  ;(Object.keys(DEFAULT_COLUMN_INDEX) as ConsentColumnKey[]).forEach(key => {
    if (columnMap[key] === -1) {
      const fallbackIdx = DEFAULT_COLUMN_INDEX[key]
      if (fallbackIdx < headerRow.length) {
        columnMap[key] = fallbackIdx
      }
    }
  })

  const missingRequired = REQUIRED_COLUMNS.filter(col => columnMap[col] < 0 || columnMap[col] >= headerRow.length)
  if (missingRequired.length) {
    logger.error({
      missing: missingRequired,
      header: headerRow,
    }, '[resolveConsentColumns] Missing required consent columns')
    return null
  }

  return columnMap
}

export function nowInWarsawISO(date: Date = new Date()): string {
  return formatInTimeZone(date, WARSAW_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

/**
 * Normalize phone for Google Sheets storage
 * @deprecated Use normalizePhoneDigitsOnly from utils/phone-normalization instead
 */
export function normalizePhoneForSheet(phone: string): string {
  return normalizePhoneDigitsOnly(phone ?? '')
}

/**
 * Normalize name for consent matching
 * @deprecated Use normalizeNameForMatching from utils/string-normalization instead
 */
export function normalizeName(name: string): string {
  return normalizeNameForMatching(name)
}

export function maskPhoneHash(phone: string): string {
  const normalized = normalizePhoneForSheet(phone) || 'unknown'
  return createHash('sha256')
    .update(PHONE_MASK_SALT)
    .update(':')
    .update(normalized)
    .digest('hex')
    .slice(0, 16)
}

export function maskEmailHash(email: string): string {
  if (!email) return 'unknown'
  const normalized = normalizeEmailForMatching(email)
  return createHash('sha256')
    .update(PHONE_MASK_SALT)
    .update(':email:')
    .update(normalized)
    .digest('hex')
    .slice(0, 16)
}

export function hashPhoneForErasure(phone: string): string {
  const normalized = normalizePhoneForSheet(phone) || 'unknown'
  return createHash('sha256')
    .update('erasure_salt_v1') // dedicated salt for erasure
    .update(':')
    .update(normalized)
    .digest('hex')
    .slice(0, 16)
}

export function trimToSheetLimit(value: string, max = 500): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value
}

export function hashIpPartially(ip: string): string {
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.xxx'
  }
  const parts = ip.split('.')
  if (parts.length === 4) {
    const visible = parts.slice(0, 3).join('.')
    return `${visible}.xxx`
  }
  if (ip.includes(':')) {
    const segments = ip.split(':')
    if (segments.length >= 2) {
      return `${segments[0]}:${segments[1]}:xxxx:xxxx`
    }
  }
  return 'xxx.xxx.xxx.xxx'
}

export function columnIndexToLetter(index: number): string {
  let idx = index + 1
  let letters = ''
  while (idx > 0) {
    const remainder = (idx - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    idx = Math.floor((idx - 1) / 26)
  }
  return letters
}

export function parseConsentTimestamp(value?: string): number {
  if (!value) return Number.NaN
  let cleaned = value.trim().replace(/^'+|'+$/g, '')
  if (!cleaned) return Number.NaN
  cleaned = cleaned.replace(/\s+/g, ' ')
  if (!cleaned.includes('T') && cleaned.includes(' ')) {
    cleaned = cleaned.replace(' ', 'T')
  }
  const tzMatch = cleaned.match(/([+-])(\d{2})(:?)(\d{0,2})$/)
  if (tzMatch) {
    const [, sign, hours, colon, minutesRaw] = tzMatch
    let minutes = minutesRaw || ''
    if (!colon) {
      if (minutes.length === 0) minutes = '00'
      if (minutes.length === 1) minutes = `0${minutes}`
      if (minutes.length > 2) minutes = minutes.slice(0, 2)
      cleaned = cleaned.replace(tzMatch[0], `${sign}${hours}:${minutes}`)
    }
  } else if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(cleaned)) {
    cleaned = `${cleaned}${cleaned.endsWith('Z') ? '' : 'Z'}`
  }
  const ts = Date.parse(cleaned)
  if (!Number.isNaN(ts)) return ts
  const fallback = Date.parse(cleaned.replace(/ /g, 'T'))
  return Number.isNaN(fallback) ? Number.NaN : fallback
}

export function sortMatchesByRecency(a: { consentTimestamp: number; index: number }, b: { consentTimestamp: number; index: number }) {
  const aValid = Number.isFinite(a.consentTimestamp)
  const bValid = Number.isFinite(b.consentTimestamp)

  if (aValid && bValid) {
    if (a.consentTimestamp !== b.consentTimestamp) {
      return b.consentTimestamp - a.consentTimestamp
    }
    return b.index - a.index
  }

  if (aValid && !bValid) return -1
  if (!aValid && bValid) return 1

  return b.index - a.index
}

export async function getConsentValues() {
  const { sheets } = getClients()
  const range = 'A:Z'
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.USER_CONSENTS_GOOGLE_SHEET_ID,
    range,
  })
  const rows = res.data.values ?? []
  if (!rows.length) {
    return { header: [] as string[], rows: [] as string[][] }
  }
  const [header, ...data] = rows
  return {
    header,
    rows: data.map(row => (row || []).map(cell => String(cell ?? ''))),
  }
}

export function maskPhoneForLog(phone: string) {
  if (!phone) return 'unknown'
  const visiblePrefix = phone.slice(0, 3)
  const visibleSuffix = phone.slice(-2)
  return `${visiblePrefix}***${visibleSuffix}`
}

