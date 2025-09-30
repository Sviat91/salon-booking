import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateTurnstileForAPI } from '../../../../../lib/turnstile'
import { getClients } from '../../../../../lib/google/auth'
import { getBusyTimesWithIds } from '../../../../../lib/google/calendar'
import { getDaySlots } from '../../../../../lib/availability'
import { readProcedures, readWeekly, readExceptions } from '../../../../../lib/google/sheets'
import { config } from '../../../../../lib/env'
import { getLogger } from '../../../../../lib/logger'
import { reportError } from '../../../../../lib/sentry'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.check-extension' })

// Input validation schema
const CheckExtensionSchema = z.object({
  turnstileToken: z.string().optional(),
  eventId: z.string().min(1),
  currentStartISO: z.string(),
  currentEndISO: z.string(),
  newProcedureId: z.string().min(1),
})

// Response types
type ExtensionCheckResult = 
  | { status: 'can_extend'; message: string }
  | { status: 'can_shift_back'; suggestedStartISO: string; suggestedEndISO: string; message: string; alternativeSlots: Array<{ startISO: string; endISO: string }> }
  | { status: 'no_availability'; message: string }

interface CheckExtensionResponse {
  result: ExtensionCheckResult
  currentBooking: {
    startISO: string
    endISO: string
  }
  newProcedure: {
    id: string
    name: string
    duration: number
  }
}

