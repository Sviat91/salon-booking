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
 * POST - Check if booking can be extended to accommodate longer procedure
 * Returns one of three scenarios:
 * 1. Can extend at same time (green)
 * 2. Can shift back + alternatives (yellow)
 * 3. No availability on day (red)
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

    log.info({ 
      eventId, 
      newProcedureId: body.newProcedureId,
      message: '🔍 Checking extension possibility'
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

    const currentStart = new Date(body.currentStartISO)
    const currentEnd = new Date(body.currentEndISO)
    const currentDuration = (currentEnd.getTime() - currentStart.getTime()) / 60000
    const newDuration = newProcedure.duration_min
    const extensionNeeded = newDuration - currentDuration

    log.info({
      currentDuration,
      newDuration,
      extensionNeeded,
      message: '📊 Duration analysis'
    })

    // If new procedure is same or shorter, no check needed
    if (extensionNeeded <= 0) {
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

    // Get busy times for the day
    const TZ = 'Europe/Warsaw'
    const currentStartLocal = toZonedTime(currentStart, TZ)
    const dateISO = format(currentStartLocal, 'yyyy-MM-dd')
    
    const dayStart = fromZonedTime(dateISO + 'T00:00:00', TZ)
    const dayEnd = fromZonedTime(dateISO + 'T23:59:59', TZ)

    const busyTimes = await getBusyTimesWithIds(dayStart.toISOString(), dayEnd.toISOString())

    // Filter out current booking from busy times
    // Use eventId from params to exclude the exact booking being modified
    const otherBookings = busyTimes.filter((busy: { start: string; end: string; id?: string }) => {
      // First check by eventId if available
      if (busy.id && busy.id === eventId) {
        log.info({ excludedByEventId: busy.id, message: '🔍 Excluding current booking by eventId' })
        return false
      }
      
      // Fallback: check by time (with small tolerance for rounding)
      const busyStart = new Date(busy.start).getTime()
      const busyEnd = new Date(busy.end).getTime()
      const currentStartTime = currentStart.getTime()
      const currentEndTime = currentEnd.getTime()
      
      const isSameTime = Math.abs(busyStart - currentStartTime) < 1000 && Math.abs(busyEnd - currentEndTime) < 1000
      if (isSameTime) {
        log.info({ excludedByTime: { start: busy.start, end: busy.end }, message: '🔍 Excluding current booking by time match' })
        return false
      }
      
      return true
    })

    log.info({
      eventId,
      currentStartISO: body.currentStartISO,
      currentEndISO: body.currentEndISO,
      totalBusy: busyTimes.length,
      otherBookings: otherBookings.length,
      otherBookingsDetails: otherBookings.map((b: { start: string; end: string; id?: string }) => ({ 
        id: b.id, 
        start: b.start, 
        end: b.end 
      })),
      message: '📅 Busy times fetched and current booking excluded'
    })

    // Calculate new end time if extending at same start
    const newEnd = new Date(currentStart.getTime() + (newDuration * 60 * 1000))

    // Check if can extend at current start time
    const canExtendAtSameTime = !otherBookings.some((busy: { start: string; end: string }) => {
      const busyStart = new Date(busy.start).getTime()
      const busyEnd = new Date(busy.end).getTime()
      
      // Check if new booking would overlap
      return (currentStart.getTime() < busyEnd && newEnd.getTime() > busyStart)
    })

    log.info({
      currentStart: currentStart.toISOString(),
      newEnd: newEnd.toISOString(),
      canExtendAtSameTime,
      message: '🔍 Checking if can extend at same time'
    })

    // Check working hours with exceptions support (same logic as getDaySlots)
    const weekly = await readWeekly()
    const exceptions = await readExceptions()
    const weekday = currentStartLocal.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    
    // Start with weekly schedule, then override with exceptions if present
    let hours = weekly[weekday]?.hours || ''
    let isDayOff = weekly[weekday]?.isDayOff || false
    if (exceptions[dateISO]) {
      const ex = exceptions[dateISO]
      if (ex.hours) hours = ex.hours
      isDayOff = ex.isDayOff
    }
    
    log.info({
      dateISO,
      weekday,
      weeklyHours: weekly[weekday]?.hours,
      weeklyDayOff: weekly[weekday]?.isDayOff,
      exceptionHours: exceptions[dateISO]?.hours,
      exceptionDayOff: exceptions[dateISO]?.isDayOff,
      finalHours: hours,
      finalDayOff: isDayOff,
      message: '📅 Working hours determined (with exceptions)'
    })
    
    if (isDayOff || !hours) {
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

    // Parse working hours (format: "HH:MM-HH:MM")
    const scheduleMatch = hours.match(/(\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2})/)
    if (!scheduleMatch) {
      return NextResponse.json<CheckExtensionResponse>({
        result: {
          status: 'no_availability',
          message: 'Nie można odczytać godzin pracy.'
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

    const [, startHourStr, startMinStr, endHourStr, endMinStr] = scheduleMatch
    const scheduleEnd = new Date(currentStartLocal)
    scheduleEnd.setHours(parseInt(endHourStr), parseInt(endMinStr), 0, 0)

    const newEndLocal = toZonedTime(newEnd, TZ)
    const withinSchedule = newEndLocal.getTime() <= scheduleEnd.getTime()

    log.info({
      workingHours: hours,
      scheduleEnd: scheduleEnd.toISOString(),
      newEndLocal: newEndLocal.toISOString(),
      withinSchedule,
      message: '📅 Working hours boundary check'
    })

    if (canExtendAtSameTime && withinSchedule) {
      // Scenario 1: GREEN - Can extend at same time
      log.info({ message: '✅ Can extend at same time' })
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

    // Scenario 2: YELLOW - Try to shift back
    const shiftBackStart = new Date(currentStart.getTime() - (extensionNeeded * 60 * 1000))
    const shiftBackEnd = currentEnd

    // Check if shifted time is within schedule
    const scheduleStart = new Date(currentStartLocal)
    scheduleStart.setHours(parseInt(startHourStr), parseInt(startMinStr), 0, 0)
    
    const shiftBackStartLocal = toZonedTime(shiftBackStart, TZ)
    const isWithinStartSchedule = shiftBackStartLocal.getTime() >= scheduleStart.getTime()
    const hasNoConflicts = !otherBookings.some((busy: { start: string; end: string }) => {
      const busyStart = new Date(busy.start).getTime()
      const busyEnd = new Date(busy.end).getTime()
      const hasConflict = (shiftBackStart.getTime() < busyEnd && shiftBackEnd.getTime() > busyStart)
      if (hasConflict) {
        log.info({
          conflictingBooking: { start: busy.start, end: busy.end },
          message: '⚠️ Shift back would conflict with this booking'
        })
      }
      return hasConflict
    })
    const canShiftBack = isWithinStartSchedule && hasNoConflicts

    log.info({
      shiftBackStart: shiftBackStart.toISOString(),
      shiftBackEnd: shiftBackEnd.toISOString(),
      scheduleStart: scheduleStart.toISOString(),
      isWithinStartSchedule,
      hasNoConflicts,
      canShiftBack,
      message: '⏪ Checking if can shift back'
    })

    if (canShiftBack) {
      // Find alternative slots for the day using getDaySlots
      const daySlotsResult = await getDaySlots(dateISO, newDuration)
      
      const alternativeSlots = daySlotsResult.slots
        .filter((slot: { startISO: string; endISO: string }) => {
          // Exclude the suggested shift-back slot
          const slotStart = new Date(slot.startISO).getTime()
          return slotStart !== shiftBackStart.getTime()
        })
        .slice(0, 5) // Limit to 5 alternatives

      log.info({ 
        shiftBackMinutes: extensionNeeded,
        alternativesFound: alternativeSlots.length,
        message: '⚠️ Can shift back'
      })

      return NextResponse.json<CheckExtensionResponse>({
        result: {
          status: 'can_shift_back',
          suggestedStartISO: shiftBackStart.toISOString(),
          suggestedEndISO: shiftBackEnd.toISOString(),
          message: `Możesz przesunąć wizytę o ${extensionNeeded} min wcześniej (nowy czas: ${shiftBackStart.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}) i zmienić procedurę.`,
          alternativeSlots
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

    // Scenario 3: RED - No availability
    // Find any available slots for the day
    const allDaySlotsResult = await getDaySlots(dateISO, newDuration)
    const allDaySlots = allDaySlotsResult.slots

    log.info({ 
      dateISO,
      newDuration,
      availableSlotsOnDay: allDaySlots.length,
      slots: allDaySlots.slice(0, 3), // First 3 slots for debugging
      message: '❌ Cannot extend or shift back - checking all day slots'
    })

    if (allDaySlots.length > 0) {
      // There are other slots available on the day
      return NextResponse.json<CheckExtensionResponse>({
        result: {
          status: 'no_availability',
          message: `Nie można wydłużyć wizyty na aktualny czas. Dostępne są inne terminy tego dnia - wybierz nowy termin z kalendarza.`
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

    return NextResponse.json<CheckExtensionResponse>({
      result: {
        status: 'no_availability',
        message: `W dniu Twojej rezerwacji nie ma wolnego czasu na dłuższą procedurę. Wybierz nowy termin z kalendarza.`
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
