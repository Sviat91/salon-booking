import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateTurnstileForAPI } from '../../../../lib/turnstile'
import { 
  getAndValidateBooking, 
  updateBookingInCalendar, 
  deleteBookingFromCalendar,
  validateTimeSlotAvailability,
  getProcedureInfo,
  prepareUpdatedDescription
} from '../../../../lib/booking-modification-helpers'
import { BookingErrors } from '../../../../lib/booking-helpers'
import { getLogger } from '../../../../lib/logger'
import { reportError } from '../../../../lib/sentry'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.modify' })

// PATCH - Update booking schema
const UpdateBookingSchema = z.object({
  // Authentication
  turnstileToken: z.string().optional(),
  
  // User verification
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().min(5).max(20),
  email: z.string().email().optional().or(z.literal('')),
  
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

    log.debug({ 
      ip, 
      eventId,
      firstName: body.firstName,
      lastName: body.lastName,
      hasNewTime: !!(body.newStartISO || body.newEndISO),
      hasNewProcedure: !!body.newProcedureId,
    }, 'Booking update request')

    // Validate Turnstile
    const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip)
    if (!turnstileResult.success) {
      log.warn({ ip, eventId, reason: turnstileResult.errorResponse?.code }, 'Turnstile validation failed for update')
      return NextResponse.json(
        turnstileResult.errorResponse,
        { status: turnstileResult.status }
      )
    }

    // Get and validate existing booking
    const validationResult = await getAndValidateBooking(eventId, {
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      email: body.email,
    }, ip)

    if (!validationResult.success) {
      return NextResponse.json(
        validationResult.error,
        { status: validationResult.status }
      )
    }

    const { existingEvent, existingBooking } = validationResult
    if (!existingEvent || !existingBooking) {
      return NextResponse.json(
        { error: 'Invalid booking data', code: 'INVALID_BOOKING_DATA' },
        { status: 500 }
      )
    }

    // Prepare update data
    let newStartISO = body.newStartISO || existingBooking.startTime.toISOString()
    let newEndISO = body.newEndISO || existingBooking.endTime.toISOString()
    let newSummary = existingEvent.summary || ''
    let newDescription = existingEvent.description || ''

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
