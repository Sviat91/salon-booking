import { listReviewImages, ReviewImage } from '@/lib/google/drive'
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

export async function getCachedReviews(): Promise<ReviewImage[]> {
  try {
    // 1. Try to get from cache
    const cachedData = await redis.get<ReviewImage[]>(CACHE_KEY)
    
    if (cachedData) {
      return cachedData
    }

    // 2. If miss, fetch from Google Drive
    const images = await listReviewImages()

    // 3. Save to cache
    if (images.length > 0) {
      await redis.set(CACHE_KEY, images, { ex: CACHE_TTL })
    }

    return images

  } catch (error) {
    logger.error('Error fetching reviews:', error)
    return []
  }
}
