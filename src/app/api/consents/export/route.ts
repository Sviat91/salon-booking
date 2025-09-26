import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLogger } from '../../../../lib/logger'
import { rateLimit } from '../../../../lib/cache'
import { validateTurnstileForAPI } from '../../../../lib/turnstile'
import { exportUserData } from '../../../../lib/google/sheets'
import { reportError } from '../../../../lib/sentry'
import { config } from '../../../../lib/env'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.consents.export' })

const BodySchema = z.object({
  name: z.string().min(2).max(240),
  phone: z.string().min(5).max(40),
  email: z.string().email().max(180).optional(),
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
    log.warn({ err }, 'Invalid consent export payload')
    return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  const { name, phone, email, turnstileToken, requestId } = body
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

  const turnstile = await validateTurnstileForAPI(turnstileToken, ip, { requireToken: !!config.TURNSTILE_SECRET_EFFECTIVE })
  if (!turnstile.success) {
    return NextResponse.json(turnstile.errorResponse, { status: turnstile.status ?? 400 })
  }

  const rateKey = `rate:consent-export:${ip ?? '0.0.0.0'}`
  const rate = await rateLimit(rateKey, 5, 15 * 60)
  if (!rate.allowed) {
    log.warn({ ip, rate }, 'Consent export rate limited')
    return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })
  }

  try {
    const exportResult = await exportUserData({
      phone: normalizedPhone,
      name: trimmedName,
      email,
      requestId,
    })

    if (!exportResult.exportedData) {
      if (exportResult.reason === 'NOT_FOUND') {
        return NextResponse.json({
          error: 'Nie znaleźliśmy danych dla podanych informacji.',
          code: 'DATA_NOT_FOUND',
          hints: [
            'Sprawdź numer telefonu wraz z kodem kraju (np. +48...)',
            'Upewnij się, że imię i nazwisko wpisujesz dokładnie tak jak przy rezerwacji.',
          ],
        }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to export data', code: 'UNKNOWN_ERROR' }, { status: 500 })
    }

    const maskedPhone = maskPhoneForLog(normalizedPhone)
    log.info({ phone: maskedPhone, requestId }, 'User data exported successfully')

    return NextResponse.json(exportResult.exportedData, { status: 200 })

  } catch (err) {
    const maskedPhone = maskPhoneForLog(normalizedPhone)
    log.error({ err, requestId, phone: maskedPhone }, 'Data export failed')
    await reportError(err, {
      tags: { module: 'api.consents.export' },
      extras: { requestId, phone: maskedPhone },
    })
    return NextResponse.json({ error: 'Internal error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
