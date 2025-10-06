import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBusyTimesWithIds } from '../../../../../lib/google/calendar'
import { readProcedures, readWeekly, readExceptions } from '../../../../../lib/google/sheets'
import { getLogger } from '../../../../../lib/logger'
import { reportError } from '../../../../../lib/sentry'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.check-extension' })

// Input validation schema
const CheckExtensionSchema = z.object({
  eventId: z.string().min(1),
  currentStartISO: z.string(),
  currentEndISO: z.string(),
  newProcedureId: z.string().min(1),
  masterId: z.string().optional(),
})

// Response types
type ExtensionCheckResult = 
  | { status: 'can_extend'; message: string }
  | { status: 'can_shift_back'; suggestedStartISO: string; suggestedEndISO: string; shiftMinutes: number; message: string; reason: string; alternativeSlots: Array<{ startISO: string; endISO: string }> }
  | { status: 'no_availability'; message: string; reason?: string }

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

  try {
    const eventId = params.id
    body = CheckExtensionSchema.parse(await req.json())

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
      message: '🔍 STEP 1: Parse input data (no Turnstile - user already verified during search)'
    })

    // Get new procedure info
    const procedures = await readProcedures(body.masterId)
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

    const busyTimes = await getBusyTimesWithIds(dayStart.toISOString(), dayEnd.toISOString(), body.masterId)
    
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
    const weekly = await readWeekly(body.masterId)
    const exceptions = await readExceptions(body.masterId)
    
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
    
    // Check for conflicts with other bookings
    const hasConflict = otherBookings.some((busy: { start: string; end: string }) => {
      const busyStart = new Date(busy.start).getTime()
      const busyEnd = new Date(busy.end).getTime()
      return (currentStart.getTime() < busyEnd && newEnd.getTime() > busyStart)
    })

    if (hasConflict) {
      log.warn({ message: '❌ STEP 7: Cannot extend - time conflict with another booking' })
    } else {
      log.info({ message: '✅ No booking conflicts detected' })
    }

    // STEP 8: Check if new end time is within working hours
    // Normalize hours format: replace dots and spaces with colons (Google Sheets returns "09.00" or "09 00")
    const normalizedHours = hours.replace(/(\d{1,2})[.\s]+(\d{2})/g, '$1:$2')
    
    // Parse working hours (format: "HH:MM-HH:MM")
    const scheduleMatch = normalizedHours.match(/(\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2})/)
    if (!scheduleMatch) {
      log.error({ hours, message: '❌ Cannot parse working hours format' })
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

    const [, , , endHourStr, endMinStr] = scheduleMatch
    
    // Create schedule end using fromZonedTime (same approach as getDaySlots)
    const scheduleEndStr = `${dateISO}T${endHourStr.padStart(2, '0')}:${endMinStr.padStart(2, '0')}:00`
    const scheduleEnd = fromZonedTime(scheduleEndStr, TZ)
    
    const newEndLocal = toZonedTime(newEnd, TZ)
    const withinSchedule = newEnd.getTime() <= scheduleEnd.getTime()
    
    // Convert to minutes for easier comparison (like in availability.ts)
    const scheduleEndMinutes = parseInt(endHourStr) * 60 + parseInt(endMinStr)
    const newEndMinutes = newEndLocal.getHours() * 60 + newEndLocal.getMinutes()

    log.info({
      workingHoursRaw: hours,
      workingHoursNormalized: normalizedHours,
      dateISO,
      scheduleEndStr,
      scheduleEndTime: scheduleEnd.toISOString(),
      scheduleEndMinutes: `${Math.floor(scheduleEndMinutes / 60)}:${scheduleEndMinutes % 60} (${scheduleEndMinutes} min)`,
      currentStartTime: currentStart.toISOString(),
      currentStartLocal: currentStartLocal.toISOString(),
      newEndTime: newEnd.toISOString(),
      newEndLocalTime: newEndLocal.toISOString(),
      newEndMinutes: `${Math.floor(newEndMinutes / 60)}:${newEndMinutes % 60} (${newEndMinutes} min)`,
      comparison: `${newEndMinutes} <= ${scheduleEndMinutes} = ${newEndMinutes <= scheduleEndMinutes}`,
      withinSchedule,
      withinScheduleTimestamp: `${newEnd.getTime()} <= ${scheduleEnd.getTime()}`,
      message: '🕐 STEP 8: Check working hours boundary'
    })

    if (!hasConflict && withinSchedule) {
      log.info({ message: '✅ STEP 8: Can extend at same time!' })
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

    // STEP 9: Try shift-back if cannot extend (conflict or outside schedule)
    if ((hasConflict || !withinSchedule) && extensionNeeded > 0) {
      log.info({ message: '🔄 STEP 9: Cannot extend forward, trying shift-back logic...' })
      
      // Determine the reason why we can't extend
      const extensionBlockReason = hasConflict 
        ? 'konflikt z kolejną rezerwacją' 
        : 'przekroczenie godzin pracy'
      
      // WORK IN WARSAW TIMEZONE for DST safety
      // Convert current booking to local time
      const currentStartLocal = toZonedTime(currentStart, TZ)
      
      // Calculate proposed shift-back time in local timezone
      // Shift start back by extensionNeeded minutes
      const proposedStartLocal = new Date(currentStartLocal)
      proposedStartLocal.setMinutes(proposedStartLocal.getMinutes() - extensionNeeded)
      
      // Calculate proposed end time (start + new duration)
      const proposedEndLocal = new Date(proposedStartLocal)
      proposedEndLocal.setMinutes(proposedEndLocal.getMinutes() + newDuration)
      
      // Format local times properly for fromZonedTime (WITHOUT timezone offset!)
      const proposedStartStr = format(proposedStartLocal, 'yyyy-MM-dd HH:mm:ss')
      const proposedEndStr = format(proposedEndLocal, 'yyyy-MM-dd HH:mm:ss')
      
      // Convert back to UTC for API responses and comparisons
      const proposedStart = fromZonedTime(proposedStartStr, TZ)
      const proposedEnd = fromZonedTime(proposedEndStr, TZ)
      
      // Check if proposed start is within working hours
      const [, startHourStr, startMinStr] = scheduleMatch
      const scheduleStartMinutes = parseInt(startHourStr) * 60 + parseInt(startMinStr)
      const proposedStartMinutes = proposedStartLocal.getHours() * 60 + proposedStartLocal.getMinutes()
      const afterScheduleStart = proposedStartMinutes >= scheduleStartMinutes
      
      // Check if proposed time conflicts with any other booking
      const hasConflictAfterShift = otherBookings.some((busy: { start: string; end: string }) => {
        const busyStart = new Date(busy.start).getTime()
        const busyEnd = new Date(busy.end).getTime()
        // Check overlap: proposedStart < busyEnd AND proposedEnd > busyStart
        return (proposedStart.getTime() < busyEnd && proposedEnd.getTime() > busyStart)
      })
      
      log.info({
        extensionNeeded,
        extensionBlockReason,
        currentStartWarsawTime: format(currentStartLocal, 'yyyy-MM-dd HH:mm:ss'),
        proposedStartWarsawTime: proposedStartStr,
        proposedEndWarsawTime: proposedEndStr,
        proposedStartUTC: proposedStart.toISOString(),
        proposedEndUTC: proposedEnd.toISOString(),
        scheduleStartMinutes: `${Math.floor(scheduleStartMinutes / 60)}:${(scheduleStartMinutes % 60).toString().padStart(2, '0')} (${scheduleStartMinutes} min)`,
        proposedStartMinutes: `${Math.floor(proposedStartMinutes / 60)}:${(proposedStartMinutes % 60).toString().padStart(2, '0')} (${proposedStartMinutes} min)`,
        afterScheduleStart,
        hasConflictAfterShift,
        message: '🔄 STEP 9: Shift-back analysis (Warsaw TZ)'
      })
      
      if (afterScheduleStart && !hasConflictAfterShift) {
        log.info({ message: '✅ STEP 9: Can shift back!' })
        const formatTime = (d: Date) => {
          return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
        }
        
        return NextResponse.json<CheckExtensionResponse>({
          result: {
            status: 'can_shift_back',
            suggestedStartISO: proposedStart.toISOString(),
            suggestedEndISO: proposedEnd.toISOString(),
            shiftMinutes: extensionNeeded,
            reason: extensionBlockReason,
            message: `Nie możemy wydłużyć czasu na obecnym terminie (${extensionBlockReason}), ale możemy przesunąć Twoją rezerwację ${extensionNeeded} min wcześniej: ${formatTime(proposedStartLocal)}-${formatTime(proposedEndLocal)}.`,
            alternativeSlots: []
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
    }

    // STEP 10: Cannot extend and cannot shift back
    const reason = hasConflict 
      ? 'konflikt z innym terminem' 
      : 'nowa procedura wykracza poza godziny pracy'
    
    log.warn({ 
      hasConflict, 
      withinSchedule, 
      reason,
      message: '❌ STEP 10: Cannot extend and cannot shift back' 
    })
    
    return NextResponse.json<CheckExtensionResponse>({
      result: {
        status: 'no_availability',
        message: `Nie można wydłużyć wizyty na obecny dzień (${reason} i brak możliwości przesunięcia). Wybierz nowy termin z kalendarza.`,
        reason
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
