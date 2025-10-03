import { parseBookingData } from './google/calendar'
import { getDaySlots } from './availability'
import { readProcedures } from './google/sheets'
import { getLogger } from './logger'
import { normalizePhoneDigitsOnly } from './utils/phone-normalization'
import { normalizeTextWithCyrillicConversion } from './utils/string-normalization'

const logger = getLogger({ module: 'booking-helpers' })

/**
 * Helper functions for booking management operations
 * Shared between search, modification, and availability APIs
 */

/**
 * Normalize strings for comparison - handles cyrillic/latin conversion
 * @deprecated Use normalizeTextWithCyrillicConversion from utils/string-normalization instead
 */
export function normalizeString(str: string): string {
  return normalizeTextWithCyrillicConversion(str)
}

/**
 * Normalize phone number for matching (remove all non-digits)
 * @deprecated Use normalizePhoneDigitsOnly from utils/phone-normalization instead
 */
export function normalizePhone(phone: string): string {
  return normalizePhoneDigitsOnly(phone)
}

/**
 * User access criteria for booking verification
 */
export interface UserAccessCriteria {
  firstName: string
  lastName: string
  phone: string
  email?: string
}

/**
 * Verify user has access to modify this booking
 * Uses normalized comparison for names and phones
 */
export function verifyBookingAccess(
  calendarEvent: any,
  userCriteria: UserAccessCriteria
): boolean {
  const bookingData = parseBookingData(calendarEvent)
  if (!bookingData) return false

  // Normalize user input
  const userFirstName = normalizeString(userCriteria.firstName)
  const userLastName = normalizeString(userCriteria.lastName)
  const userPhone = normalizePhone(userCriteria.phone)
  const userEmail = userCriteria.email ? userCriteria.email.toLowerCase().trim() : ''

  // Normalize booking data
  const bookingFirstName = normalizeString(bookingData.firstName)
  const bookingLastName = normalizeString(bookingData.lastName)
  const bookingPhone = normalizePhone(bookingData.phone)
  const bookingEmail = bookingData.email ? bookingData.email.toLowerCase().trim() : ''

  // Check name and phone match
  const firstNameMatch = bookingFirstName === userFirstName
  const lastNameMatch = bookingLastName === userLastName
  
  // Phone matching - support partial matches for international numbers
  let phoneMatch = false
  if (userPhone.length >= 6 && bookingPhone.length >= 6) {
    // For longer phones, check if one contains the significant part of the other
    phoneMatch = bookingPhone.includes(userPhone.slice(-9)) || 
                 userPhone.includes(bookingPhone.slice(-9))
  } else {
    // For shorter phones, exact match required
    phoneMatch = userPhone === bookingPhone
  }

  if (!firstNameMatch || !lastNameMatch || !phoneMatch) {
    return false
  }

  // If email provided in both booking and user input, they must match
  if (bookingEmail && userEmail && bookingEmail !== userEmail) {
    return false
  }

  return true
}

/**
 * Booking modification result
 */
export interface BookingModificationCheck {
  canModify: boolean
  reason?: string
  hoursRemaining?: number
}

/**
 * Check if booking can be modified based on 24-hour rule
 */
export function canModifyBooking(startTime: Date): BookingModificationCheck {
  const now = new Date()
  const timeDiff = startTime.getTime() - now.getTime()
  const hoursUntilAppointment = timeDiff / (1000 * 60 * 60)
  
  if (hoursUntilAppointment < 24) {
    return {
      canModify: false,
      reason: `Cannot modify booking less than 24 hours before appointment`,
      hoursRemaining: Math.max(0, hoursUntilAppointment)
    }
  }
  
  return { 
    canModify: true,
    hoursRemaining: hoursUntilAppointment
  }
}

/**
 * Check if booking matches search criteria for search API
 */
export function matchesSearchCriteria(
  bookingData: any, // parsed booking data
  searchCriteria: UserAccessCriteria
): boolean {
  if (!bookingData) return false

  // Normalize search criteria
  const searchFirstName = normalizeString(searchCriteria.firstName)
  const searchLastName = normalizeString(searchCriteria.lastName)
  const searchPhone = normalizePhone(searchCriteria.phone)
  const searchEmail = searchCriteria.email ? searchCriteria.email.toLowerCase().trim() : ''

  // Normalize booking data
  const bookingFirstName = normalizeString(bookingData.firstName)
  const bookingLastName = normalizeString(bookingData.lastName)
  const bookingPhone = normalizePhone(bookingData.phone)
  const bookingEmail = bookingData.email ? bookingData.email.toLowerCase().trim() : ''

  // Name matching (first name must match, last name only if provided)
  const firstNameMatch = bookingFirstName.includes(searchFirstName) || searchFirstName.includes(bookingFirstName)
  
  if (!firstNameMatch) {
    return false
  }
  
  // Last name matching: only check if both search and booking have last names
  if (searchLastName && bookingLastName) {
    const lastNameMatch = bookingLastName.includes(searchLastName) || searchLastName.includes(bookingLastName)
    if (!lastNameMatch) {
      return false
    }
  }

  // Phone matching (must match significant part of phone number)
  if (searchPhone.length >= 6 && bookingPhone.length >= 6) {
    // For longer phones, check if one contains the other
    const phoneMatch = bookingPhone.includes(searchPhone.slice(-9)) || 
                      searchPhone.includes(bookingPhone.slice(-9))
    if (!phoneMatch) {
      return false
    }
  } else {
    // For shorter phones, exact match required
    if (searchPhone !== bookingPhone) {
      return false
    }
  }

  // Email matching (if provided in search and in booking)
  if (searchEmail && bookingEmail) {
    if (searchEmail !== bookingEmail) {
      return false
    }
  }

  return true
}

