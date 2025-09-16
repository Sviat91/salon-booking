import { NextRequest, NextResponse } from 'next/server'
import { getDaySlots } from '../../../../lib/availability'
import { readProcedures } from '../../../../lib/google/sheets'
import { cacheGet, cacheSet } from '../../../../lib/cache'

export const runtime = 'nodejs'

function isValidISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

async function computeMinDuration(procedureId?: string | null) {
  // Try shared cache from /api/procedures to avoid hitting Sheets on hot paths
  const cached = await cacheGet<any[]>('procedures:v1')
  const procs = cached ?? await readProcedures()
  if (!cached) await cacheSet('procedures:v1', procs, 900)

  let minDuration = 30
  if (procedureId) {
    const proc = procs.find(p => p.id === procedureId)
    if (proc?.duration_min) minDuration = Math.max(15, proc.duration_min)
  } else {
    const active = procs.filter(p => p.is_active)
    if (active.length > 0) minDuration = Math.max(15, Math.min(...active.map(p => p.duration_min || 30)))
  }
  return minDuration
}

export async function GET(req: NextRequest, ctx: { params: { date: string } }) {
  try {
    const date = ctx.params?.date
    if (!date || !isValidISODate(date)) {
      return NextResponse.json({ error: 'Invalid date. Expected YYYY-MM-DD' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const procedureId = searchParams.get('procedureId')

    const minDuration = await computeMinDuration(procedureId)
    const cacheKey = `day:v1:${date}:${minDuration}`
    let payload = await cacheGet<{ slots: { startISO: string; endISO: string }[] }>(cacheKey)
    if (!payload) {
      payload = await getDaySlots(date, minDuration)
      await cacheSet(cacheKey, payload, 30)
    }

    const res = NextResponse.json(payload)
    res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=10')
    return res
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to compute day slots', details: String(err?.message || err) }, { status: 500 })
  }
}

