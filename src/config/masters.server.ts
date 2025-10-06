/**
 * Server-side master configuration utilities
 * This file should ONLY be imported in server-side code (API routes, server components)
 */

import { config } from '@/lib/env'
import { MasterId, isValidMasterId } from './masters'

/**
 * Server-side master configuration with calendar and sheet IDs
 */
export interface ServerMasterConfig {
  id: MasterId
  name: string
  avatar: string
  calendarId: string
  sheetId: string
}

/**
 * Get calendar ID for a master
 */
export function getMasterCalendarId(masterId: MasterId): string {
  switch (masterId) {
    case 'olga':
      return config.GOOGLE_CALENDAR_ID
    case 'yuliia':
      return config.GOOGLE_CALENDAR_ID_Yuliia
    default:
      // Fallback to Olga
      return config.GOOGLE_CALENDAR_ID
  }
}

/**
 * Get sheet ID for a master
 */
export function getMasterSheetId(masterId: MasterId): string {
  switch (masterId) {
    case 'olga':
      return config.GOOGLE_SHEET_ID
    case 'yuliia':
      return config.GOOGLE_SHEET_ID_Yuliia
    default:
      // Fallback to Olga
      return config.GOOGLE_SHEET_ID
  }
}

/**
 * Get full server-side master configuration
 */
export function getServerMasterConfig(masterId: MasterId): ServerMasterConfig {
  return {
    id: masterId,
    name: masterId === 'olga' ? 'Olga' : 'Yuliia',
    avatar: masterId === 'olga' ? '/photo_master_olga.png' : '/photo_master_yuliia.png',
    calendarId: getMasterCalendarId(masterId),
    sheetId: getMasterSheetId(masterId),
  }
}

/**
 * Get calendar ID from string with validation
 */
export function getMasterCalendarIdSafe(masterIdString: string | null | undefined): string {
  if (!masterIdString || !isValidMasterId(masterIdString)) {
    return config.GOOGLE_CALENDAR_ID // Fallback to Olga
  }
  return getMasterCalendarId(masterIdString)
}

/**
 * Get sheet ID from string with validation
 */
export function getMasterSheetIdSafe(masterIdString: string | null | undefined): string {
  if (!masterIdString || !isValidMasterId(masterIdString)) {
    return config.GOOGLE_SHEET_ID // Fallback to Olga
  }
  return getMasterSheetId(masterIdString)
}
