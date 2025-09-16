import { Redis } from '@upstash/redis'

// In-memory fallback with TTL
const mem = new Map<string, { v: any; exp: number }>()

function setMem(key: string, v: any, ttlSec: number) {
  mem.set(key, { v, exp: Date.now() + ttlSec * 1000 })
}
function getMem<T>(key: string): T | null {
  const it = mem.get(key)
  if (!it) return null
  if (Date.now() > it.exp) { mem.delete(key); return null }
  return it.v as T
}

let redis: Redis | null = null
function getRedis() {
  try {
    if (!redis) redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!
    })
    return redis
  } catch {
    return null
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const hit = getMem<T>(key)
  if (hit) return hit
  const r = getRedis()
  if (!r) return null
  try { return await r.get<T>(key) } catch { return null }
}

export async function cacheSet(key: string, value: any, ttlSec: number) {
  setMem(key, value, ttlSec)
  const r = getRedis()
  if (!r) return
  try { await r.set(key, value, { ex: ttlSec }) } catch { /* ignore */ }
}

export async function cacheDel(key: string) {
  const r = getRedis()
  try { await r?.del(key) } catch {}
  mem.delete(key)
}

// Try to set a key once; returns true if set, false if key exists
export async function cacheSetNX(key: string, ttlSec: number): Promise<boolean> {
  const r = getRedis()
  if (!r) return true // no redis -> allow
  try {
    const res = await r.set(key, '1', { nx: true, ex: ttlSec })
    return res === 'OK'
  } catch {
    return true
  }
}

// Simple token bucket: limit N per windowSec per key
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ allowed: boolean; count: number }> {
  const r = getRedis()
  if (!r) return { allowed: true, count: 1 }
  try {
    const cnt = await r.incr(key)
    if (cnt === 1) { await r.expire(key, windowSec) }
    return { allowed: cnt <= limit, count: cnt }
  } catch {
    return { allowed: true, count: 1 }
  }
}
