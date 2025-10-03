"use client"
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { clientLog } from '@/lib/client-logger'

// Определение интерфейса для объекта Turnstile
interface Turnstile {
  render: (container: string | HTMLElement, options: TurnstileOptions) => string | undefined
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
  getResponse: (widgetId?: string) => string | undefined
}

// Опции для рендеринга виджета
interface TurnstileOptions {
  sitekey: string
  theme?: 'light' | 'dark' | 'auto'
  language?: string
  callback: (token: string) => void
  'error-callback': () => void
  'expired-callback': () => void
}

// Тип для контекста
interface TurnstileContextType {
  isReady: boolean
  setContainer: (node: HTMLDivElement | null) => void
  token: string | null
  reset: () => void
  isVerified: boolean
}

// Создание контекста с начальным значением undefined
const TurnstileContext = createContext<TurnstileContextType | undefined>(undefined)

// Провайдер Turnstile
export const TurnstileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  const widgetIdRef = useRef<string | null>(null)
  const turnstileRef = useRef<Turnstile | null>(null)

  // Загрузка скрипта Turnstile
  useEffect(() => {
    const scriptId = 'cf-turnstile-script'
    if (document.getElementById(scriptId)) {
      // Если скрипт уже есть, проверяем готовность window.turnstile
      const interval = setInterval(() => {
        if ((window as any).turnstile) {
          turnstileRef.current = (window as any).turnstile
          setIsReady(true)
          clearInterval(interval)
        }
      }, 100)
      return () => clearInterval(interval)
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoaded'
    script.async = true
    script.defer = true

    // Глобальный callback для загрузки
    ;(window as any).onTurnstileLoaded = () => {
      turnstileRef.current = (window as any).turnstile
      setIsReady(true)
    }

    document.head.appendChild(script)

    return () => {
      // Очистка callback при размонтировании
      delete (window as any).onTurnstileLoaded
    }
  }, [])

  const reset = useCallback(() => {
    if (turnstileRef.current && widgetIdRef.current) {
      try {
        turnstileRef.current.reset(widgetIdRef.current)
        setToken(null)
      } catch (error) {
        clientLog.warn('Failed to reset Turnstile widget:', error)
      }
    }
  }, [])

  // Управление виджетом при изменении контейнера
  useEffect(() => {
    if (!isReady || !turnstileRef.current) return

    // Если контейнер есть, но виджета нет - рендерим
    if (container && !widgetIdRef.current) {
      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      if (!siteKey) {
        clientLog.error('Turnstile site key is not configured.')
        return
      }

      const widgetId = turnstileRef.current.render(container, {
        sitekey: siteKey,
        language: 'pl',
        callback: (t: string) => setToken(t),
        'error-callback': () => {
          clientLog.error('Turnstile error: Challenge failed to render.')
          setToken(null)
        },
        'expired-callback': () => {
          clientLog.warn('Turnstile warning: Token expired.')
          reset()
        },
      })

      if (widgetId) {
        widgetIdRef.current = widgetId
      } else {
        clientLog.error('Turnstile error: Failed to obtain widget ID.')
      }
    }

    // Если контейнера нет, а виджет есть - удаляем
    if (!container && widgetIdRef.current) {
      try {
        turnstileRef.current.remove(widgetIdRef.current)
      } catch (error) {
        clientLog.warn('Failed to remove Turnstile widget:', error)
      }
      widgetIdRef.current = null
      setToken(null)
    }
  }, [container, isReady, reset])

  // Очистка при размонтировании провайдера
  useEffect(() => {
    return () => {
      if (turnstileRef.current && widgetIdRef.current) {
        try {
          turnstileRef.current.remove(widgetIdRef.current)
        } catch (error) {
          // Игнорируем ошибки при выгрузке страницы
        }
      }
    }
  }, [])

  const value = {
    isReady,
    setContainer,
    token,
    reset,
    isVerified: !!token,
  }

  return <TurnstileContext.Provider value={value}>{children}</TurnstileContext.Provider>
}

// Хук для использования контекста
export const useTurnstile = (): TurnstileContextType => {
  const context = useContext(TurnstileContext)
  if (context === undefined) {
    throw new Error('useTurnstile must be used within a TurnstileProvider')
  }
  return context
}
