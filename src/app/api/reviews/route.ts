import { NextResponse } from 'next/server'
import { listReviewImages } from '@/lib/google/drive'
import { Redis } from '@upstash/redis'
import { config } from '@/lib/env'
import { logger } from '@/lib/logger'

// Initialize Redis
const redis = new Redis({
  url: config.UPSTASH_REDIS_REST_URL,
  token: config.UPSTASH_REDIS_REST_TOKEN,
})

const CACHE_KEY = 'reviews:list'
const CACHE_TTL = 60 * 60 // 1 hour in seconds

export const dynamic = 'force-dynamic' // Ensure it's not statically generated at build time, logic handles caching

export async function GET() {
  try {
    // 1. Try to get from cache
    const cachedData = await redis.get(CACHE_KEY)
    
    if (cachedData) {
      return NextResponse.json({ 
        images: cachedData,
        source: 'cache' 
      })
    }

    // 2. If miss, fetch from Google Drive
    const images = await listReviewImages()

    // 3. Save to cache (only if we got results to avoid caching empty arrays on temp errors, 
    // but maybe we want to cache empty to avoid hammering API? Let's cache if successful)
    if (images.length > 0) {
      await redis.set(CACHE_KEY, images, { ex: CACHE_TTL })
    }

    return NextResponse.json({ 
      images,
      source: 'drive'
    })

  } catch (error) {
    logger.error({ err: error }, 'API Error /api/reviews:')
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}
