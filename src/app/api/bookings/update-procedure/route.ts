import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateTurnstileForAPI } from '../../../../lib/turnstile'
import { getLogger } from '../../../../lib/logger'
import { updateBookingInCalendar, getProcedureInfo } from '../../../../lib/booking-modification-helpers'
import { reportError } from '../../../../lib/sentry'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.update-procedure' })

// Схема с данными для обновления процедуры
const UpdateProcedureSchema = z.object({
  // NO TURNSTILE REQUIRED - user already verified during search
  // Token kept optional for backward compatibility only
  turnstileToken: z.string().optional(),
  
  // Event ID
  eventId: z.string().min(1, 'Event ID is required'),
  
  // Data to preserve in booking
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  
  // Current booking time (to calculate new end time)
  currentStartISO: z.string(),
  
  // New procedure
  newProcedureId: z.string().min(1, 'New procedure ID is required'),
})

/**
 * POST - Изменение процедуры без изменения времени начала
 */
export async function POST(req: NextRequest) {
  try {
    log.info({ message: '💆‍♀️ Procedure update request received' })
    
    const body = await req.json()
    log.info({ 
      eventId: body.eventId, 
      newProcedureId: body.newProcedureId,
      turnstileToken: body.turnstileToken ? '[PRESENT]' : '[MISSING]',
      message: '📝 Request body'
    })

    // Validate request body
    const validatedData = UpdateProcedureSchema.parse(body)
    
    const { 
      eventId, 
      firstName, 
      lastName, 
      phone, 
      email, 
      currentStartISO,
      newProcedureId, 
      turnstileToken 
    } = validatedData

    // Validate Turnstile if token provided
    if (turnstileToken) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
      const turnstileResult = await validateTurnstileForAPI(turnstileToken, ip)
      if (!turnstileResult.success) {
        log.warn({ message: '❌ Turnstile validation failed' })
        return NextResponse.json(
          { error: 'Nieprawidłowy token bezpieczeństwa.' },
          { status: 400 }
        )
      }
      log.info({ message: '✅ Turnstile validation passed' })
    }

    // Get new procedure info
    const procedureResult = await getProcedureInfo(newProcedureId)
    if (!procedureResult.success || !procedureResult.procedure) {
      log.error({ newProcedureId, message: '❌ Failed to fetch procedure' })
      return NextResponse.json(
        { error: 'Nie udało się pobrać informacji o nowej procedurze.' },
        { status: 400 }
      )
    }

    const newProcedure = procedureResult.procedure
    log.info({ 
      procedureName: newProcedure.name_pl,
      duration: newProcedure.duration_min,
      price: newProcedure.price_pln,
      message: '📋 New procedure fetched'
    })

    // Calculate new end time based on new procedure duration
    const startTime = new Date(currentStartISO)
    const endTime = new Date(startTime.getTime() + (newProcedure.duration_min * 60 * 1000))
    const newEndISO = endTime.toISOString()

    log.info({ 
      start: currentStartISO,
      end: newEndISO,
      message: '🕒 New time window calculated'
    })

    // Create full description with new price
    const fullName = `${firstName} ${lastName}`.trim()
    const description = `Imię Nazwisko: ${fullName}\nTelefon: ${phone}${email ? `\nEmail: ${email}` : ''}\nCena: ${newProcedure.price_pln}zł\n---\nZaktualizowano: ${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}`
    
    // Update in calendar
    const updateResult = await updateBookingInCalendar(
      eventId,
      {
        summary: newProcedure.name_pl, // New procedure name
        description: description, // Updated description with new price
        startISO: currentStartISO, // Keep start time
        endISO: newEndISO, // Adjust end time for new duration
      },
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    )

    if (!updateResult.success) {
      log.error({ eventId, message: '❌ Failed to update booking in calendar' })
      await reportError(new Error('Failed to update procedure in calendar'), {
        tags: { module: 'api.bookings.update-procedure' },
        extras: { eventId, newProcedureId },
      })
      return NextResponse.json(
        { error: 'Nie udało się zaktualizować procedury w kalendarzu. Skontaktuj się z obsługą.' },
        { status: 500 }
      )
    }

    log.info({ 
      eventId,
      newProcedure: newProcedure.name_pl,
      message: '✅ Successfully updated booking procedure'
    })
    return NextResponse.json({ 
      success: true,
      message: 'Procedura została pomyślnie zmieniona.',
      eventId,
      newProcedure: {
        id: newProcedure.id,
        name: newProcedure.name_pl,
        duration: newProcedure.duration_min,
        price: newProcedure.price_pln,
      },
      newTime: {
        start: currentStartISO,
        end: newEndISO,
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

    log.error({ err: error, message: '❌ Unexpected error in procedure update' })
    await reportError(error instanceof Error ? error : new Error(String(error)), {
      tags: { module: 'api.bookings.update-procedure' },
    })
    
    return NextResponse.json(
      { error: 'Wystąpił błąd wewnętrzny serwera.' },
      { status: 500 }
    )
  }
}
