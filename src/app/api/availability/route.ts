import { NextRequest, NextResponse } from 'next/server'
import { getAvailableDays } from '../../../lib/availability'
import { readProcedures } from '../../../lib/google/sheets'
import { getLogger } from '../../../lib/logger'
import { reportError } from '../../../lib/sentry'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.availability' })

export async function GET(req: NextRequest) {
  let from: string | null = null
  let until: string | null = null
  let procedureId: string | null = null
  let masterId: string | null = null
  let debug = false

  try {
    const { searchParams } = new URL(req.url)
    from = searchParams.get('from')
    until = searchParams.get('until')
    procedureId = searchParams.get('procedureId')
    masterId = searchParams.get('masterId')
    debug = searchParams.get('debug') === '1'

    if (!from || !until) {
      log.warn({ from, until, masterId }, 'Availability request missing required dates')
      return NextResponse.json({ error: 'from/until required' }, { status: 400 })
    }

    const procs = await readProcedures(masterId || undefined)
    let minDuration = 30 // safe default to avoid Infinity
    if (procedureId) {
      const proc = procs.find(p => p.id === procedureId)
      if (proc?.duration_min) minDuration = Math.max(15, proc.duration_min)
    } else {
      const active = procs.filter(p => p.is_active)
      if (active.length > 0) {
        minDuration = Math.max(15, Math.min(...active.map(p => p.duration_min || 30)))
      }
    }

    log.debug({ from, until, procedureId, masterId, debug, minDuration }, 'Computing availability window')

    const data = await getAvailableDays(from, until, minDuration, { debug, masterId: masterId || undefined })
    return NextResponse.json(data)
  } catch (err: any) {
    log.error({ err, from, until, procedureId, masterId, debug }, 'Failed to compute availability')
    await reportError(err, {
      tags: { module: 'api.availability' },
      extras: { from, until, procedureId, masterId, debug },
    })
    return NextResponse.json({ error: 'Failed to compute availability', details: String(err?.message || err) }, { status: 500 })
  }
}