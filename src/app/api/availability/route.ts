import { NextRequest, NextResponse } from 'next/server'
import { getAvailableDays } from '../../../lib/availability'
import { readProcedures } from '../../../lib/google/sheets'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const until = searchParams.get('until')
    const procedureId = searchParams.get('procedureId')
    const debug = searchParams.get('debug') === '1'
    if (!from || !until) return NextResponse.json({ error: 'from/until required' }, { status: 400 })

    const procs = await readProcedures()
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

    const data = await getAvailableDays(from, until, minDuration, { debug })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to compute availability', details: String(err?.message || err) }, { status: 500 })
  }
}
