import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLogger } from '../../../../lib/logger'
import { rateLimit } from '../../../../lib/cache'
import { reportError } from '../../../../lib/sentry'
import { config } from '../../../../lib/env'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.master.contact' })

const BodySchema = z.object({
  fullName: z.string().trim().min(2, 'Imię i nazwisko musi mieć co najmniej 2 znaki').max(240),
  phone: z.string().trim().min(9, 'Numer telefonu musi mieć co najmniej 9 cyfr').max(20),
  email: z.string().trim().email('Nieprawidłowy adres e-mail').max(180).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Wiadomość musi mieć co najmniej 10 znaków').max(5000),
  masterId: z.string().optional(),
  requestId: z.string().trim().max(64).optional(),
})

function maskPhoneForLog(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`
}

function maskEmailForLog(email: string): string {
  if (!email) return 'not-provided'
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
  fullName: string
  phone: string
  email?: string
  message: string
  master: string
  metadata: {
    ip: string
    userAgent: string
    timestamp: string
    requestId: string
  }
}) {
  if (!config.N8N_WEBHOOK_MASTER_CALL || !config.N8N_SECRET_TOKEN) {
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
    'User-Agent': 'FaceMassage-MasterContact/1.0',
  }
  headers[secretHeader] = secretToken
  
  const response = await fetch(config.N8N_WEBHOOK_MASTER_CALL, {
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
    log.warn({ err, ip }, 'Invalid master contact form payload')
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
  
  const { fullName, phone, email, message, masterId, requestId } = body
  const finalRequestId = requestId || `master-contact-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const masterName = masterId === 'juli' ? 'Juli' : 'Olga'
  
  // Rate limiting: 3 requests per 15 minutes per IP
  const rateKey = `rate:master-contact:${ip}`
  const rate = await rateLimit(rateKey, 3, 15 * 60)
  
  if (!rate.allowed) {
    log.warn({ ip, phone: maskPhoneForLog(phone) }, 'Master contact form rate limited')
    return NextResponse.json({
      error: 'Zbyt wiele wiadomości. Spróbuj ponownie za 15 minut.',
      code: 'RATE_LIMITED',
    }, { status: 429 })
  }
  
  // Check if N8N is configured
  if (!config.N8N_WEBHOOK_MASTER_CALL || !config.N8N_SECRET_TOKEN) {
    log.error({ 
      requestId,
      hasWebhookUrl: !!config.N8N_WEBHOOK_MASTER_CALL,
      hasSecretToken: !!config.N8N_SECRET_TOKEN,
      webhookUrl: config.N8N_WEBHOOK_MASTER_CALL ? 'configured' : 'missing',
    }, 'N8N webhook for master contact not configured')
    return NextResponse.json({
      error: 'Usługa tymczasowo niedostępna. Spróbuj później lub skontaktuj się bezpośrednio.',
      code: 'SERVICE_UNAVAILABLE',
    }, { status: 503 })
  }
  
  log.debug({ 
    requestId,
    phone: maskPhoneForLog(phone),
    hasEmail: !!email,
  }, 'Processing master contact request')
  
  try {
    const forwardData = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email?.trim().toLowerCase() || '',
      message: message.trim(),
      master: masterName,
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
          phone: maskPhoneForLog(phone),
          email: maskEmailForLog(email || ''),
          master: masterName,
          attempt: attempt + 1,
        }, 'Master contact form submitted successfully')
        
        return NextResponse.json({
          status: 'success',
          message: 'Wiadomość została wysłana pomyślnie. Mistrz skontaktuje się z Tobą wkrótce.',
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
      phone: maskPhoneForLog(phone),
      email: maskEmailForLog(email || ''),
      authError: isAuthError,
      status: authStatus,
    }, isAuthError ? 'Master contact authentication with n8n failed' : 'Failed to forward master contact to N8N after retries')
    
    await reportError(lastError!, {
      tags: { module: 'api.master.contact' },
      extras: {
        requestId: finalRequestId,
        phone: maskPhoneForLog(phone),
        email: maskEmailForLog(email || ''),
        maxRetries,
        authError: isAuthError,
        status: authStatus,
      },
    })
    
    if (isAuthError) {
      return NextResponse.json({
        error: 'Nie udało się uwierzytelnić integracji formularza kontaktu. Administrator został powiadomiony - spróbuj ponownie później lub skontaktuj się bezpośrednio.',
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
      phone: maskPhoneForLog(phone),
    }, 'Unexpected error in master contact form')
    
    await reportError(err as Error, {
      tags: { module: 'api.master.contact' },
      extras: {
        requestId: finalRequestId,
        phone: maskPhoneForLog(phone),
      },
    })
    
    return NextResponse.json({
      error: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.',
      code: 'INTERNAL_ERROR',
    }, { status: 500 })
  }
}
