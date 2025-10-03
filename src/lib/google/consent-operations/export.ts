import { getLogger } from '../../logger'
import {
  getConsentValues,
  normalizeName,
  normalizePhoneForSheet,
  nowInWarsawISO,
  parseConsentTimestamp,
  resolveConsentColumns,
  sortMatchesByRecency,
} from '../consent-utils'
import type { UserDataExport, ConsentRowMatch } from '../types'

const logger = getLogger({ module: 'google.consents.export' })

export interface ExportUserDataOptions {
  phone: string
  name: string
  email?: string
  requestId?: string
}

export type ExportOutcome = { exportedData: UserDataExport | null; reason?: 'NOT_FOUND' | 'ANONYMIZED' }

export async function exportUserData(options: ExportUserDataOptions): Promise<ExportOutcome> {
  const { phone, name, email, requestId } = options
  const normalizedPhone = normalizePhoneForSheet(phone)
  const normalizedName = normalizeName(name)
  const normalizedEmail = email?.trim().toLowerCase() ?? ''

  const { header, rows } = await getConsentValues()
  if (!rows.length) {
    return { exportedData: null, reason: 'NOT_FOUND' }
  }

  const columns = resolveConsentColumns(header)
  if (!columns) {
    return { exportedData: null, reason: 'NOT_FOUND' }
  }

  const matches: ConsentRowMatch[] = []
  rows.forEach((row, index) => {
    const rowPhoneRaw = row[columns.phone]?.trim() ?? ''
    const rowEmailRaw = row[columns.email]?.trim() ?? ''
    const rowNameRaw = row[columns.name]?.trim() ?? ''

    const isPhoneHashed = rowPhoneRaw.length === 16 && /^[a-f0-9]{16}$/.test(rowPhoneRaw)
    if (isPhoneHashed) return // Skip anonymized records for matching

    const phoneMatch = normalizePhoneForSheet(rowPhoneRaw) === normalizedPhone
    const nameMatch = normalizeName(rowNameRaw) === normalizedName
    const emailMatch = !normalizedEmail || !rowEmailRaw ? true : rowEmailRaw.toLowerCase() === normalizedEmail

    if (!phoneMatch || !nameMatch || !emailMatch) return

    const consentDate = row[columns.consentDate]?.trim() ?? ''
    matches.push({
      index,
      row,
      consent: {
        phone: rowPhoneRaw,
        email: rowEmailRaw || undefined,
        name: rowNameRaw,
        consentDate,
        ipHash: columns.ipHash >= 0 ? row[columns.ipHash]?.trim() ?? '' : '',
        consentPrivacyV10: String(row[columns.privacy] || '').trim().toUpperCase() === 'TRUE',
        consentTermsV10: String(row[columns.terms] || '').trim().toUpperCase() === 'TRUE',
        consentNotificationsV10: columns.notifications >= 0 ? String(row[columns.notifications] || '').trim().toUpperCase() === 'TRUE' : false,
        consentWithdrawnDate: columns.withdrawnDate >= 0 ? row[columns.withdrawnDate]?.trim() || undefined : undefined,
        withdrawalMethod: columns.withdrawalMethod >= 0 ? row[columns.withdrawalMethod]?.trim() || undefined : undefined,
      },
      isWithdrawn: !!(columns.withdrawnDate >= 0 && row[columns.withdrawnDate]?.trim()),
      consentTimestamp: parseConsentTimestamp(consentDate),
    })
  })

  if (!matches.length) {
    return { exportedData: null, reason: 'NOT_FOUND' }
  }

  matches.sort(sortMatchesByRecency)

  const latestRecord = matches[0].consent

  const exportPayload: UserDataExport = {
    personalData: {
      name: latestRecord.name,
      phone: latestRecord.phone,
      email: latestRecord.email,
    },
    consentHistory: matches.map(m => ({
      consentDate: m.consent.consentDate,
      ipHash: m.consent.ipHash,
      privacyV10: m.consent.consentPrivacyV10,
      termsV10: m.consent.consentTermsV10,
      notificationsV10: m.consent.consentNotificationsV10,
      withdrawnDate: m.consent.consentWithdrawnDate,
      withdrawalMethod: m.consent.withdrawalMethod,
    })),
    isAnonymized: false, // If we found matches, it's not anonymized
    exportTimestamp: nowInWarsawISO(),
  }

  return { exportedData: exportPayload }
}
