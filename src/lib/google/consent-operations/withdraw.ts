import { config } from '../../env'
import { getLogger } from '../../logger'
import { getClients } from '../auth'
import {
  columnIndexToLetter,
  getConsentValues,
  maskEmailHash,
  maskPhoneHash,
  normalizeName,
  normalizePhoneForSheet,
  nowInWarsawISO,
  parseConsentTimestamp,
  resolveConsentColumns,
  trimToSheetLimit,
} from '../consent-utils'
import type { ConsentRowMatch } from '../types'

const logger = getLogger({ module: 'google.consents.withdraw' })

export interface UpdateConsentWithdrawalOptions {
  phone: string
  name: string
  email?: string
  withdrawalMethod: 'support_form' | 'manual' | string
  requestId?: string
}

export type WithdrawOutcome = {
  updated: boolean
  reason?: 'NOT_FOUND' | 'MULTIPLE_MATCHES'
  incident?: string
}

export async function withdrawUserConsent(options: UpdateConsentWithdrawalOptions): Promise<WithdrawOutcome> {
  const { phone, name, email, withdrawalMethod, requestId } = options
  const normalizedPhone = normalizePhoneForSheet(phone)
  const normalizedName = normalizeName(name)
  const normalizedEmail = email?.trim().toLowerCase() ?? ''

  const { header, rows } = await getConsentValues()
  if (!rows.length) {
    logger.warn({ requestId }, '[withdrawUserConsent] No consent rows found')
    return { updated: false, reason: 'NOT_FOUND' }
  }

  const columns = resolveConsentColumns(header)
  if (!columns) {
    logger.error({ requestId }, '[withdrawUserConsent] Cannot resolve columns')
    return { updated: false, reason: 'NOT_FOUND' }
  }

  const matches: ConsentRowMatch[] = []

  rows.forEach((rawRow, index) => {
    const row = [...rawRow]
    const rowPhoneRaw = row[columns.phone]?.trim() ?? ''
    const rowEmailRaw = row[columns.email]?.trim().toLowerCase() ?? ''
    const rowNameRaw = row[columns.name]?.trim() ?? ''

    const phoneMatch = normalizePhoneForSheet(rowPhoneRaw) === normalizedPhone
    const nameMatch = normalizeName(rowNameRaw) === normalizedName
    const emailMatch = !normalizedEmail || !rowEmailRaw ? true : rowEmailRaw === normalizedEmail

    if (!phoneMatch || !nameMatch || !emailMatch) return

    const consentDate = row[columns.consentDate]?.trim() ?? ''
    const consentWithdrawnDate = columns.withdrawnDate >= 0 ? row[columns.withdrawnDate]?.trim() || undefined : undefined
    const consentPrivacy = String(row[columns.privacy] || '').trim().toUpperCase() === 'TRUE'
    const consentTerms = String(row[columns.terms] || '').trim().toUpperCase() === 'TRUE'
    const notificationsIdx = columns.notifications
    const consentNotifications = notificationsIdx >= 0
      ? String(row[notificationsIdx] || '').trim().toUpperCase() === 'TRUE'
      : false

    matches.push({
      index,
      row,
      consent: {
        phone: rowPhoneRaw,
        email: row[columns.email]?.trim() || undefined,
        name: rowNameRaw,
        consentDate,
        ipHash: columns.ipHash >= 0 ? row[columns.ipHash]?.trim() ?? '' : '',
        consentPrivacyV10: consentPrivacy,
        consentTermsV10: consentTerms,
        consentNotificationsV10: consentNotifications,
        consentWithdrawnDate,
        withdrawalMethod: columns.withdrawalMethod >= 0 ? row[columns.withdrawalMethod]?.trim() || undefined : undefined,
      },
      isWithdrawn: Boolean(consentWithdrawnDate),
      consentTimestamp: parseConsentTimestamp(consentDate),
    })
  })

  if (!matches.length) {
    logger.warn({
      requestId,
      phone: maskPhoneHash(normalizedPhone),
      email: normalizedEmail ? maskEmailHash(normalizedEmail) : undefined,
      name: normalizedName,
    }, '[withdrawUserConsent] Consent not found')
    return { updated: false, reason: 'NOT_FOUND' }
  }

  const activeConsents = matches.filter(m => {
    const hasActivePrivacy = m.consent.consentPrivacyV10
    const hasActiveTerms = m.consent.consentTermsV10
    const notWithdrawn = !m.consent.consentWithdrawnDate
    return hasActivePrivacy && hasActiveTerms && notWithdrawn
  })

  logger.info({
    requestId,
    phone: maskPhoneHash(normalizedPhone),
    totalMatches: matches.length,
    activeConsents: activeConsents.length,
    activeConsentDetails: activeConsents.map(m => ({
      consentDate: m.consent.consentDate,
      privacy: m.consent.consentPrivacyV10,
      terms: m.consent.consentTermsV10,
      withdrawnDate: m.consent.consentWithdrawnDate || 'НЕТ',
    })),
  }, '[withdrawUserConsent] Found consents')

  if (activeConsents.length === 0) {
    logger.warn({
      requestId,
      phone: maskPhoneHash(normalizedPhone),
      totalRecords: matches.length,
    }, '[withdrawUserConsent] No active consents found - already withdrawn or invalid data')
    return { updated: false, reason: 'NOT_FOUND' }
  }

  if (activeConsents.length > 1) {
    logger.error({
      requestId,
      phone: maskPhoneHash(normalizedPhone),
      activeConsents: activeConsents.length,
    }, '[withdrawUserConsent] Multiple active consents found - data integrity issue')
    return { updated: false, reason: 'MULTIPLE_MATCHES' }
  }

  const target = activeConsents[0]
  const rowIndex = target.index
  const row = [...target.row]

  if (columns.privacy >= 0) row[columns.privacy] = 'FALSE'
  if (columns.terms >= 0) row[columns.terms] = 'FALSE'
  if (columns.notifications >= 0) row[columns.notifications] = 'FALSE'
  if (columns.withdrawnDate >= 0) row[columns.withdrawnDate] = nowInWarsawISO()
  if (columns.withdrawalMethod >= 0) row[columns.withdrawalMethod] = trimToSheetLimit(withdrawalMethod)

  const writableIndices = [
    columns.privacy,
    columns.terms,
    columns.notifications,
    columns.withdrawnDate,
    columns.withdrawalMethod,
  ].filter(idx => idx >= 0)

  const maxColIdx = writableIndices.length ? Math.max(...writableIndices) : columns.withdrawnDate
  const rowNumber = rowIndex + 2
  const endColumn = columnIndexToLetter(maxColIdx >= 0 ? maxColIdx : columns.withdrawnDate)
  const updateRange = `A${rowNumber}:${endColumn}${rowNumber}`

  const { sheets } = getClients()

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.USER_CONSENTS_GOOGLE_SHEET_ID,
    range: updateRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [row],
    },
  })

  logger.info({
    requestId,
    phone: maskPhoneHash(normalizedPhone),
    rowIndex: rowNumber,
  }, '[withdrawUserConsent] Google Sheets updated successfully')

  return { updated: true }
}
