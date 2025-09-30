import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getClients } from '../../../../lib/google/auth'
import { config } from '../../../../lib/env'
import { 
  updateBookingInCalendar,
  validateTimeSlotAvailability,
  getProcedureInfo,
  prepareUpdatedDescription
} from '../../../../lib/booking-modification-helpers'
import { getLogger } from '../../../../lib/logger'
import { reportError } from '../../../../lib/sentry'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.modify' })

// PATCH - Update booking schema (SIMPLIFIED - no user validation)
// User is already validated during search, we trust the eventId
const UpdateBookingSchema = z.object({
  // Changes (at least one must be provided)
  newStartISO: z.string().optional(),
  newEndISO: z.string().optional(),
  newProcedureId: z.string().optional(),
}).refine(
  (data) => data.newStartISO || data.newEndISO || data.newProcedureId,
  { message: 'At least one change (newStartISO, newEndISO, or newProcedureId) must be provided' }
)

// This file now only handles PATCH (updates) - cancellation moved to /api/bookings/cancel

// Helper functions moved to booking-modification-helpers.ts

/**
 * PATCH - Update existing booking
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: z.infer<typeof UpdateBookingSchema> | null = null
  let ip = '0.0.0.0'

  try {
    const eventId = params.id
    body = UpdateBookingSchema.parse(await req.json())
    ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ip

    log.info({ 
      ip, 
      eventId,
      hasNewTime: !!(body.newStartISO || body.newEndISO),
      hasNewProcedure: !!body.newProcedureId,
      message: '🔄 Booking update request (NO validation - user already verified during search)'
    })

    // NO TURNSTILE - user already verified during search
    // NO getAndValidateBooking - we trust the eventId from search results
    
    // Simply get the existing event to read current data
    const { calendar } = getClients()
    let existingEvent
    try {
      existingEvent = await calendar.events.get({
        calendarId: config.GOOGLE_CALENDAR_ID,
        eventId: eventId,
      })
    } catch (error: any) {
      log.error({ eventId, error: error.message }, 'Failed to fetch existing event')
      return NextResponse.json(
        { error: 'Booking not found', code: 'BOOKING_NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!existingEvent.data || !existingEvent.data.start?.dateTime || !existingEvent.data.end?.dateTime) {
      return NextResponse.json(
        { error: 'Invalid booking data', code: 'INVALID_BOOKING_DATA' },
        { status: 500 }
      )
    }

    const existingBooking = {
      startTime: new Date(existingEvent.data.start.dateTime),
      endTime: new Date(existingEvent.data.end.dateTime),
    }

    // Prepare update data
    let newStartISO = body.newStartISO || existingBooking.startTime.toISOString()
    let newEndISO = body.newEndISO || existingBooking.endTime.toISOString()
    let newSummary = existingEvent.data.summary || ''
    let newDescription = existingEvent.data.description || ''

    // If procedure is changing, get new procedure info and update duration
    if (body.newProcedureId) {
      const procedureResult = await getProcedureInfo(body.newProcedureId)
      if (!procedureResult.success) {
        return NextResponse.json(
          procedureResult.error,
          { status: procedureResult.status }
        )
      }

      const newProcedure = procedureResult.procedure!
      newSummary = newProcedure.name_pl

      // If only procedure changed (no new time), adjust end time based on new duration
      if (!body.newStartISO && !body.newEndISO) {
        const startTime = new Date(newStartISO)
        const endTime = new Date(startTime.getTime() + (newProcedure.duration_min * 60 * 1000))
        newEndISO = endTime.toISOString()
      }

      // Update description with new price
      newDescription = prepareUpdatedDescription(newDescription, newProcedure.price_pln || 0)
      
      log.info({
        procedureName: newProcedure.name_pl,
        duration: newProcedure.duration_min,
        price: newProcedure.price_pln,
        message: '💰 Procedure changed - price will be updated in description'
      })
    }

    // Validate time slot availability (excluding current booking)
    const availabilityResult = await validateTimeSlotAvailability(
      newStartISO,
      newEndISO,
      existingBooking,
      ip,
      eventId
    )

    if (!availabilityResult.success) {
      return NextResponse.json(
        availabilityResult.error,
        { status: availabilityResult.status }
      )
    }

    // Update the event in calendar
    const updateResult = await updateBookingInCalendar(
      eventId,
      {
        summary: newSummary,
        description: newDescription,
        startISO: newStartISO,
        endISO: newEndISO,
      },
      ip
    )

    if (!updateResult.success) {
      return NextResponse.json(
        updateResult.error,
        { status: updateResult.status }
      )
    }

    log.info({ 
      ip, 
      eventId, 
      changes: {
        timeChanged: !!(body.newStartISO || body.newEndISO),
        procedureChanged: !!body.newProcedureId,
      }
    }, 'Booking updated successfully')

    const response_final = NextResponse.json({ 
      success: true, 
      eventId,
      changes: {
        startTime: newStartISO,
        endTime: newEndISO,
        procedure: body.newProcedureId ? newSummary : undefined,
      }
    })
    response_final.headers.set('Cache-Control', 'no-store')
    return response_final

  } catch (err: any) {
    const isValidationError = err instanceof z.ZodError
    
    if (isValidationError) {
      const issuePaths = err.issues?.map(issue => (issue.path.length ? issue.path.join('.') : '(root)')) ?? []
      log.warn({ ip, eventId: params?.id, issuePaths }, 'Booking update validation failed')
    } else {
      log.error({ err, ip, eventId: params?.id }, 'Booking update handler failed')
      await reportError(err, {
        tags: { module: 'api.bookings.modify' },
        extras: { ip, eventId: params?.id },
      })
    }

    const details = isValidationError ? JSON.stringify(err.issues) : String(err?.message || err)
    const status = isValidationError ? 400 : 500
    return NextResponse.json({ error: 'Failed to update booking', details }, { status })
  }
}

// DELETE method moved to /api/bookings/cancel for better architecture
