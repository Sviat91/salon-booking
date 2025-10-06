import { NextRequest, NextResponse } from 'next/server'
import { getDaySlots } from '../../../../lib/availability'
import { readProcedures } from '../../../../lib/google/sheets'
import { cacheGet, cacheSet } from '../../../../lib/cache'
import { getLogger } from '../../../../lib/logger'
import { reportError } from '../../../../lib/sentry'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.day' })

function isValidISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

async function computeMinDuration(procedureId?: string | null, masterId?: string | null) {
  // Try shared cache from /api/procedures to avoid hitting Sheets on hot paths
  const procCacheKey = `procedures:v1:${masterId || 'default'}`
  const cached = await cacheGet<any[]>(procCacheKey)
  const procs = cached ?? await readProcedures(masterId || undefined)
  if (!cached) await cacheSet(procCacheKey, procs, 900)

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
  const date = ctx.params?.date ?? null
  let procedureId: string | null = null
  let masterId: string | null = null

  try {
    if (!date || !isValidISODate(date)) {
      log.warn({ date }, 'Invalid date supplied to day slots route')
      return NextResponse.json({ error: 'Invalid date. Expected YYYY-MM-DD' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    procedureId = searchParams.get('procedureId')
    masterId = searchParams.get('masterId')

    const minDuration = await computeMinDuration(procedureId, masterId)
    const cacheKey = `day:v1:${date}:${minDuration}:${masterId || 'default'}`
    let payload = await cacheGet<{ slots: { startISO: string; endISO: string }[] }>(cacheKey)
    if (!payload) {
      log.debug({ date, procedureId, masterId, minDuration }, 'Cache miss for day slots')
      payload = await getDaySlots(date, minDuration, 15, masterId || undefined)
      await cacheSet(cacheKey, payload, 30)
    }

    const res = NextResponse.json(payload)
    res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=10')
    return res
  } catch (err: any) {
    log.error({ err, date, procedureId, masterId }, 'Failed to compute day slots')
    await reportError(err, {
      tags: { module: 'api.day' },
      extras: { date, procedureId, masterId },
    })
    return NextResponse.json({ error: 'Failed to compute day slots', details: String(err?.message || err) }, { status: 500 })
  }
}