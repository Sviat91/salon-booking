import { useState, useCallback } from 'react'

export type Slot = { startISO: string; endISO: string }

type BookingState = 'form' | 'consent' | 'success'

interface UseBookingSubmitProps {
  slot: Slot
  procedureId?: string
  masterId?: string
  name: string
  phone: string
  email: string
  tsToken: string | null
  onSuccess?: () => void
}

interface ConsentData {
  dataProcessing: boolean
  terms: boolean
  notifications: boolean
}

export function useBookingSubmit({
  slot,
  procedureId,
  masterId,
  name,
  phone,
  email,
  tsToken,
  onSuccess,
}: UseBookingSubmitProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingState, setBookingState] = useState<BookingState>('form')
  const [eventId, setEventId] = useState<string | null>(null)
  const [isCheckingConsent, setIsCheckingConsent] = useState(false)

  // Check if user already has valid consents and proceed accordingly
  const checkConsentAndProceed = useCallback(async () => {
    setIsCheckingConsent(true)
    setLoading(true)
    setError(null)
    
    try {
      // Check if user already has valid consents
      const consentCheckRes = await fetch('/api/consents/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, email: email || undefined }),
      })
      
      if (consentCheckRes.ok) {
        const consentData = await consentCheckRes.json()
        if (consentData.skipConsentModal) {
          // User already has valid consent, proceed directly to booking
          await bookWithoutConsents()
          return
        }
      }
      
      // User needs to give consent, show modal
      setBookingState('consent')
    } catch (e: any) {
      setError('Nie udało się sprawdzić zgód. Spróbuj ponownie.')
    } finally {
      setLoading(false)
      setIsCheckingConsent(false)
    }
  }, [phone, name, email])

  // Book without saving new consents (user already has valid ones)
  const bookWithoutConsents = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startISO: slot.startISO, 
          endISO: slot.endISO, 
          procedureId,
          masterId, 
          name, 
          phone, 
          email: email || undefined, 
          turnstileToken: tsToken,
          // No consents object - user already has valid consents
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const code = (body && body.code) || 'UNKNOWN'
        const details = (body && body.details) || ''
        throw new Error(`BOOKING_${code}${details ? `: ${details}` : ''}`)
      }
      setEventId(body.eventId || null)
      setBookingState('success')
      onSuccess?.()
    } catch (e: any) {
      handleBookingError(e)
    } finally {
      setLoading(false)
    }
  }, [slot, procedureId, name, phone, email, tsToken, onSuccess])

  // Book with new consents
  const bookWithConsents = useCallback(async (consents: ConsentData) => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startISO: slot.startISO, 
          endISO: slot.endISO, 
          procedureId,
          masterId, 
          name, 
          phone, 
          email: email || undefined, 
          turnstileToken: tsToken,
          consents: {
            dataProcessing: consents.dataProcessing,
            terms: consents.terms,
            notifications: consents.notifications
          }
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        const code = (body && body.code) || 'UNKNOWN'
        const details = (body && body.details) || ''
        throw new Error(`BOOKING_${code}${details ? `: ${details}` : ''}`)
      }
      setEventId(body.eventId || null)
      setBookingState('success')
      onSuccess?.()
    } catch (e: any) {
      handleBookingError(e)
    } finally {
      setLoading(false)
    }
  }, [slot, procedureId, name, phone, email, tsToken, onSuccess])

  // Handle booking errors
  const handleBookingError = useCallback((e: any) => {
    const msg = String(e?.message || '')
    if (msg.startsWith('BOOKING_TURNSTILE')) {
      setError('Potwierdź weryfikację Turnstile i spróbuj ponownie.')
    } else if (msg.startsWith('BOOKING_DUPLICATE')) {
      setError('Już wysłałaś/-eś rezerwację na ten przedział. Odczekaj 5 minut lub wybierz inny termin.')
    } else if (msg.startsWith('BOOKING_CONFLICT')) {
      setError('Ten termin jest już zajęty. Wybierz inny przedział.')
    } else if (msg.startsWith('BOOKING_RATE_LIMITED')) {
      setError('Zbyt wiele prób. Spróbuj później.')
    } else {
      setError('Nie udało się zarezerwować. Wybierz inny termin i spróbuj ponownie.')
    }
  }, [])

  // Reset to form state
  const resetToForm = useCallback(() => {
    setBookingState('form')
    setError(null)
    setEventId(null)
  }, [])

  return {
    loading,
    error,
    bookingState,
    eventId,
    isCheckingConsent,
    checkConsentAndProceed,
    bookWithConsents,
    resetToForm,
    setError,
  }
}
