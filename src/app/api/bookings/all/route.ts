import { NextRequest, NextResponse } from 'next/server'
import { getClients } from '../../../../lib/google/auth'
import { parseBookingData } from '../../../../lib/google/calendar'
import { canModifyBooking } from '../../../../lib/booking-helpers'
import { config } from '../../../../lib/env'
import { getLogger } from '../../../../lib/logger'
import { reportError } from '../../../../lib/sentry'
import { cacheGet, cacheSet } from '../../../../lib/cache'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.all' })

interface BookingApiResult {
  eventId: string
  firstName: string
  lastName: string
  phone: string
  email: string
  procedureName: string
  startTime: string // ISO string
  endTime: string   // ISO string
  price: number
  canModify: boolean
  canCancel: boolean
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    const forceRefresh = searchParams.get('force') === 'true'

    // Default to 90 days from now if no dates provided
    // Round to current day for stable cache keys
    const now = new Date()
    const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Start of today
    const defaultStart = currentDay
    const defaultEnd = new Date(currentDay.getTime() + (90 * 24 * 60 * 60 * 1000))   // +90 days
    
    const startDate = startParam ? new Date(startParam) : defaultStart
    const endDate = endParam ? new Date(endParam) : defaultEnd
    
    const startISO = startDate.toISOString()
    const endISO = endDate.toISOString()

    log.debug({ startISO, endISO }, 'Fetching all calendar events')

    // Create stable cache key (same for all requests on the same day)
    const cacheKey = `calendar:events:${startISO}:${endISO}`
    
    // Try to get from cache first (unless force refresh requested)
    if (!forceRefresh) {
      const cached = await cacheGet<BookingApiResult[]>(cacheKey)
      if (cached) {
        log.debug({ count: cached.length }, 'Returning cached calendar events')
        return NextResponse.json({
          bookings: cached,
          startISO,
          endISO,
          count: cached.length,
          cached: true
        })
      }
    } else {
      log.info('Force refresh requested - bypassing cache')
    }

    // Get all events from Google Calendar
    const { calendar } = getClients()
    
    const response = await calendar.events.list({
      calendarId: config.GOOGLE_CALENDAR_ID,
      timeMin: startISO,
      timeMax: endISO,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500, // Increase limit for longer periods
    })

    const events = response.data.items || []
    log.debug({ count: events.length }, 'Raw calendar events fetched')

    // Parse and process each event
    const bookings: BookingApiResult[] = []
    
    for (const event of events) {
      try {
        const bookingData = parseBookingData(event)
        
        // Only include bookings with complete client data (not master's personal notes)
        if (bookingData && 
            bookingData.firstName && 
            bookingData.firstName.trim().length > 0 &&
            bookingData.phone && 
            bookingData.phone.trim().length > 0) {
          
          const modificationCheck = canModifyBooking(bookingData.startTime)
          
          bookings.push({
            eventId: bookingData.eventId,
            firstName: bookingData.firstName,
            lastName: bookingData.lastName,
            phone: bookingData.phone,
            email: bookingData.email || '',
            procedureName: bookingData.procedureName,
            startTime: bookingData.startTime.toISOString(),
            endTime: bookingData.endTime.toISOString(),
            price: bookingData.price,
            canModify: modificationCheck.canModify,
            canCancel: modificationCheck.canModify
          })
        }
      } catch (error) {
        log.warn({ eventId: event.id, error }, 'Failed to parse booking data for event')
        // Continue processing other events
      }
    }
    
    log.debug({ parsedCount: bookings.length, totalEvents: events.length }, 'Calendar events processed')

    // Cache the results for 5 minutes
    await cacheSet(cacheKey, bookings, 300)

    return NextResponse.json({
      bookings,
      startISO,
      endISO,
      count: bookings.length,
      cached: false
    })

  } catch (error: any) {
    log.error({ error }, 'Failed to fetch calendar events')
    await reportError(error, {
      tags: { module: 'api.bookings.all' },
      extras: { error: error.message }
    })

    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 }
    )
  }
}
