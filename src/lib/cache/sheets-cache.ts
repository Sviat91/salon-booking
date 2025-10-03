/**
 * In-memory cache for Google Sheets data
 * 
 * Reduces redundant API calls to Google Sheets by caching frequently
 * accessed data like procedures and schedules with TTL-based expiration.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class SheetsCache {
  private cache: Map<string, CacheEntry<any>> = new Map()

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data with TTL in milliseconds
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    })
  }

  /**
   * Invalidate (delete) cached data for a key
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// Singleton instance
const sheetsCache = new SheetsCache()

// Cache TTLs in milliseconds
export const CACHE_TTL = {
  PROCEDURES: 10 * 60 * 1000, // 10 minutes - procedures rarely change
  SCHEDULE: 5 * 60 * 1000, // 5 minutes - schedule can change more frequently
  CONSENTS: 2 * 60 * 1000, // 2 minutes - consent checks should be relatively fresh
} as const

// Cache key generators
export const CACHE_KEYS = {
  PROCEDURES: () => 'sheets:procedures',
  SCHEDULE: (date?: string) => date ? `sheets:schedule:${date}` : 'sheets:schedule',
  CONSENT: (phone: string) => `sheets:consent:${phone}`,
} as const

/**
 * Get cached data with automatic TTL handling
 */
export function getCached<T>(key: string): T | null {
  return sheetsCache.get<T>(key)
}

/**
 * Set cached data with automatic TTL
 */
export function setCached<T>(key: string, data: T, ttlMs: number): void {
  sheetsCache.set(key, data, ttlMs)
}

/**
 * Invalidate cached data
 */
export function invalidateCache(key: string): void {
  sheetsCache.invalidate(key)
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  sheetsCache.clear()
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getCacheStats() {
  return sheetsCache.stats()
}

export default sheetsCache
