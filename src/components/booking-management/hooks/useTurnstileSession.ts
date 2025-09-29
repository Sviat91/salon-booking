import { useCallback, useEffect, useRef, useState } from 'react'
import { storeTurnstileSession } from '../../../lib/turnstile-client'

export interface UseTurnstileSessionReturn {
  turnstileToken: string | null
  setTurnstileToken: (token: string | null) => void
  turnstileNode: { ref: React.RefObject<HTMLDivElement>; className: string } | undefined
  turnstileRequired: boolean
  turnstileRef: React.RefObject<HTMLDivElement> | null
  resetWidget: () => void
  removeWidget: () => void
  ensureWidget: () => void
}

export function useTurnstileSession(siteKey?: string): UseTurnstileSessionReturn {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const renderAttemptRef = useRef<number>(0)

  const tryRender = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const turnstile = (window as any)?.turnstile
    if (!turnstile || !turnstileRef.current || !siteKey || widgetIdRef.current) return false
    try {
      turnstileRef.current.setAttribute('data-language', 'pl')
      const id = turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        language: 'pl',
        callback: (token: string) => {
          setTurnstileToken(token)
          storeTurnstileSession(token)
        },
        'error-callback': () => {
          setTurnstileToken(null)
        },
        'expired-callback': () => {
          setTurnstileToken(null)
          try {
            turnstile.reset(id)
          } catch {
            // ignore
          }
        },
      }) as string | undefined
      if (id) widgetIdRef.current = id
      return !!id
    } catch {
      return false
    }
  }, [siteKey])

  // Reset current widget token/challenge, re-render if widgetId missing but container present
  const resetWidget = useCallback(() => {
    setTurnstileToken(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const turnstile = (window as any)?.turnstile
    if (turnstile && widgetIdRef.current) {
      try {
        turnstile.reset(widgetIdRef.current)
        return
      } catch {
        // fallthrough to tryRender
      }
    }
    tryRender()
  }, [tryRender])

  // Ensure widget exists (render if missing and TS ready)
  const ensureWidget = useCallback(() => {
    if (widgetIdRef.current) return
    if (tryRender()) return
    // If still not rendered, schedule short retries
    const start = ++renderAttemptRef.current
    let attempts = 0
    const i = setInterval(() => {
      if (renderAttemptRef.current !== start) {
        clearInterval(i)
        return
      }
      attempts += 1
      if (tryRender() || attempts >= 25) {
        clearInterval(i)
      }
    }, 120)
  }, [tryRender])

  // Remove widget completely
  const removeWidget = useCallback(() => {
    setTurnstileToken(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const turnstile = (window as any)?.turnstile
    if (turnstile && widgetIdRef.current) {
      try {
        turnstile.remove(widgetIdRef.current)
      } catch {
        // ignore
      }
    }
    widgetIdRef.current = null
  }, [])

  // Load script and render widget when available
  useEffect(() => {
    if (!siteKey) return

    const scriptId = 'cf-turnstile'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const interval = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const turnstile = (window as any)?.turnstile
      if (turnstile && turnstileRef.current && !widgetIdRef.current) {
        if (tryRender()) {
          clearInterval(interval)
        }
      }
    }, 200)

    return () => {
      clearInterval(interval)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const turnstile = (window as any)?.turnstile
      if (turnstile && widgetIdRef.current) {
        try {
          turnstile.remove(widgetIdRef.current)
        } catch {
          // ignore
        }
      }
      widgetIdRef.current = null
      setTurnstileToken(null)
    }
  }, [siteKey])

  const turnstileNode = siteKey 
    ? { ref: turnstileRef, className: "rounded-xl" }
    : undefined

  const turnstileRequired = !!siteKey && !turnstileToken

  return {
    turnstileToken,
    setTurnstileToken,
    turnstileNode,
    turnstileRequired,
    turnstileRef,
    resetWidget,
    removeWidget,
    ensureWidget,
  }
}
