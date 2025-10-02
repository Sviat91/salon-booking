import { config } from '../env'
import { getLogger } from '../logger'
import { getClients } from './auth'
import {
  columnIndexToLetter,
  getConsentValues,
  hashIpPartially,
  hashPhoneForErasure,
  maskEmailHash,
  maskPhoneHash,
  normalizeName,
  normalizePhoneForSheet,
  nowInWarsawISO,
  parseConsentTimestamp,
  resolveConsentColumns,
  sortMatchesByRecency,
  trimToSheetLimit,
} from './consent-utils'

const logger = getLogger({ module: 'google.consents' })

export interface UserConsent {
  phone: string
  email?: string
  name: string
  consentDate: string
  ipHash: string
  consentPrivacyV10: boolean
  consentTermsV10: boolean
  consentNotificationsV10: boolean
  consentWithdrawnDate?: string
  withdrawalMethod?: string
}

type ConsentRowMatch = {
  index: number
  row: string[]
  consent: UserConsent
  isWithdrawn: boolean
  consentTimestamp: number
}

export { normalizePhoneForSheet } from './consent-utils'

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

interface UpdateConsentWithdrawalOptions {
  phone: string
  name: string
  email?: string
  withdrawalMethod: 'support_form' | 'manual' | string
  requestId?: string
}

