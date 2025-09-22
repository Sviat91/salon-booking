import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateTurnstileForAPI } from '../../../../lib/turnstile'
import { getClients } from '../../../../lib/google/auth'
import { parseBookingData, type BookingData } from '../../../../lib/google/calendar'
import { matchesSearchCriteria, canModifyBooking, type UserAccessCriteria } from '../../../../lib/booking-helpers'
import { config } from '../../../../lib/env'
import { getLogger } from '../../../../lib/logger'
import { reportError } from '../../../../lib/sentry'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.search' })

// Input validation schema
const SearchBodySchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().min(5).max(20),
  email: z.string().email().optional().or(z.literal('')),
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(),   // ISO date string
  turnstileToken: z.string().optional(),
})

// Output types
interface SearchResult {
  eventId: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  procedureName: string
  startTime: string // ISO string
  endTime: string   // ISO string
  price: number
  canModify: boolean // false if less than 24h until appointment
  canCancel: boolean // false if less than 24h until appointment
}

interface SearchResponse {
  results: SearchResult[]
  totalFound: number
  searchCriteria: {
    firstName: string
    lastName: string
    phone: string
    email?: string
    dateRange: {
      from: string
      to: string
    }
  }
}

// Helper functions moved to src/lib/booking-helpers.ts

export async function POST(req: NextRequest) {
  let body: z.infer<typeof SearchBodySchema> | null = null
  let ip = '0.0.0.0'

  try {
    // Parse and validate request body
    body = SearchBodySchema.parse(await req.json())
    ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ip

    log.debug({ 
      ip, 
      firstName: body.firstName, 
      lastName: body.lastName,
      phone: body.phone.slice(0, 4) + '***', // Log partial phone for privacy
      hasEmail: !!body.email 
    }, 'Booking search request')

    // Validate Turnstile
    const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip)
    if (!turnstileResult.success) {
      log.warn({ ip, reason: turnstileResult.errorResponse?.code }, 'Turnstile validation failed for search')
      return NextResponse.json(
        turnstileResult.errorResponse,
        { status: turnstileResult.status }
      )
    }

    // Set default date range if not provided
    const now = new Date()
    const defaultFrom = now.toISOString().split('T')[0] // Today
    const defaultTo = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0] // +3 months

    const dateFrom = body.dateFrom || defaultFrom
    const dateTo = body.dateTo || defaultTo

    // Validate date range
    if (dateFrom > dateTo) {
      return NextResponse.json(
        { error: 'Invalid date range', code: 'INVALID_DATE_RANGE' },
        { status: 400 }
      )
    }

    // Search calendar events
    const { calendar } = getClients()
    
    log.debug({ ip, dateFrom, dateTo }, 'Searching calendar events')

    const timeMin = `${dateFrom}T00:00:00Z`
    const timeMax = `${dateTo}T23:59:59Z`

    const response = await calendar.events.list({
      calendarId: config.GOOGLE_CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 1000, // Reasonable limit
    })

    const events = response.data.items || []
    log.debug({ ip, eventsFound: events.length }, 'Calendar events retrieved')

    // Parse and filter events
    const matchingBookings: SearchResult[] = []
    
    for (const event of events) {
      try {
        const bookingData = parseBookingData(event)
        if (!bookingData) continue

        // Check if booking matches search criteria
        if (matchesSearchCriteria(bookingData, {
          firstName: body.firstName,
          lastName: body.lastName,
          phone: body.phone,
          email: body.email,
        })) {
          const modificationCheck = canModifyBooking(bookingData.startTime)
          
          matchingBookings.push({
            eventId: bookingData.eventId,
            firstName: bookingData.firstName,
            lastName: bookingData.lastName,
            phone: bookingData.phone,
            email: bookingData.email,
            procedureName: bookingData.procedureName,
            startTime: bookingData.startTime.toISOString(),
            endTime: bookingData.endTime.toISOString(),
            price: bookingData.price,
            canModify: modificationCheck.canModify,
            canCancel: modificationCheck.canModify, // Same rule for cancellation
          })
        }
      } catch (error) {
        log.warn({ ip, eventId: event.id, error }, 'Failed to parse calendar event')
        // Continue processing other events
      }
    }

    // Sort by start time (ascending)
    matchingBookings.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    const searchResponse: SearchResponse = {
      results: matchingBookings,
      totalFound: matchingBookings.length,
      searchCriteria: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        email: body.email,
        dateRange: {
          from: dateFrom,
          to: dateTo,
        },
      },
    }

    log.info({ 
      ip, 
      totalFound: matchingBookings.length,
      searchFirstName: body.firstName,
      searchLastName: body.lastName,
    }, 'Booking search completed')

    const response_final = NextResponse.json(searchResponse)
    response_final.headers.set('Cache-Control', 'no-store')
    return response_final

  } catch (err: any) {
    const isValidationError = err instanceof z.ZodError
    
    if (isValidationError) {
      const issuePaths = err.issues?.map(issue => (issue.path.length ? issue.path.join('.') : '(root)')) ?? []
      log.warn({ ip, issuePaths }, 'Booking search request validation failed')
    } else {
      log.error({
        err,
        ip,
        searchData: body ? {
          firstName: body.firstName,
          lastName: body.lastName,
          hasEmail: !!body.email,
        } : null,
      }, 'Booking search handler failed')

      await reportError(err, {
        tags: { module: 'api.bookings.search' },
        extras: {
          ip,
          searchData: body ? {
            firstName: body.firstName,
            lastName: body.lastName,
            hasEmail: !!body.email,
          } : null,
        },
      })
    }

    const details = isValidationError ? JSON.stringify(err.issues) : String(err?.message || err)
    const status = isValidationError ? 400 : 500
    return NextResponse.json({ error: 'Failed to search bookings', details }, { status })
  }
}
