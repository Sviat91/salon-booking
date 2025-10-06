import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { freeBusy, createEvent } from '../../../lib/google/calendar'
import { readProcedures, saveUserConsent } from '../../../lib/google/sheets'
import { cacheSetNX, cacheDel, rateLimit } from '../../../lib/cache'
import { verifyTurnstile } from '../../../lib/turnstile'
import { config } from '../../../lib/env'
import { getLogger } from '../../../lib/logger'
import { reportError } from '../../../lib/sentry'
import { bookingApiSchema, type BookingApiInput } from '../../../lib/validation/api-schemas'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.book' })

export async function POST(req: NextRequest) {
  let idemKey: string | null = null
  let body: BookingApiInput | null = null
  let ip = '0.0.0.0'

  try {
    const booking = bookingApiSchema.parse(await req.json())
    body = booking
    ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ip

    log.debug(
      { ip, startISO: booking.startISO, endISO: booking.endISO, procedureId: booking.procedureId, masterId: booking.masterId },
      'Incoming booking request',
    )

    const minute = await rateLimit(`rl:book:ip:${ip}:1m`, 10, 60)
    const hour = await rateLimit(`rl:book:ip:${ip}:1h`, 50, 3600)
    if (!minute.allowed || !hour.allowed) {
      const window = !minute.allowed ? '1m' : '1h'
      log.warn({ ip, window }, 'Booking rate limit exceeded')
      return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })
    }

    const needTs = !!config.TURNSTILE_SECRET_EFFECTIVE
    if (needTs) {
      const ts = await verifyTurnstile(booking.turnstileToken, ip)
      if (!ts.ok) {
        log.warn({ ip, code: ts.code, tokenPresent: !!booking.turnstileToken }, 'Turnstile verification failed')
        return NextResponse.json(
          { error: 'Turnstile verification failed', code: ts.code || 'TURNSTILE', details: { tokenPresent: !!booking.turnstileToken } },
          { status: 400 },
        )
      }
    }

    const busy = await freeBusy(booking.startISO, booking.endISO, booking.masterId)
    if (busy.length > 0) {
      log.info({ ip, startISO: booking.startISO, endISO: booking.endISO, conflicts: busy.length }, 'Booking conflict detected')
      return NextResponse.json({ error: 'Slot is no longer available', code: 'CONFLICT' }, { status: 409 })
    }

    idemKey = `idem:book:${booking.startISO}:${booking.endISO}:${booking.phone}`
    const acquired = await cacheSetNX(idemKey, 300)
    if (!acquired) {
      log.warn({ ip, startISO: booking.startISO, endISO: booking.endISO }, 'Duplicate booking attempt detected')
      return NextResponse.json({ error: 'Duplicate booking in progress', code: 'DUPLICATE' }, { status: 409 })
    }

    // Get procedure details for new format
    let summary = `Booking: ${booking.name}` // fallback if no procedure
    let procedureName = ''
    let price = 0
    
    if (booking.procedureId) {
      try {
        const procs = await readProcedures(booking.masterId)
        const proc = procs.find(p => p.id === booking.procedureId)
        if (proc) {
          summary = proc.name_pl // Use only procedure name as title
          procedureName = proc.name_pl
          price = proc.price_pln || 0
        }
      } catch (err) {
        log.warn({ err }, 'Failed to enrich booking summary with procedure name')
      }
    }

    // Split name into first and last name (at first space)
    const nameParts = booking.name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    // Create structured description in new format
    const description = `Imię Nazwisko: ${firstName} ${lastName}
Telefon: ${booking.phone}${booking.email ? `\nEmail: ${booking.email}` : ''}
Cena: ${price}zł
---
Utworzono: ${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}`

    const ev = await createEvent({ startISO: booking.startISO, endISO: booking.endISO, summary, description, masterId: booking.masterId })
    log.info({ ip, startISO: booking.startISO, endISO: booking.endISO, eventId: ev.id }, 'Booking created successfully')

    // Save user consents if provided
    if (booking.consents) {
      try {
        await saveUserConsent({
          phone: booking.phone,
          email: booking.email,
          name: booking.name,
          ip,
          consentPrivacyV10: booking.consents.dataProcessing,
          consentTermsV10: booking.consents.terms,
          consentNotificationsV10: booking.consents.notifications,
        })
        log.info({ ip, phone: booking.phone }, 'User consents saved successfully')
      } catch (consentError) {
        // Don't fail the booking if consent saving fails
        log.warn({ err: consentError, ip, phone: booking.phone }, 'Failed to save user consents')
        await reportError(consentError, {
          tags: { module: 'api.book.consents' },
          extras: { ip, phone: booking.phone, eventId: ev.id },
        })
      }
    }

    const res = NextResponse.json({ ok: true, eventId: ev.id })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (err: any) {
    if (idemKey) await cacheDel(idemKey)

    const isValidationError = err instanceof z.ZodError
    if (isValidationError) {
      const issuePaths = err.issues?.map(issue => (issue.path.length ? issue.path.join('.') : '(root)')) ?? []
      log.warn({ ip, issuePaths }, 'Booking request validation failed')
    } else {
      log.error(
        { err, idemKey, ip, startISO: body?.startISO, endISO: body?.endISO, procedureId: body?.procedureId, masterId: body?.masterId },
        'Booking handler failed',
      )
      await reportError(err, {
        tags: { module: 'api.book' },
        extras: {
          idemKey,
          ip,
          startISO: body?.startISO,
          endISO: body?.endISO,
          procedureId: body?.procedureId,
          masterId: body?.masterId,
        },
      })
    }

    const details = isValidationError ? JSON.stringify(err.issues) : String(err?.message || err)
    const status = isValidationError ? 400 : 500
    return NextResponse.json({ error: 'Failed to book', details }, { status })
  }
}