/**
 * Lightweight client-side logging wrapper
 * 
 * This is a minimal logging utility for client components that doesn't
 * require Node.js APIs (pino, Buffer, etc.) which would bloat the bundle.
 * 
 * Usage:
 * ```ts
 * import { clientLog } from '@/lib/client-logger'
 * 
 * clientLog.info('User action', { userId: 123 })
 * clientLog.warn('Validation warning', { field: 'email' })
 * clientLog.error('API error', error)
 * clientLog.debug('Debug info', data)
 * ```
 */

export const clientLog = {
  /**
   * Log informational messages (only in development)
   */
  info: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') console.log(...args)
  },

  /**
   * Log warnings (always logged)
   */
  warn: (...args: any[]) => console.warn(...args),

  /**
   * Log errors (always logged)
   */
  error: (...args: any[]) => console.error(...args),

  /**
   * Log debug messages (only in development)
   */
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.debug(...args)
  }
}