type WithdrawOutcome = {
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

interface EraseUserDataOptions {
  phone: string
  name: string
  email?: string
  erasureMethod: 'support_form' | 'manual' | string
  requestId?: string
}

type EraseOutcome = {
  erased: boolean
  reason?: 'NOT_FOUND' | 'ALREADY_ERASED'
  incident?: string
}

export async function eraseUserData(options: EraseUserDataOptions): Promise<EraseOutcome> {
  const { phone, name, email, erasureMethod, requestId } = options
  const normalizedPhone = normalizePhoneForSheet(phone)
  const normalizedName = normalizeName(name)
  const normalizedEmail = email?.trim().toLowerCase() ?? ''

  const { header, rows } = await getConsentValues()
  if (!rows.length) {
    logger.warn({ requestId }, '[eraseUserData] No consent rows found')
    return { erased: false, reason: 'NOT_FOUND' }
  }

  const columns = resolveConsentColumns(header)
  if (!columns) {
    logger.error({ requestId }, '[eraseUserData] Cannot resolve columns')
    return { erased: false, reason: 'NOT_FOUND' }
  }

  // Debug: log the column mappings to understand the issue
  logger.debug({
    requestId,
    header,
    columnMappings: {
      phone: columns.phone,
      name: columns.name,
      email: columns.email,
      requestErasureDate: columns.requestErasureDate,
      erasureDate: columns.erasureDate,
    }
  }, '[eraseUserData] Column mappings')

  // Force correct indices for erasure columns if not found
  if (columns.requestErasureDate < 0) {
    logger.warn('[eraseUserData] requestErasureDate column not found, using fallback index 10')
    columns.requestErasureDate = 10 // K column
  }
  if (columns.erasureDate < 0) {
    logger.warn('[eraseUserData] erasureDate column not found, using fallback index 11')
    columns.erasureDate = 11 // L column
  }

  const matches: ConsentRowMatch[] = []

  rows.forEach((rawRow, index) => {
    const row = [...rawRow]
    const rowPhoneRaw = row[columns.phone]?.trim() ?? ''
    const rowEmailRaw = row[columns.email]?.trim().toLowerCase() ?? ''
    const rowNameRaw = row[columns.name]?.trim() ?? ''

    // Check if already anonymized (phone is hashed, not a phone number)
    const isPhoneHashed = rowPhoneRaw.length === 16 && /^[a-f0-9]{16}$/.test(rowPhoneRaw)
    if (isPhoneHashed) {
      // Skip this row as it's already erased
      return
    }

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
    }, '[eraseUserData] User data not found')
    return { erased: false, reason: 'NOT_FOUND' }
  }

  logger.info({
    requestId,
    phone: maskPhoneHash(normalizedPhone),
    totalRecords: matches.length,
    recordDetails: matches.map(m => ({
      index: m.index,
      isWithdrawn: m.isWithdrawn,
      consentDate: m.consent.consentDate,
    })),
  }, '[eraseUserData] Found user records to process')

  // Process all matching records
  const { sheets } = getClients()
  const requestTimestamp = new Date()
  const requestDateISO = nowInWarsawISO(requestTimestamp)
  // Use a more distinct timestamp for the actual erasure to avoid race conditions or sheets API quirks
  const erasureDateISO = nowInWarsawISO(new Date(requestTimestamp.getTime() + 2000)) // Add 2 seconds
  let processedCount = 0

  // Batch update all records
  const updateRequests = matches.map(target => {
    const rowIndex = target.index
    const row = [...target.row]

    logger.debug({
      requestId,
      rowIndex,
      originalRow: row,
      originalName: row[columns.name],
      originalPhone: row[columns.phone],
      nameColumnIndex: columns.name,
      phoneColumnIndex: columns.phone,
      requestErasureDateIndex: columns.requestErasureDate,
      erasureDateIndex: columns.erasureDate,
    })

    // Anonymize the data: hash phone, clear name and email
    if (columns.phone >= 0) row[columns.phone] = hashPhoneForErasure(row[columns.phone] || '')
    if (columns.name >= 0) row[columns.name] = ''
    if (columns.email >= 0) row[columns.email] = ''

    // Set consent booleans to FALSE
    if (columns.privacy >= 0) row[columns.privacy] = 'FALSE'
    if (columns.terms >= 0) row[columns.terms] = 'FALSE'
    if (columns.notifications >= 0) row[columns.notifications] = 'FALSE'

    // Ensure row is long enough for erasure columns
    const maxNeededIndex = Math.max(columns.requestErasureDate, columns.erasureDate, row.length - 1)
    while (row.length <= maxNeededIndex) {
      row.push('')
    }

    // Set erasure timestamps and method
    if (columns.requestErasureDate >= 0) row[columns.requestErasureDate] = requestDateISO
    if (columns.erasureDate >= 0) row[columns.erasureDate] = erasureDateISO
    if (columns.erasureMethod >= 0) row[columns.erasureMethod] = trimToSheetLimit(erasureMethod)

    logger.debug({
      requestId,
      rowIndex,
      updatedRow: row,
      updatedName: row[columns.name],
      updatedPhone: row[columns.phone],
      requestErasureDate: row[columns.requestErasureDate],
      erasureDate: row[columns.erasureDate],
    }, '[eraseUserData] Updated row')

    const writableIndices = [
      columns.phone,
      columns.name,
      columns.email,
      columns.privacy,
      columns.terms,
      columns.notifications,
      columns.requestErasureDate,
      columns.erasureDate,
      columns.erasureMethod,
    ].filter(idx => idx >= 0)

    const maxColIdx = writableIndices.length ? Math.max(...writableIndices) : columns.erasureDate
    const rowNumber = rowIndex + 2
    const endColumn = columnIndexToLetter(maxColIdx >= 0 ? maxColIdx : columns.erasureDate)
    const updateRange = `A${rowNumber}:${endColumn}${rowNumber}`

    logger.debug({
      requestId,
      rowNumber,
      updateRange,
      maxColIdx,
      endColumn,
      writableIndices,
    }, '[eraseUserData] Update range')

    return {
      range: updateRange,
      values: [row],
    }
  })

  // Execute all updates using batchUpdate for better performance
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.USER_CONSENTS_GOOGLE_SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updateRequests,
    },
  })

  // Perform a separate, targeted update for erasure data to ensure it's written
  const erasureUpdateRequests = matches.map(target => {
    const rowNumber = target.index + 2
    const range = `${columnIndexToLetter(columns.requestErasureDate)}${rowNumber}:${columnIndexToLetter(columns.erasureMethod)}${rowNumber}`
    return {
      range,
      values: [[requestDateISO, erasureDateISO, trimToSheetLimit(erasureMethod)]],
    }
  })

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.USER_CONSENTS_GOOGLE_SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: erasureUpdateRequests,
    },
  })

  processedCount = matches.length

  logger.info({
    requestId,
    phone: maskPhoneHash(normalizedPhone),
    processedRecords: processedCount,
    updatedRows: matches.map(m => m.index + 2),
  }, '[eraseUserData] All user records erased successfully')

  return { erased: true }
}

// --- Data Export ---

export interface UserDataExport {
  personalData: {
    name: string
    phone: string
    email?: string
  }
  consentHistory: {
    consentDate: string
    ipHash: string
    privacyV10: boolean
    termsV10: boolean
    notificationsV10: boolean
    withdrawnDate?: string
    withdrawalMethod?: string
  }[]
  isAnonymized: boolean
  exportTimestamp: string
}

interface ExportUserDataOptions {
  phone: string
  name: string
  email?: string
  requestId?: string
}

type ExportOutcome = { exportedData: UserDataExport | null; reason?: 'NOT_FOUND' | 'ANONYMIZED' }

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