/**
 * Time slot with availability status
 */
export interface TimeSlot {
  startISO: string
  endISO: string
  available: boolean
}

/**
 * Get available time slots for a specific date range, excluding a current booking
 * Uses the same schedule logic as normal booking (getDaySlots from availability.ts)
 */
export async function getAvailableSlotsForRebooking(options: {
  dateFrom: string // ISO date string like "2024-01-15"
  dateTo: string   // ISO date string like "2024-01-30"
  procedureDurationMin: number
  excludeBooking?: {
    startTime: Date
    endTime: Date
  }
  maxSlots?: number // Limit results for performance
}): Promise<TimeSlot[]> {
  const { dateFrom, dateTo, procedureDurationMin, excludeBooking, maxSlots = 50 } = options
  
  const allSlots: TimeSlot[] = []
  const fromDate = new Date(dateFrom + 'T00:00:00')
  const toDate = new Date(dateTo + 'T23:59:59')
  
  // Iterate through each day in the range
  let currentDate = new Date(fromDate)
  while (currentDate <= toDate && allSlots.length < maxSlots) {
    const dateISO = currentDate.toISOString().split('T')[0] // YYYY-MM-DD
    
    try {
      // Use existing getDaySlots function to get available slots for this day
      // This respects the master's schedule from Google Sheets (weekly + exceptions)
      const dayResult = await getDaySlots(dateISO, procedureDurationMin, 15) // 15min step
      const daySlots = dayResult.slots || []
      
      // Convert to TimeSlot format and filter out excluded booking
      for (const slot of daySlots) {
        let available = true
        
        // If we have a current booking to exclude, check if this slot overlaps
        if (excludeBooking) {
          const slotStart = new Date(slot.startISO)
          const slotEnd = new Date(slot.endISO)
          const bookingStart = excludeBooking.startTime
          const bookingEnd = excludeBooking.endTime
          
          // Check if slot overlaps with the booking we want to exclude
          const overlaps = slotStart < bookingEnd && slotEnd > bookingStart
          if (overlaps) {
            // This slot is currently occupied by the booking we're trying to reschedule
            // Mark as available since we can move the booking here
            available = true
          }
        }
        
        if (available && allSlots.length < maxSlots) {
          allSlots.push({
            startISO: slot.startISO,
            endISO: slot.endISO,
            available: true
          })
        }
      }
    } catch (error) {
      // Skip days that fail (holidays, etc.)
      logger.warn({ dateISO, error }, `Failed to get slots for ${dateISO}`)
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return allSlots
}

/**
 * Get procedure duration by ID
 */
export async function getProcedureDuration(procedureId?: string): Promise<number> {
  try {
    const procedures = await readProcedures()
    
    if (procedureId) {
      const procedure = procedures.find(p => p.id === procedureId)
      return procedure?.duration_min || 60 // Default 60 minutes
    }
    
    // If no specific procedure, use minimum duration of active procedures
    const activeProcedures = procedures.filter(p => p.is_active)
    if (activeProcedures.length > 0) {
      return Math.min(...activeProcedures.map(p => p.duration_min || 60))
    }
    
    return 60 // Fallback default
  } catch (error) {
    logger.warn({ error }, 'Failed to get procedure duration')
    return 60 // Fallback default
  }
}

/**
 * Common error responses for booking APIs
 */
export const BookingErrors = {
  BOOKING_NOT_FOUND: {
    error: 'Booking not found',
    code: 'BOOKING_NOT_FOUND'
  },
  ACCESS_DENIED: {
    error: 'Access denied - booking not found or you do not have permission',
    code: 'ACCESS_DENIED'
  },
  TOO_LATE_TO_MODIFY: {
    error: 'Cannot modify booking less than 24 hours before appointment',
    code: 'TOO_LATE_TO_MODIFY'
  },
  TOO_LATE_TO_CANCEL: {
    error: 'Cannot cancel booking less than 24 hours before appointment',
    code: 'TOO_LATE_TO_CANCEL'
  },
  INVALID_BOOKING_DATA: {
    error: 'Invalid booking data',
    code: 'INVALID_BOOKING_DATA'
  },
  TIME_CONFLICT: {
    error: 'New time slot is not available',
    code: 'TIME_CONFLICT'
  },
  PROCEDURE_NOT_FOUND: {
    error: 'Procedure not found',
    code: 'PROCEDURE_NOT_FOUND'
  }
} as const