/**
 * SIMPLIFIED POST - Check if booking can be extended to accommodate longer procedure
 * 
 * Simple approach:
 * 1. Get busy times for the day (5:00-22:00)
 * 2. Get working hours from Weekly + Exceptions
 * 3. Return raw data for client to analyze
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: z.infer<typeof CheckExtensionSchema>
  let ip = '0.0.0.0'

  try {
    const eventId = params.id
    body = CheckExtensionSchema.parse(await req.json())
    ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ip

    const TZ = 'Europe/Warsaw'
    const currentStart = new Date(body.currentStartISO)
    const currentEnd = new Date(body.currentEndISO)
    const currentStartLocal = toZonedTime(currentStart, TZ)
    const dateISO = format(currentStartLocal, 'yyyy-MM-dd')

    log.info({ 
      eventId,
      dateISO,
      currentStartISO: body.currentStartISO,
      currentEndISO: body.currentEndISO,
      newProcedureId: body.newProcedureId,
      message: '🔍 STEP 1: Parse input data'
    })

    // Validate Turnstile
    if (body.turnstileToken) {
      const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip)
      if (!turnstileResult.success) {
        return NextResponse.json(
          { error: 'Nieprawidłowy token bezpieczeństwa.' },
          { status: 400 }
        )
      }
    }

    // Get new procedure info
    const procedures = await readProcedures()
    const newProcedure = procedures.find(p => p.id === body.newProcedureId)
    
    if (!newProcedure) {
      return NextResponse.json(
        { error: 'Nie znaleziono procedury.' },
        { status: 404 }
      )
    }

    const currentDuration = (currentEnd.getTime() - currentStart.getTime()) / 60000
    const newDuration = newProcedure.duration_min
    const extensionNeeded = newDuration - currentDuration

    log.info({
      currentDuration,
      newDuration,
      extensionNeeded,
      message: '📊 STEP 2: Duration analysis'
    })

    // If new procedure is same or shorter, no check needed
    if (extensionNeeded <= 0) {
      log.info({ message: '✅ No extension needed - procedure is same or shorter' })
      return NextResponse.json<CheckExtensionResponse>({
        result: {
          status: 'can_extend',
          message: 'Nowa procedura jest krótsza lub równa obecnej. Można zmienić bez przesunięcia czasu.'
        },
        currentBooking: {
          startISO: body.currentStartISO,
          endISO: body.currentEndISO,
        },
        newProcedure: {
          id: newProcedure.id,
          name: newProcedure.name_pl,
          duration: newProcedure.duration_min,
        }
      })
    }

    // STEP 3: Get busy times for the day (5:00-22:00)
    const dayStart = fromZonedTime(dateISO + 'T05:00:00', TZ)
    const dayEnd = fromZonedTime(dateISO + 'T22:00:00', TZ)

    const busyTimes = await getBusyTimesWithIds(dayStart.toISOString(), dayEnd.toISOString())
    
    log.info({
      dateISO,
      dayStartISO: dayStart.toISOString(),
      dayEndISO: dayEnd.toISOString(),
      busyTimesCount: busyTimes.length,
      busyTimesRaw: busyTimes.map((b: { start: string; end: string; id?: string }) => ({
        id: b.id,
        start: b.start,
        end: b.end
      })),
      message: '📅 STEP 3: Got busy times (5:00-22:00)'
    })

    // STEP 4: Get working hours from Weekly + Exceptions
    const weekly = await readWeekly()
    const exceptions = await readExceptions()
    
    const weekday = currentStartLocal.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    
    let hours = weekly[weekday]?.hours || ''
    let isDayOff = weekly[weekday]?.isDayOff || false
    
    // Override with exceptions if present
    if (exceptions[dateISO]) {
      const ex = exceptions[dateISO]
      if (ex.hours) hours = ex.hours
      isDayOff = ex.isDayOff
    }
    
    log.info({
      dateISO,
      weekday,
      weeklyHours: weekly[weekday]?.hours,
      exceptionHours: exceptions[dateISO]?.hours,
      finalHours: hours,
      isDayOff,
      message: '🕐 STEP 4: Got working hours'
    })

    // STEP 5: Check if day is closed
    if (isDayOff || !hours) {
      log.warn({ message: '❌ Salon is closed on this day' })
      return NextResponse.json<CheckExtensionResponse>({
        result: {
          status: 'no_availability',
          message: 'Salon jest zamknięty w tym dniu.'
        },
        currentBooking: {
          startISO: body.currentStartISO,
          endISO: body.currentEndISO,
        },
        newProcedure: {
          id: newProcedure.id,
          name: newProcedure.name_pl,
          duration: newProcedure.duration_min,
        }
      })
    }

    // STEP 6: Filter out current booking from busy times
    const otherBookings = busyTimes.filter((busy: { start: string; end: string; id?: string }) => {
      if (busy.id && busy.id === eventId) {
        log.info({ excludedByEventId: busy.id, message: '✅ Excluded current booking' })
        return false
      }
      const busyStart = new Date(busy.start).getTime()
      const busyEnd = new Date(busy.end).getTime()
      const isSameTime = Math.abs(busyStart - currentStart.getTime()) < 1000 && 
                         Math.abs(busyEnd - currentEnd.getTime()) < 1000
      if (isSameTime) {
        log.info({ excludedByTime: busy, message: '✅ Excluded by time match' })
        return false
      }
      return true
    })

    log.info({
      totalBusy: busyTimes.length,
      otherBookings: otherBookings.length,
      message: '✅ STEP 6: Filtered current booking'
    })

    // STEP 7: Check if can extend at current time
    const newEnd = new Date(currentStart.getTime() + (newDuration * 60 * 1000))
    const hasConflict = otherBookings.some((busy: { start: string; end: string }) => {
      const busyStart = new Date(busy.start).getTime()
      const busyEnd = new Date(busy.end).getTime()
      return (currentStart.getTime() < busyEnd && newEnd.getTime() > busyStart)
    })

    if (!hasConflict) {
      log.info({ message: '✅ STEP 7: Can extend at same time!' })
      return NextResponse.json<CheckExtensionResponse>({
        result: {
          status: 'can_extend',
          message: `Czas jest dostępny! Możesz zmienić procedurę na "${newProcedure.name_pl}" (${newDuration} min) bez zmiany godziny rozpoczęcia.`
        },
        currentBooking: {
          startISO: body.currentStartISO,
          endISO: body.currentEndISO,
        },
        newProcedure: {
          id: newProcedure.id,
          name: newProcedure.name_pl,
          duration: newProcedure.duration_min,
        }
      })
    }

    log.warn({ message: '❌ STEP 7: Cannot extend - time conflict detected' })
    
    // For now, return no_availability - we'll add shift logic later
    return NextResponse.json<CheckExtensionResponse>({
      result: {
        status: 'no_availability',
        message: `Nie można wydłużyć wizyty na aktualny czas. Wybierz nowy termin z kalendarza.`
      },
      currentBooking: {
        startISO: body.currentStartISO,
        endISO: body.currentEndISO,
      },
      newProcedure: {
        id: newProcedure.id,
        name: newProcedure.name_pl,
        duration: newProcedure.duration_min,
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn({ issues: error.issues, message: '❌ Validation error' })
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe.' },
        { status: 400 }
      )
    }

    log.error({ err: error, message: '❌ Unexpected error in extension check' })
    await reportError(error instanceof Error ? error : new Error(String(error)), {
      tags: { module: 'api.bookings.check-extension' },
    })
    
    return NextResponse.json(
      { error: 'Wystąpił błąd wewnętrzny serwera.' },
      { status: 500 }
    )
  }
}
