import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { freeBusy, createEvent } from '../../../lib/google/calendar'
import { readProcedures } from '../../../lib/google/sheets'

export const runtime = 'nodejs'

const BodySchema = z.object({
  startISO: z.string().min(16),
  endISO: z.string().min(16),
  procedureId: z.string().optional(),
  name: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())

    // Check availability one more time to avoid race condition
    const busy = await freeBusy(body.startISO, body.endISO)
    if (busy.length > 0) {
      return NextResponse.json({ error: 'Slot is no longer available' }, { status: 409 })
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
    const msg = err?.issues ? JSON.stringify(err.issues) : String(err?.message || err)
    const status = err?.issues ? 400 : 500
    return NextResponse.json({ error: 'Failed to book', details: msg }, { status })
  }
}

