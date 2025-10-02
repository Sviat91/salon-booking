import { config } from './env'
import { clientLog } from './client-logger'

// Session storage keys
const TURNSTILE_TOKEN_KEY = 'turnstile_token'
const TURNSTILE_TIMESTAMP_KEY = 'turnstile_timestamp'

// Session duration: 30 minutes
const SESSION_DURATION_MS = 30 * 60 * 1000

// Types
interface TurnstileSession {
  token: string
  timestamp: number
}

interface TurnstileValidation {
  isValid: boolean
  token?: string
  reason?: 'no_session' | 'expired' | 'no_token' | 'valid'
}

/**
 * Get current Turnstile token from the widget
 * Requires Turnstile to be loaded and rendered on the page
 */
export function getTurnstileToken(): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    // @ts-ignore - Turnstile is loaded dynamically
    const turnstile = window.turnstile
    if (!turnstile) return null
    
    // Get token from the first widget (assuming one widget per page)
    const widgets = document.querySelectorAll('[data-cf-turnstile-widget-id]')
    if (widgets.length === 0) return null
    
    const widgetId = widgets[0].getAttribute('data-cf-turnstile-widget-id')
    if (!widgetId) return null
    
    return turnstile.getResponse(widgetId) || null
  } catch (error) {
    clientLog.warn('Failed to get Turnstile token:', error)
    return null
  }
}

/**
 * Validate if current Turnstile session is still valid (within 30 minutes)
 * Returns token if valid, or reason why invalid
 */
export function validateTurnstileSession(): TurnstileValidation {
  if (typeof window === 'undefined') {
    return { isValid: false, reason: 'no_session' }
  }
  
  try {
    const token = sessionStorage.getItem(TURNSTILE_TOKEN_KEY)
    const timestampStr = sessionStorage.getItem(TURNSTILE_TIMESTAMP_KEY)
    
    if (!token || !timestampStr) {
      return { isValid: false, reason: 'no_session' }
    }
    
    const timestamp = parseInt(timestampStr, 10)
    const now = Date.now()
    
    if (now - timestamp > SESSION_DURATION_MS) {
      // Session expired, clear it
      clearTurnstileSession()
      return { isValid: false, reason: 'expired' }
    }
    
    if (!token) {
      return { isValid: false, reason: 'no_token' }
    }
    
    return { isValid: true, token, reason: 'valid' }
  } catch (error) {
    clientLog.warn('Failed to validate Turnstile session:', error)
    clearTurnstileSession()
    return { isValid: false, reason: 'no_session' }
  }
}

/**
 * Clear Turnstile session from storage
 */
export function clearTurnstileSession(): void {
  if (typeof window === 'undefined') return
  
  try {
    sessionStorage.removeItem(TURNSTILE_TOKEN_KEY)
    sessionStorage.removeItem(TURNSTILE_TIMESTAMP_KEY)
  } catch (error) {
    clientLog.warn('Failed to clear Turnstile session:', error)
  }
}

/**
 * Store Turnstile token in session with current timestamp
 */
export function storeTurnstileSession(token: string): void {
  if (typeof window === 'undefined') return
  
  try {
    sessionStorage.setItem(TURNSTILE_TOKEN_KEY, token)
    sessionStorage.setItem(TURNSTILE_TIMESTAMP_KEY, Date.now().toString())
  } catch (error) {
    clientLog.warn('Failed to store Turnstile session:', error)
  }
}

/**
 * Get Turnstile token with session validation
 * Returns cached token if session is valid, otherwise gets new token
 */
export function getTurnstileTokenWithSession(): string | null {
  // First, check if we have a valid session
  const sessionValidation = validateTurnstileSession()
  if (sessionValidation.isValid && sessionValidation.token) {
    return sessionValidation.token
  }
  
  // Session invalid, try to get new token
  const newToken = getTurnstileToken()
  if (newToken) {
    storeTurnstileSession(newToken)
    return newToken
  }
  
  return null
}

/**
 * Helper function for API endpoint protection
 * Validates Turnstile token with session awareness
 * Use this in API routes that need Turnstile protection
 * 
 * Example usage in API route:
 * ```typescript
 * import { validateTurnstileForAPI } from '@/lib/turnstile'
 * 
 * export async function POST(req: NextRequest) {
 *   const body = await req.json()
 *   const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
 *   
 *   // Validate Turnstile
 *   const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip)
 *   if (!turnstileResult.success) {
 *     return NextResponse.json(
 *       turnstileResult.errorResponse,
 *       { status: turnstileResult.status }
 *     )
 *   }
 *   
 *   // Continue with API logic...
 * }
 * ```
 */
export interface TurnstileProtectionResult {
  success: boolean
  errorResponse?: {
    error: string
    code: string
    details?: Record<string, any>
  }
  status?: number
}

export async function validateTurnstileForAPI(
  token: string | undefined | null, 
  remoteIp?: string | null,
  options: {
    requireToken?: boolean // If false, allows requests without Turnstile when disabled
  } = {}
): Promise<TurnstileProtectionResult> {
  const { requireToken = true } = options
  
  // If Turnstile is disabled in config, allow request
  if (!config.TURNSTILE_SECRET_EFFECTIVE) {
    if (requireToken) {
      return {
        success: false,
        errorResponse: {
          error: 'Turnstile is required but not configured',
          code: 'TURNSTILE_NOT_CONFIGURED'
        },
        status: 500
      }
    }
    return { success: true }
  }
  
  // Check if token is provided
  if (!token) {
    return {
      success: false,
      errorResponse: {
        error: 'Turnstile verification required',
        code: 'TURNSTILE_TOKEN_REQUIRED',
        details: { tokenPresent: false }
      },
      status: 400
    }
  }
  
  // Verify token with Cloudflare
  const verification = await verifyTurnstile(token, remoteIp)
  
  if (!verification.ok) {
    return {
      success: false,
      errorResponse: {
        error: 'Turnstile verification failed',
        code: verification.code || 'TURNSTILE_FAILED',
        details: { 
          tokenPresent: true,
          reason: verification.code 
        }
      },
      status: 400
    }
  }
  
  return { success: true }
}

// Server-side verification function (existing)
export async function verifyTurnstile(token: string | undefined | null, remoteIp?: string | null) {
  if (!config.TURNSTILE_SECRET_EFFECTIVE) return { ok: true } // disabled
  if (!token) return { ok: false, code: 'NO_TOKEN' as const }
  try {
    const form = new URLSearchParams()
    form.set('secret', config.TURNSTILE_SECRET_EFFECTIVE)
    form.set('response', token)
    if (remoteIp) form.set('remoteip', remoteIp)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const data = await res.json() as { success?: boolean; "error-codes"?: string[] }
    return { ok: !!data.success, code: data.success ? undefined : (data["error-codes"]?.[0] || 'VERIFY_FAILED') }
  } catch {
    // In doubt, fail closed only when Turnstile is enabled but network failed
    return { ok: false, code: 'VERIFY_ERROR' as const }
  }
}
