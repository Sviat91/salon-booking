// Client-side helpers for working with Cloudflare Turnstile widget.
// These utilities intentionally avoid importing server-side env configuration
// so that they can be safely bundled into the browser.

// Session storage keys
const TURNSTILE_TOKEN_KEY = 'turnstile_token'
const TURNSTILE_TIMESTAMP_KEY = 'turnstile_timestamp'

// Session duration: 30 minutes
const SESSION_DURATION_MS = 30 * 60 * 1000

export function getTurnstileToken(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const turnstile = (window as any).turnstile
    if (!turnstile) return null

    const widgets = document.querySelectorAll('[data-cf-turnstile-widget-id]')
    if (widgets.length === 0) return null

    const widgetId = widgets[0].getAttribute('data-cf-turnstile-widget-id')
    if (!widgetId) return null

    return turnstile.getResponse(widgetId) || null
  } catch (error) {
    console.warn('Failed to get Turnstile token:', error)
    return null
  }
}

interface TurnstileValidation {
  isValid: boolean
  token?: string
  reason?: 'no_session' | 'expired' | 'no_token' | 'valid'
}

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

    if (Number.isNaN(timestamp) || now - timestamp > SESSION_DURATION_MS) {
      clearTurnstileSession()
      return { isValid: false, reason: 'expired' }
    }

    return { isValid: true, token, reason: 'valid' }
  } catch (error) {
    console.warn('Failed to validate Turnstile session:', error)
    clearTurnstileSession()
    return { isValid: false, reason: 'no_session' }
  }
}

export function clearTurnstileSession(): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem(TURNSTILE_TOKEN_KEY)
    sessionStorage.removeItem(TURNSTILE_TIMESTAMP_KEY)
  } catch (error) {
    console.warn('Failed to clear Turnstile session:', error)
  }
}

export function storeTurnstileSession(token: string): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.setItem(TURNSTILE_TOKEN_KEY, token)
    sessionStorage.setItem(TURNSTILE_TIMESTAMP_KEY, Date.now().toString())
  } catch (error) {
    console.warn('Failed to store Turnstile session:', error)
  }
}

export function getTurnstileTokenWithSession(): string | null {
  const sessionValidation = validateTurnstileSession()
  if (sessionValidation.isValid && sessionValidation.token) {
    return sessionValidation.token
  }

  const newToken = getTurnstileToken()
  if (newToken) {
    storeTurnstileSession(newToken)
    return newToken
  }

  return null
}
