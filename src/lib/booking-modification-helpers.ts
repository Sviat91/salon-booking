import { getClients } from './google/auth'
import { parseBookingData, freeBusy, getBusyTimesWithIds, type BusyInterval } from './google/calendar'
import { readProcedures } from './google/sheets'
import { verifyBookingAccess, canModifyBooking, BookingErrors, type UserAccessCriteria } from './booking-helpers'
import { config } from './env'
import { getLogger } from './logger'
import { getMasterCalendarIdSafe } from '@/config/masters.server'

const log = getLogger({ module: 'booking.modification.helpers' })

/**
 * Get and validate existing booking for modification
 */
export async function getAndValidateBooking(
  eventId: string,
  userCriteria: UserAccessCriteria,
  ip: string,
  masterId?: string,
) {
  const { calendar } = getClients()

  // Get existing booking
  let existingEvent
  try {
    const response = await calendar.events.get({
      calendarId: getMasterCalendarIdSafe(masterId),
      eventId: eventId,
    })
    existingEvent = response.data
  } catch (error) {
    log.warn({ ip, eventId, error }, 'Booking not found')
    return {
      success: false,
      error: BookingErrors.BOOKING_NOT_FOUND,
      status: 404
    }
  }

  // Verify user has access to this booking
  if (!verifyBookingAccess(existingEvent, userCriteria)) {
    log.warn({ 
      ip, 
      eventId, 
      firstName: userCriteria.firstName, 
      lastName: userCriteria.lastName 
    }, 'Unauthorized booking access attempt')
    return {
      success: false,
      error: BookingErrors.ACCESS_DENIED,
      status: 404 // Return 404 instead of 403 to not reveal booking existence
    }
  }

  // Parse existing booking data
  const existingBooking = parseBookingData(existingEvent)
  if (!existingBooking) {
    log.error({ ip, eventId }, 'Failed to parse existing booking data')
    return {
      success: false,
      error: BookingErrors.INVALID_BOOKING_DATA,
      status: 500
    }
  }

  // Check 24-hour rule
  const modificationCheck = canModifyBooking(existingBooking.startTime)
  if (!modificationCheck.canModify) {
    log.warn({ 
      ip, 
      eventId, 
      startTime: existingBooking.startTime,
      hoursRemaining: modificationCheck.hoursRemaining 
    }, 'Booking modification attempted within 24h')
    return {
      success: false,
      error: BookingErrors.TOO_LATE_TO_MODIFY,
      status: 400
    }
  }

  return {
    success: true,
    existingEvent,
    existingBooking
  }
}

/**
 * Update booking in Google Calendar
 */
export async function updateBookingInCalendar(
  eventId: string,
  updateData: {
    summary?: string
    description?: string
    startISO: string
    endISO: string
  },
  ip: string,
  masterId?: string,
) {
  try {
    const { calendar } = getClients()
    
    const eventUpdate: any = {
      summary: updateData.summary,
      description: updateData.description,
      start: { dateTime: updateData.startISO, timeZone: 'Europe/Warsaw' },
      end: { dateTime: updateData.endISO, timeZone: 'Europe/Warsaw' },
    }

    await calendar.events.update({
      calendarId: getMasterCalendarIdSafe(masterId),
      eventId: eventId,
      requestBody: eventUpdate,
    })

    log.info({ ip, eventId }, 'Booking updated successfully in calendar')
    return { success: true }

  } catch (error) {
    log.error({ ip, eventId, error }, 'Failed to update calendar event')
    return {
      success: false,
      error: { error: 'Failed to update booking', code: 'UPDATE_FAILED' },
      status: 500
    }
  }
}

/**
 * Delete booking from Google Calendar
 */
export async function deleteBookingFromCalendar(
  eventId: string,
  ip: string,
  masterId?: string,
) {
  try {
    const { calendar } = getClients()

    await calendar.events.delete({
      calendarId: getMasterCalendarIdSafe(masterId),
      eventId: eventId,
    })

    log.info({ ip, eventId }, 'Booking deleted successfully from calendar')
    return { success: true }

  } catch (error) {
    log.error({ ip, eventId, error }, 'Failed to delete calendar event')
    return {
      success: false,
      error: { error: 'Failed to cancel booking', code: 'CANCELLATION_FAILED' },
      status: 500
    }
  }
}

/**
 * Validate time slot availability (excluding current booking)
 */
export async function validateTimeSlotAvailability(
  newStartISO: string,
  newEndISO: string,
  existingBooking: { startTime: Date, endTime: Date },
  ip: string,
  eventId: string,
  masterId?: string,
) {
  try {
    // Use getBusyTimesWithIds to get event IDs for proper filtering
    const busy = await getBusyTimesWithIds(newStartISO, newEndISO, masterId)
    
    // Filter out the current booking by eventId (not by time!)
    // This is crucial for shift-back scenarios where time changes
    const conflictingBusy = busy.filter((busySlot: BusyInterval) => {
      // If we have eventId from API, use it for exact match
      if (busySlot.id && busySlot.id === eventId) {
        log.info({ 
          excludedByEventId: busySlot.id,
          message: '✅ Excluded current booking from conflict check'
        })
        return false
      }
      
      // Fallback: exclude by time match (for old bookings without ID)
      const busyStart = new Date(busySlot.start)
      const busyEnd = new Date(busySlot.end)
      const existingStart = existingBooking.startTime
      const existingEnd = existingBooking.endTime
      
      const isSameTime = busyStart.getTime() === existingStart.getTime() && 
                         busyEnd.getTime() === existingEnd.getTime()
      if (isSameTime) {
        log.info({ 
          excludedByTime: { start: busySlot.start, end: busySlot.end },
          message: '✅ Excluded current booking by time match'
        })
        return false
      }
      
      return true // This is a different booking - check for conflict
    })

    if (conflictingBusy.length > 0) {
      log.warn({ 
        ip, 
        eventId, 
        newStartISO, 
        newEndISO, 
        conflicts: conflictingBusy.length,
        conflictDetails: conflictingBusy.map((b: BusyInterval) => ({ id: b.id, start: b.start, end: b.end }))
      }, 'New time slot conflicts with existing bookings')
      return {
        success: false,
        error: BookingErrors.TIME_CONFLICT,
        status: 409
      }
    }

    log.info({ 
      eventId,
      newStartISO,
      newEndISO,
      message: '✅ Time slot validated - no conflicts'
    })
    
    return { success: true }

  } catch (error) {
    log.error({ ip, eventId, error }, 'Failed to check time slot availability')
    return {
      success: false,
      error: { error: 'Failed to validate availability', code: 'AVAILABILITY_CHECK_FAILED' },
      status: 500
    }
  }
}

/**
 * Get procedure info by ID
 */
export async function getProcedureInfo(procedureId: string, masterId?: string) {
  try {
    const procedures = await readProcedures(masterId)
    const procedure = procedures.find(p => p.id === procedureId)
    
    if (!procedure) {
      return {
        success: false,
        error: BookingErrors.PROCEDURE_NOT_FOUND,
        status: 400
      }
    }

    return {
      success: true,
      procedure
    }
  } catch (error) {
    return {
      success: false,
      error: { error: 'Failed to validate procedure', code: 'PROCEDURE_ERROR' },
      status: 500
    }
  }
}

/**
 * Prepare new booking description with updated procedure info
 */
export function prepareUpdatedDescription(
  originalDescription: string,
  newPrice?: number
): string {
  if (!newPrice || !originalDescription) {
    return originalDescription
  }

  // Replace price in description
  return originalDescription.replace(/Cena: \d+zł/, `Cena: ${newPrice}zł`)
}
