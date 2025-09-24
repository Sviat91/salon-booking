import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLogger } from '../../../../lib/logger'
import { rateLimit, cacheSetNX, cacheDel } from '../../../../lib/cache'
import { validateTurnstileForAPI } from '../../../../lib/turnstile'
import { withdrawUserConsent } from '../../../../lib/google/sheets'
import { reportError } from '../../../../lib/sentry'
import { config } from '../../../../lib/env'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.consents.withdraw' })

const BodySchema = z.object({
  name: z.string().min(2).max(240),
  phone: z.string().min(5).max(40),
  email: z.string().email().max(180).optional(),
  consentAcknowledged: z.boolean().refine(v => v, 'consent must be acknowledged'),
  turnstileToken: z.string().min(10),
  requestId: z.string().max(64).optional(),
})

function normalizePhoneToE164(input: string): string {
  const raw = input.trim()
  if (!raw) return raw
  let cleaned = raw.replace(/\s+/g, '').replace(/^-+/, '')
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`
  if (!cleaned.startsWith('+')) {
    cleaned = cleaned.startsWith('0') ? `+48${cleaned.slice(1)}` : `+48${cleaned}`
  }
  const digits = cleaned.replace(/[^+\d]/g, '')
  if (!/^\+[1-9]\d{6,14}$/.test(digits)) {
    throw new Error('INVALID_PHONE')
  }
  return digits
}

function normalizeNameForKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function buildIdempotencyKey(phone: string, name: string) {
  return `consent:withdraw:${phone}:${name}`
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
    log.warn({ err }, 'Invalid consent withdraw payload')
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

  const rateKey = `rate:consent-withdraw:${ip ?? '0.0.0.0'}`
  const rate = await rateLimit(rateKey, 5, 15 * 60)
  if (!rate.allowed) {
    log.warn({ ip, rate }, 'Consent withdraw rate limited')
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
    const withdrawResult = await withdrawUserConsent({
      phone: normalizedPhone,
      name: trimmedName,
      email,
      withdrawalMethod: 'support_form',
      requestId,
    })

    if (!withdrawResult.updated) {
      if (withdrawResult.reason === 'NOT_FOUND') {
        await cacheDel(idempotencyKey)
        return NextResponse.json({
          error: 'Nie znaleźliśmy zgód dla podanych danych.',
          code: 'CONSENT_NOT_FOUND',
          hints: [
            'Sprawdź numer telefonu wraz z kodem kraju (np. +48...)',
            'Upewnij się, że imię i nazwisko wpisujesz dokładnie tak jak przy rezerwacji.',
            'Jeśli nadal masz problem, napisz do nas przez formularz wsparcia – odezwiemy się i dokończymy wycofanie.',
          ],
        }, { status: 404 })
      }

      if (withdrawResult.reason === 'MULTIPLE_MATCHES') {
        log.error({ incident: withdrawResult.incident, requestId }, 'Multiple consent matches during withdrawal')
        await cacheDel(idempotencyKey)
        return NextResponse.json({
          error: 'Multiple consents matched. Skontaktuj się z pomocą techniczną.',
          code: 'CONSENT_AMBIGUOUS',
        }, { status: 409 })
      }

      await cacheDel(idempotencyKey)
      return NextResponse.json({
        error: 'Failed to withdraw consent',
        code: 'UNKNOWN_ERROR',
      }, { status: 500 })
    }

    const maskedPhone = maskPhoneForLog(normalizedPhone)
    log.info({ phone: maskedPhone, requestId }, 'Consent withdrawn successfully')

    return NextResponse.json({
      status: 'accepted',
      message: 'Withdrawal request accepted. We will respond within 72 hours.',
    }, { status: 200 })
  } catch (err) {
    const maskedPhone = maskPhoneForLog(normalizedPhone)
    log.error({ err, requestId, phone: maskedPhone }, 'Consent withdrawal failed')
    await reportError(err, {
      tags: { module: 'api.consents.withdraw' },
      extras: { requestId, phone: maskedPhone },
    })
    await cacheDel(idempotencyKey)
    return NextResponse.json({ error: 'Internal error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
