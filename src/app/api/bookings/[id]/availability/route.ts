import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateTurnstileForAPI } from '../../../../../lib/turnstile'
import { getClients } from '../../../../../lib/google/auth'
import { parseBookingData } from '../../../../../lib/google/calendar'
import { 
  verifyBookingAccess, 
  canModifyBooking, 
  getAvailableSlotsForRebooking, 
  getProcedureDuration,
  BookingErrors,
  type UserAccessCriteria 
} from '../../../../../lib/booking-helpers'
import { readProcedures } from '../../../../../lib/google/sheets'
import { config } from '../../../../../lib/env'
import { getLogger } from '../../../../../lib/logger'
import { reportError } from '../../../../../lib/sentry'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.availability' })

// Input validation schema
const AvailabilityQuerySchema = z.object({
  // Authentication
  turnstileToken: z.string().optional(),
  
  // User verification
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().min(5).max(20),
  email: z.string().email().optional().or(z.literal('')),
  
  // Search parameters
  dateFrom: z.string().optional(), // ISO date string, default: today
  dateTo: z.string().optional(),   // ISO date string, default: +2 weeks
  procedureId: z.string().optional(), // If changing procedure
})

// Output types
interface AvailabilityInfo {
  canModify: boolean
  reason?: string
  hoursRemaining?: number
  currentBooking: {
    eventId: string
    procedureName: string
    startTime: string
    endTime: string
    price: number
  }
  availableSlots?: Array<{
    startISO: string
    endISO: string
    available: boolean
  }>
  searchPeriod?: {
    from: string
    to: string
  }
}

/**
 * POST - Check availability for modifying a specific booking
 * Uses existing getDaySlots() function to respect master's schedule
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: z.infer<typeof AvailabilityQuerySchema>
  let ip = '0.0.0.0'

  try {
    const eventId = params.id
    body = AvailabilityQuerySchema.parse(await req.json())
    ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ip

    log.debug({ 
      ip, 
      eventId,
      firstName: body.firstName,
      lastName: body.lastName,
      checkingProcedure: !!body.procedureId,
    }, 'Booking availability check request')

    // Validate Turnstile
    const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip)
    if (!turnstileResult.success) {
      log.warn({ ip, eventId, reason: turnstileResult.errorResponse?.code }, 'Turnstile validation failed for availability check')
      return NextResponse.json(
        turnstileResult.errorResponse,
        { status: turnstileResult.status }
      )
    }

    const { calendar } = getClients()

    // Get existing booking
    let existingEvent
    try {
      const response = await calendar.events.get({
        calendarId: config.GOOGLE_CALENDAR_ID,
        eventId: eventId,
      })
      existingEvent = response.data
    } catch (error) {
      log.warn({ ip, eventId, error }, 'Booking not found for availability check')
      return NextResponse.json(
        BookingErrors.BOOKING_NOT_FOUND,
        { status: 404 }
      )
    }

    // Verify user has access to this booking
    if (!verifyBookingAccess(existingEvent, {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      email: body.email,
    })) {
      log.warn({ ip, eventId, firstName: body.firstName, lastName: body.lastName }, 'Unauthorized availability check attempt')
      return NextResponse.json(
        BookingErrors.ACCESS_DENIED,
        { status: 404 }
      )
    }

    // Parse existing booking data
    const existingBooking = parseBookingData(existingEvent)
    if (!existingBooking) {
      log.error({ ip, eventId }, 'Failed to parse existing booking data for availability check')
      return NextResponse.json(
        BookingErrors.INVALID_BOOKING_DATA,
        { status: 500 }
      )
    }

    // Check if booking can be modified
    const modificationCheck = canModifyBooking(existingBooking.startTime)
    
    // Prepare response with current booking info
    const availabilityInfo: AvailabilityInfo = {
      canModify: modificationCheck.canModify,
      reason: modificationCheck.reason,
      hoursRemaining: modificationCheck.hoursRemaining,
      currentBooking: {
        eventId: existingBooking.eventId,
        procedureName: existingBooking.procedureName,
        startTime: existingBooking.startTime.toISOString(),
        endTime: existingBooking.endTime.toISOString(),
        price: existingBooking.price,
      }
    }

    // If can modify, generate available time slots using existing logic
    if (modificationCheck.canModify) {
      // Set default date range
      const now = new Date()
      const defaultFrom = now.toISOString().split('T')[0] // Today
      const defaultTo = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0] // +2 weeks

      const dateFrom = body.dateFrom || defaultFrom
      const dateTo = body.dateTo || defaultTo

      // Determine procedure duration
      let procedureDurationMin: number
      
      if (body.procedureId) {
        // User wants to change procedure, get new duration
        procedureDurationMin = await getProcedureDuration(body.procedureId)
        if (procedureDurationMin === 60 && body.procedureId) {
          // Check if procedure actually exists
          const procedures = await readProcedures()
          const procedure = procedures.find(p => p.id === body.procedureId)
          if (!procedure) {
            return NextResponse.json(
              BookingErrors.PROCEDURE_NOT_FOUND,
              { status: 400 }
            )
          }
        }
      } else {
        // Keep current procedure duration
        const currentDurationMs = existingBooking.endTime.getTime() - existingBooking.startTime.getTime()
        procedureDurationMin = Math.round(currentDurationMs / (60 * 1000))
      }

      // Generate available slots using existing availability system
      try {
        const availableSlots = await getAvailableSlotsForRebooking({
          dateFrom,
          dateTo,
          procedureDurationMin,
          excludeBooking: {
            startTime: existingBooking.startTime,
            endTime: existingBooking.endTime
          },
          maxSlots: 50
        })

        availabilityInfo.availableSlots = availableSlots
        availabilityInfo.searchPeriod = {
          from: dateFrom,
          to: dateTo,
        }
      } catch (error) {
        log.error({ ip, eventId, error }, 'Failed to generate available slots')
        // Continue without slots - user can still see modification status
      }
    }

    log.info({ 
      ip, 
      eventId, 
      canModify: availabilityInfo.canModify,
      availableSlotsCount: availabilityInfo.availableSlots?.length || 0,
      hoursRemaining: availabilityInfo.hoursRemaining,
    }, 'Availability check completed')

    const response_final = NextResponse.json(availabilityInfo)
    response_final.headers.set('Cache-Control', 'no-store')
    return response_final

  } catch (err: any) {
    const isValidationError = err instanceof z.ZodError
    
    if (isValidationError) {
      const issuePaths = err.issues?.map(issue => (issue.path.length ? issue.path.join('.') : '(root)')) ?? []
      log.warn({ ip, eventId: params?.id, issuePaths }, 'Availability check validation failed')
    } else {
      log.error({ err, ip, eventId: params?.id }, 'Availability check handler failed')
      await reportError(err, {
        tags: { module: 'api.bookings.availability' },
        extras: { ip, eventId: params?.id },
      })
    }

    const details = isValidationError ? JSON.stringify(err.issues) : String(err?.message || err)
    const status = isValidationError ? 400 : 500
    return NextResponse.json({ error: 'Failed to check availability', details }, { status })
  }
}
