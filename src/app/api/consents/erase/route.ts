import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLogger } from '../../../../lib/logger'
import { rateLimit, cacheSetNX, cacheDel } from '../../../../lib/cache'
import { validateTurnstileForAPI } from '../../../../lib/turnstile'
import { eraseUserData } from '../../../../lib/google/sheets'
import { reportError } from '../../../../lib/sentry'
import { config } from '../../../../lib/env'
import { normalizePhoneToE164 } from '../../../../lib/utils/phone-normalization'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.consents.erase' })

const BodySchema = z.object({
  name: z.string().min(2).max(240),
  phone: z.string().min(5).max(40),
  email: z.string().email().max(180).optional(),
  consentAcknowledged: z.boolean().refine(v => v, 'consent must be acknowledged'),
  turnstileToken: z.string().min(10),
  requestId: z.string().max(64).optional(),
})

function normalizeNameForKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function buildIdempotencyKey(phone: string, name: string) {
  return `consent:erase:${phone}:${name}`
}

function maskPhoneForLog(phone: string) {
  if (!phone) return 'unknown'
  const visiblePrefix = phone.slice(0, 3)
  const visibleSuffix = phone.slice(-2)
  return `${visiblePrefix}***${visibleSuffix}`
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  let body: z.infer<typeof BodySchema>

  try {
    body = BodySchema.parse(await req.json())
  } catch (err) {
    log.warn({ err }, 'Invalid consent erase payload')
    return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  const { name, phone, email, consentAcknowledged, turnstileToken, requestId } = body
  const trimmedName = name.trim()

  let normalizedPhone: string
  try {
    normalizedPhone = normalizePhoneToE164(phone)
  } catch (err) {
    return NextResponse.json({
      error: 'Invalid phone number',
      code: 'INVALID_PHONE',
      hints: ['Użyj pełnego numeru z kodem kraju, np. +48...'],
    }, { status: 400 })
  }

  if (!consentAcknowledged) {
    return NextResponse.json({
      error: 'Consent acknowledgement required',
      code: 'ACK_REQUIRED',
    }, { status: 400 })
  }

  const turnstile = await validateTurnstileForAPI(turnstileToken, ip, { requireToken: !!config.TURNSTILE_SECRET_EFFECTIVE })
  if (!turnstile.success) {
    return NextResponse.json(turnstile.errorResponse, { status: turnstile.status ?? 400 })
  }

  const rateKey = `rate:consent-erase:${ip ?? '0.0.0.0'}`
  const rate = await rateLimit(rateKey, 5, 15 * 60)
  if (!rate.allowed) {
    log.warn({ ip, rate }, 'Consent erase rate limited')
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })
  }

  const nameKey = normalizeNameForKey(trimmedName)
  const idempotencyKey = buildIdempotencyKey(normalizedPhone, nameKey)
  const idempotencyAcquired = await cacheSetNX(idempotencyKey, 15 * 60)
  if (!idempotencyAcquired) {
    return NextResponse.json({
      message: 'Request already processed or in progress',
      code: 'ALREADY_PROCESSING',
    }, { status: 202 })
  }

  try {
    const eraseResult = await eraseUserData({
      phone: normalizedPhone,
      name: trimmedName,
      email,
      erasureMethod: 'support_form',
      requestId,
    })

    if (!eraseResult.erased) {
      if (eraseResult.reason === 'NOT_FOUND') {
        await cacheDel(idempotencyKey)
        return NextResponse.json({
          error: 'Nie znaleźliśmy danych dla podanych informacji.',
          code: 'DATA_NOT_FOUND',
          hints: [
            'Sprawdź numer telefonu wraz z kodem kraju (np. +48...)',
            'Upewnij się, że imię i nazwisko wpisujesz dokładnie tak jak przy rezerwacji.',
            'Jeśli nadal masz problem, napisz do nas przez formularz wsparcia – odezwiemy się i dokończymy usunięcie.',
          ],
        }, { status: 404 })
      }

      if (eraseResult.reason === 'ALREADY_ERASED') {
        await cacheDel(idempotencyKey)
        return NextResponse.json({
          message: 'Twoje dane zostały już wcześniej usunięte.',
          code: 'ALREADY_ERASED',
        }, { status: 409 })
      }

      if (eraseResult.reason === 'MULTIPLE_MATCHES') {
        // This should not happen anymore as we now process all matches
        log.error({ incident: eraseResult.incident, requestId }, 'Unexpected multiple matches error during erasure')
        await cacheDel(idempotencyKey)
        return NextResponse.json({
          error: 'Unexpected error during data processing. Skontaktuj się z pomocą techniczną.',
          code: 'PROCESSING_ERROR',
        }, { status: 500 })
      }

      await cacheDel(idempotencyKey)
      return NextResponse.json({
        error: 'Failed to erase data',
        code: 'UNKNOWN_ERROR',
      }, { status: 500 })
    }

    const maskedPhone = maskPhoneForLog(normalizedPhone)
    log.info({ phone: maskedPhone, requestId }, 'User data erased successfully')
    await cacheDel(idempotencyKey)

    return NextResponse.json({
      status: 'success',
      message: 'Twoje dane zostały pomyślnie usunięte',
      details: {
        erasedData: [
          'Imię i nazwisko z bazy danych',
          'Adres e-mail z bazy danych',
          'Szczegóły kontaktowe z systemu rezerwacji'
        ],
        retainedData: [
          'Zanonimizowane informacje o zgodach (dla celów compliance)',
          'Daty przetwarzania danych (dla celów audytu)'
        ],
        bookingInfo: [
          'Przyszłe wizyty pozostają aktywne',
          'Dane w kalendarzu zostaną automatycznie usunięte po zakończeniu każdej wizyty',
          'Nie otrzymasz powiadomień o nadchodzących wizytach'
        ],
        notice: 'Nowe rezerwacje online nie będą możliwe bez ponownego podania danych i wyrażenia zgody.'
      }
    }, { status: 200 })
  } catch (err) {
    const maskedPhone = maskPhoneForLog(normalizedPhone)
    log.error({ err, requestId, phone: maskedPhone }, 'Data erasure failed')
    await reportError(err, {
      tags: { module: 'api.consents.erase' },
      extras: { requestId, phone: maskedPhone },
    })
    await cacheDel(idempotencyKey)
    return NextResponse.json({ error: 'Internal error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
