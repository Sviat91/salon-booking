import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasValidConsent } from '../../../../lib/google/sheets'
import { rateLimit } from '../../../../lib/cache'
import { getLogger } from '../../../../lib/logger'
import { reportError } from '../../../../lib/sentry'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.consents.check' })

const BodySchema = z.object({
  phone: z.string().min(5),
  name: z.string().min(2), // Требуем имя для лучшей безопасности
})

export async function POST(req: NextRequest) {
  let ip = '0.0.0.0'

  try {
    const body = BodySchema.parse(await req.json())
    ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ip

    log.debug({ ip, phone: body.phone, name: body.name }, 'Checking user consents')

    // Rate limiting: 20 requests per minute per IP
    const rateLimited = await rateLimit(`rl:consents:check:${ip}:1m`, 20, 60)
    if (!rateLimited.allowed) {
      log.warn({ ip }, 'Consent check rate limit exceeded')
      return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })
    }

    const hasValidConsents = await hasValidConsent(body.phone, body.name)
    
    log.info({ ip, phone: body.phone, name: body.name, hasValidConsents }, 'Consent check completed')
    
    return NextResponse.json({ 
      hasValidConsent: hasValidConsents,
      skipConsentModal: hasValidConsents 
    })
    
  } catch (err: any) {
    const isValidationError = err instanceof z.ZodError
    if (isValidationError) {
      const issuePaths = err.issues?.map(issue => (issue.path.length ? issue.path.join('.') : '(root)')) ?? []
      log.warn({ ip, issuePaths }, 'Consent check validation failed')
    } else {
      log.error({ err, ip }, 'Consent check handler failed')
      await reportError(err, {
        tags: { module: 'api.consents.check' },
        extras: { ip },
      })
    }

    const details = isValidationError ? JSON.stringify(err.issues) : String(err?.message || err)
    const status = isValidationError ? 400 : 500
    return NextResponse.json({ error: 'Failed to check consents', details }, { status })
  }
}
