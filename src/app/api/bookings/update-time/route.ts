import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLogger } from '../../../../lib/logger'
import { updateBookingInCalendar } from '../../../../lib/booking-modification-helpers'
import { reportError } from '../../../../lib/sentry'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.bookings.update-time' })

// Схема с данными для сохранения (не для валидации)
// NO TURNSTILE - user already verified during search
const UpdateTimeSchema = z.object({
  // Event ID
  eventId: z.string().min(1, 'Event ID is required'),
  
  // Data to preserve in booking
  procedureName: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  price: z.number(),
  
  // New time (both required together)
  newStartISO: z.string(),
  newEndISO: z.string(),
})

/**
 * POST - Простое изменение времени бронирования
 * Пока что заглушка - возвращаем успех
 */
export async function POST(req: NextRequest) {
  try {
    log.info('🕒 Simple time update request received (no Turnstile)')
    
    const body = await req.json()
    log.info({ eventId: body.eventId, procedureName: body.procedureName }, '📝 Request body')

    // Validate request body
    const validatedData = UpdateTimeSchema.parse(body)
    
    const { eventId, procedureName, firstName, lastName, phone, email, price, newStartISO, newEndISO } = validatedData

    // NO TURNSTILE VALIDATION - user already verified during search
    log.info('✅ Skipping Turnstile (user already verified during search)')

    // Обновление с сохранением всех данных
    log.info(`🔄 Updating calendar event ${eventId} to new time: ${newStartISO} - ${newEndISO}`)
    log.info(`📋 Preserving data: ${procedureName} for ${firstName} ${lastName}`)
    
    // Создаем полное описание как в оригинальной записи
    const fullName = `${firstName} ${lastName}`
    const description = `Imię Nazwisko: ${fullName}\nTelefon: ${phone}${email ? `\nEmail: ${email}` : ''}\nCena: ${price}zł\n---\nUtworzono: ${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}`
    
    const success = await updateBookingInCalendar(
      eventId,
      {
        summary: procedureName, // Сохраняем название процедуры
        description: description, // Полное описание
        startISO: newStartISO,
        endISO: newEndISO,
      },
      req.ip || '127.0.0.1'
    )

    if (!success) {
      log.error(`❌ Failed to update booking ${eventId} in calendar`)
      return NextResponse.json(
        { error: 'Nie udało się zaktualizować terminu w kalendarzu. Skontaktuj się z obsługą.' },
        { status: 500 }
      )
    }

    log.info(`✅ Successfully updated booking ${eventId} in calendar`)
    return NextResponse.json({ 
      success: true,
      message: 'Termin rezerwacji został pomyślnie zmieniony.',
      eventId,
      newTime: {
        start: newStartISO,
        end: newEndISO,
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn('❌ Validation error')
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe.' },
        { status: 400 }
      )
    }

    log.error('❌ Unexpected error in time update')
    
    return NextResponse.json(
      { error: 'Wystąpił błąd wewnętrzny serwera.' },
      { status: 500 }
    )
  }
}
