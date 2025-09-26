import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLogger } from '../../../../lib/logger'
import { rateLimit } from '../../../../lib/cache'
import { reportError } from '../../../../lib/sentry'
import { config } from '../../../../lib/env'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.support.contact' })

const BodySchema = z.object({
  name: z.string().trim().min(2, 'Imi� i nazwisko musi mie� co najmniej 2 znaki').max(240),
  email: z.string().trim().email('Nieprawid�owy adres e-mail').max(180),
  subject: z.string().trim().min(1, 'Wybierz temat wiadomo�ci').max(200),
  message: z.string().trim().min(10, 'Wiadomo�� musi mie� co najmniej 10 znak�w').max(5000),
  requestId: z.string().trim().max(64).optional(),
})

function maskEmailForLog(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return 'invalid-email'
  const maskedLocal = local.length > 2 ? `${local[0]}***${local.slice(-1)}` : '***'
  return `${maskedLocal}@${domain}`
}

class N8NAuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'N8NAuthError'
    this.status = status
  }
}

async function forwardToN8N(data: {
  name: string
  email: string
  subject: string
  message: string
  metadata: {
    ip: string
    userAgent: string
    timestamp: string
    requestId: string
  }
}) {
  if (!config.N8N_WEBHOOK_URL || !config.N8N_SECRET_TOKEN) {
    throw new Error('N8N configuration missing')
  }
  const secretHeader = (config.N8N_SECRET_HEADER || 'x-secret-token').trim()
  const secretToken = config.N8N_SECRET_TOKEN.trim()
  if (!secretHeader) {
    throw new Error('N8N secret header name missing')
  }
  if (!secretToken) {
    throw new N8NAuthError('N8N secret token is empty', 401)
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'FaceMassage-Support/1.0',
  }
  headers[secretHeader] = secretToken
  const response = await fetch(config.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    if (response.status === 401 || response.status === 403) {
      throw new N8NAuthError(`N8N webhook rejected credentials: ${response.status} ${errorText}`, response.status)
    }
    throw new Error(`N8N webhook failed: ${response.status} ${errorText}`)
  }
  return await response.json().catch(() => ({ success: true }))
}
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || '0.0.0.0'
  const userAgent = req.headers.get('user-agent') || 'Unknown'
  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch (err) {
    log.warn({ err, ip }, 'Invalid contact form payload')
    if (err instanceof z.ZodError) {
      const firstError = err.errors[0]
      return NextResponse.json({
        error: firstError.message,
        code: 'VALIDATION_ERROR',
        field: firstError.path.join('.'),
      }, { status: 400 })
    }
    return NextResponse.json({
      error: 'Invalid payload',
      code: 'INVALID_PAYLOAD',
    }, { status: 400 })
  }
  const { name, email, subject, message, requestId } = body
  const finalRequestId = requestId || `contact-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  // Rate limiting: 3 requests per 15 minutes per IP
  const rateKey = `rate:support-contact:${ip}`
  const rate = await rateLimit(rateKey, 3, 15 * 60)
  if (!rate.allowed) {
    log.warn({ ip, email: maskEmailForLog(email) }, 'Contact form rate limited')
    return NextResponse.json({
      error: 'Zbyt wiele wiadomości. Spróbuj ponownie za 15 minut.',
      code: 'RATE_LIMITED',
    }, { status: 429 })
  }
  // Check if N8N is configured
  if (!config.N8N_WEBHOOK_URL || !config.N8N_SECRET_TOKEN) {
    log.error({ requestId }, 'N8N webhook not configured')
    return NextResponse.json({
      error: 'Usługa tymczasowo niedostępna. Spróbuj później lub skontaktuj się bezpośrednio.',
      code: 'SERVICE_UNAVAILABLE',
    }, { status: 503 })
  }
  try {
    const forwardData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      metadata: {
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
        requestId: finalRequestId,
      },
    }
    // Attempt to forward to N8N with retry logic
    let lastError: Error | null = null
    const maxRetries = 2
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await forwardToN8N(forwardData)
        // Success - log without PII
        log.info({
          requestId: finalRequestId,
          subject: subject.trim(),
          email: maskEmailForLog(email),
          attempt: attempt + 1,
        }, 'Contact form submitted successfully')
        return NextResponse.json({
          status: 'success',
          message: 'Wiadomość została wysłana pomyślnie. Odpowiemy w ciągu 72 godzin.',
          requestId: finalRequestId,
        }, { status: 200 })
      } catch (err) {
        lastError = err as Error
        if (lastError instanceof N8NAuthError) {
          break
        }
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s...
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        // All retries failed
        break
      }
    }
    // Log failure and report to Sentry
    const isAuthError = lastError instanceof N8NAuthError
    const authStatus = isAuthError ? (lastError as N8NAuthError).status : undefined
    log.error({
      err: lastError,
      requestId: finalRequestId,
      email: maskEmailForLog(email),
      subject: subject.trim(),
      authError: isAuthError,
      status: authStatus,
    }, isAuthError ? 'Contact form authentication with n8n failed' : 'Failed to forward contact form to N8N after retries')
    await reportError(lastError!, {
      tags: { module: 'api.support.contact' },
      extras: {
        requestId: finalRequestId,
        email: maskEmailForLog(email),
        subject: subject.trim(),
        maxRetries,
        authError: isAuthError,
        status: authStatus,
      },
    })
    if (isAuthError) {
      return NextResponse.json({
        error: 'Nie udało się uwierzytelnić integracji formularza wsparcia. Administrator został powiadomiony - spróbuj ponownie później lub skontaktuj się bezpośrednio.',
        code: 'UPSTREAM_AUTH_FAILED',
        requestId: finalRequestId,
      }, { status: 502 })
    }
    return NextResponse.json({
      error: 'Wystąpił problem z wysłaniem wiadomości. Spróbuj ponownie za chwilę lub skontaktuj się bezpośrednio.',
      code: 'DELIVERY_FAILED',
      requestId: finalRequestId,
    }, { status: 503 })
  } catch (err) {
    log.error({
      err,
      requestId: finalRequestId,
      email: maskEmailForLog(email),
    }, 'Unexpected error in contact form')
    await reportError(err as Error, {
      tags: { module: 'api.support.contact' },
      extras: {
        requestId: finalRequestId,
        email: maskEmailForLog(email),
      },
    })
    return NextResponse.json({
      error: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.',
      code: 'INTERNAL_ERROR',
    }, { status: 500 })
  }
}
