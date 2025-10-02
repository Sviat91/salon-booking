import { config } from '../../env'
import { getLogger } from '../../logger'
import { getClients } from '../auth'
import {
  columnIndexToLetter,
  getConsentValues,
  hashPhoneForErasure,
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

const logger = getLogger({ module: 'google.consents.erase' })

export interface EraseUserDataOptions {
  phone: string
  name: string
  email?: string
  erasureMethod: 'support_form' | 'manual' | string
  requestId?: string
}

export type EraseOutcome = {
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
