import { config } from '../../env'
import { getLogger } from '../../logger'
import { getClients } from '../auth'
import {
  hashIpPartially,
  normalizePhoneForSheet,
  nowInWarsawISO,
} from '../consent-utils'
import type { UserConsent } from '../types'

const logger = getLogger({ module: 'google.consents.save' })

export async function saveUserConsent(consent: Omit<UserConsent, 'consentDate' | 'ipHash'> & { ip: string }): Promise<void> {
  const { sheets } = getClients()

  const now = nowInWarsawISO()
  const ipHash = hashIpPartially(consent.ip)
  const normalizedPhone = normalizePhoneForSheet(consent.phone)

  const values = [[
    normalizedPhone,
    consent.email || '',
    consent.name,
    now,
    ipHash,
    consent.consentPrivacyV10 ? 'TRUE' : 'FALSE',
    consent.consentTermsV10 ? 'TRUE' : 'FALSE',
    consent.consentNotificationsV10 ? 'TRUE' : 'FALSE',
    '',
    '',
  ]]

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.USER_CONSENTS_GOOGLE_SHEET_ID,
    range: 'A:J',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values,
    },
  })
}
