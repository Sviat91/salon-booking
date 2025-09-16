import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { freeBusy, createEvent } from '../../../lib/google/calendar'
import { readProcedures } from '../../../lib/google/sheets'
import { cacheSetNX, cacheDel, rateLimit } from '../../../lib/cache'
import { verifyTurnstile } from '../../../lib/turnstile'

export const runtime = 'nodejs'

const BodySchema = z.object({
  startISO: z.string().min(16),
  endISO: z.string().min(16),
  procedureId: z.string().optional(),
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  turnstileToken: z.string().optional(),
})

export async function POST(req: NextRequest) {
  let idemKey: string | null = null
  try {
    const body = BodySchema.parse(await req.json())

    // Basic rate limits per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'
    const minute = await rateLimit(`rl:book:ip:${ip}:1m`, 10, 60)
    const hour = await rateLimit(`rl:book:ip:${ip}:1h`, 50, 3600)
    if (!minute.allowed || !hour.allowed) {
      return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })
    }

    // Check availability one more time to avoid race condition
    const busy = await freeBusy(body.startISO, body.endISO)
    if (busy.length > 0) {
      return NextResponse.json({ error: 'Slot is no longer available', code: 'CONFLICT' }, { status: 409 })
    }

    // Idempotency key per interval and phone
    idemKey = `idem:book:${body.startISO}:${body.endISO}:${body.phone}`
    const acquired = await cacheSetNX(idemKey, 300)
    if (!acquired) {
      return NextResponse.json({ error: 'Duplicate booking in progress', code: 'DUPLICATE' }, { status: 409 })
    }

    let summary = `Booking: ${body.name}`
    if (body.procedureId) {
      try {
        const procs = await readProcedures()
        const proc = procs.find(p => p.id === body.procedureId)
        if (proc) summary = `${proc.name_pl} • ${body.name}`
      } catch {}
    }

    const description = `Phone: ${body.phone}${body.email ? `\nEmail: ${body.email}` : ''}`

    const ev = await createEvent({ startISO: body.startISO, endISO: body.endISO, summary, description })
    const res = NextResponse.json({ ok: true, eventId: ev.id })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (err: any) {
    if (idemKey) await cacheDel(idemKey)
    const msg = err?.issues ? JSON.stringify(err.issues) : String(err?.message || err)
    const status = err?.issues ? 400 : 500
    return NextResponse.json({ error: 'Failed to book', details: msg }, { status })
  }
}
    // Optional Turnstile verification (only if secret configured)
    const ts = await verifyTurnstile(body.turnstileToken, ip)
    if (!ts.ok) {
      return NextResponse.json({ error: 'Turnstile verification failed', code: ts.code || 'TURNSTILE' }, { status: 400 })
    }
