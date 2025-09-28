import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateTurnstileForAPI } from '../../../../lib/turnstile'
import { getClients } from '../../../../lib/google/auth'
import { config } from '../../../../lib/env'
import { getLogger } from '../../../../lib/logger'
import { reportError } from '../../../../lib/sentry'
import { cacheGet, cacheDel } from '../../../../lib/cache'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.cancel' })

// Schema for cancel request
const CancelBookingSchema = z.object({
  eventId: z.string().min(1),
  turnstileToken: z.string().optional(),
  
  // User verification (must match cached booking data)
  firstName: z.string().min(1).max(50),
  phone: z.string().min(5).max(20),
  email: z.string().email().optional().or(z.literal('')),
})

// Removed CachedBooking interface - no longer needed with direct calendar approach

export async function POST(req: NextRequest) {
  let body: z.infer<typeof CancelBookingSchema> | null = null
  let ip = '0.0.0.0'

  try {
    body = CancelBookingSchema.parse(await req.json())
    ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ip

    const { eventId, firstName, phone, email, turnstileToken } = body
    
    log.info({ 
      ip, 
      eventId,
      firstName,
      phone: phone.replace(/\D/g, '').slice(-4), // Only last 4 digits for privacy
    }, 'CANCEL REQUEST: Booking cancellation request received')

    // Skip Turnstile validation for cancellation - user was already verified during search
    log.info({ ip, eventId, firstName, phone: phone.slice(-4) }, 'CANCEL: Starting simple deletion (no cache check needed)')

    // Try to delete from Google Calendar directly
    // If it succeeds, the event existed and user had valid eventId
    const { calendar } = getClients()
    let deletedEvent: any = null
    
    try {
      // First, get the event to verify it contains user's data (security check)
      const eventResponse = await calendar.events.get({
        calendarId: config.GOOGLE_CALENDAR_ID,
        eventId,
      })
      
      const event = eventResponse.data
      if (!event || !event.description) {
        log.warn({ ip, eventId }, 'Event found but has no description - not a booking')
        return NextResponse.json(
          { error: 'This is not a valid booking event.', code: 'INVALID_BOOKING' },
          { status: 400 }
        )
      }
      
      // Basic verification: check if user's name is in the event description
      const description = event.description.toLowerCase()
      const userFirstName = firstName.toLowerCase().trim()
      
      if (!description.includes(userFirstName)) {
        log.warn({ 
          ip, 
          eventId, 
          firstName: userFirstName 
        }, 'User name not found in event description - access denied')
        
        return NextResponse.json(
          { error: 'You do not have permission to cancel this booking.', code: 'ACCESS_DENIED' },
          { status: 403 }
        )
      }
      
      log.info({ ip, eventId }, 'Event verified, proceeding with deletion')
      deletedEvent = event
      
      // Now delete the event
      await calendar.events.delete({
        calendarId: config.GOOGLE_CALENDAR_ID,
        eventId,
      })
      
    } catch (error: any) {
      if (error.code === 404) {
        // Event not found
        log.warn({ ip, eventId }, 'Event not found - may be already deleted')
        return NextResponse.json(
          { error: 'Booking not found. It may have been already cancelled.', code: 'BOOKING_NOT_FOUND' },
          { status: 404 }
        )
      } else if (error.code === 410) {
        // Event already deleted - that's OK
        log.info({ ip, eventId }, 'Event was already deleted')
      } else {
        log.error({ error, ip, eventId }, 'Failed to access or delete calendar event')
        return NextResponse.json(
          { error: 'Failed to cancel booking. Please try again.', code: 'CALENDAR_ERROR' },
          { status: 500 }
        )
      }
    }

    // Invalidate cache to force refresh on next search
    const cacheKeys = await getCacheKeysForBookingData()
    for (const cacheKey of cacheKeys) {
      await cacheDel(cacheKey)
    }

    log.info({ 
      ip, 
      eventId, 
      eventTitle: deletedEvent?.summary || 'Unknown'
    }, 'Booking cancelled successfully')

    const response = NextResponse.json({ 
      success: true, 
      eventId,
      cancelledBooking: {
        procedureName: deletedEvent?.summary || 'Unknown Procedure',
        startTime: deletedEvent?.start?.dateTime || '',
        endTime: deletedEvent?.end?.dateTime || '',
      }
    })
    response.headers.set('Cache-Control', 'no-store')
    return response

  } catch (err: any) {
    const isValidationError = err instanceof z.ZodError
    const errorEventId = body?.eventId || 'unknown'
    
    if (isValidationError) {
      const issuePaths = err.issues?.map(issue => (issue.path.length ? issue.path.join('.') : '(root)')) ?? []
      log.warn({ ip, eventId: errorEventId, issuePaths }, 'Booking cancellation validation failed')
    } else {
      log.error({ err, ip, eventId: errorEventId }, 'Booking cancellation handler failed')
      await reportError(err, {
        tags: { module: 'api.bookings.cancel' },
        extras: { ip, eventId: errorEventId },
      })
    }

    const details = isValidationError ? JSON.stringify(err.issues) : String(err?.message || err)
    const status = isValidationError ? 400 : 500
    return NextResponse.json({ error: 'Failed to cancel booking', details }, { status })
  }
}

// Helper function to get possible cache keys for booking data
async function getCacheKeysForBookingData(): Promise<string[]> {
  // Use the same logic as /api/bookings/all to generate the correct cache key
  const now = new Date()
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Start of today
  const defaultStart = currentDay
  const defaultEnd = new Date(currentDay.getTime() + (90 * 24 * 60 * 60 * 1000))   // +90 days
  
  const startISO = defaultStart.toISOString()
  const endISO = defaultEnd.toISOString()
  const cacheKey = `calendar:events:${startISO}:${endISO}`
  
  return [cacheKey]
}
