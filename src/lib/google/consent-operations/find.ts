import { getLogger } from '../../logger'
import {
  getConsentValues,
  normalizeName,
  normalizePhoneForSheet,
  parseConsentTimestamp,
  resolveConsentColumns,
  sortMatchesByRecency,
} from '../consent-utils'
import type { UserConsent, ConsentRowMatch } from '../types'

const logger = getLogger({ module: 'google.consents.find' })

export async function findUserConsent(phone: string, name: string, email?: string): Promise<UserConsent | null> {
  try {
    const normalizedPhone = normalizePhoneForSheet(phone)
    const normalizedName = normalizeName(name)
    const normalizedEmail = email ? email.toLowerCase().trim() : ''

    const { header, rows } = await getConsentValues()
    if (!rows.length) return null

    const columns = resolveConsentColumns(header)
    if (!columns) return null

    const matches: ConsentRowMatch[] = []

    rows.forEach((row, index) => {
      const rowPhoneRaw = row[columns.phone]?.trim() ?? ''
      const rowEmailRaw = row[columns.email]?.trim() ?? ''
      const rowNameRaw = row[columns.name]?.trim() ?? ''

      const normalizedRowPhone = normalizePhoneForSheet(rowPhoneRaw)
      const normalizedRowName = normalizeName(rowNameRaw)
      const normalizedRowEmail = rowEmailRaw.toLowerCase()

      const phoneMatch = normalizedRowPhone === normalizedPhone
      const nameMatch = normalizedRowName === normalizedName

      let emailMatch = true
      if (normalizedEmail && normalizedRowEmail) {
        emailMatch = normalizedRowEmail === normalizedEmail
      }

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
          email: rowEmailRaw || undefined,
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

    if (!matches.length) return null

    const activeMatches = matches.filter(m => !m.isWithdrawn)

    if (activeMatches.length) {
      activeMatches.sort(sortMatchesByRecency)
      return activeMatches[0].consent
    }

    matches.sort(sortMatchesByRecency)
    return matches[0].consent
  } catch (err) {
    logger.error({ err }, '[findUserConsent] Failed to read consent')
    return null
  }
}

export async function findUserConsentByPhone(phone: string): Promise<UserConsent | null> {
  logger.warn('⚠️ findUserConsentByPhone is deprecated, use findUserConsent(phone, name) for better security')
  return null
}

export async function hasValidConsent(phone: string, name: string, email?: string): Promise<boolean> {
  const consent = await findUserConsent(phone, name, email)
  if (!consent) return false
  if (consent.consentWithdrawnDate) return false
  return consent.consentPrivacyV10 && consent.consentTermsV10
}
