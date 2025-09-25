"use client"
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import PhoneInput from './ui/PhoneInput'

export type Slot = { startISO: string; endISO: string }

type Procedure = { id: string; name_pl: string; price_pln?: number }

type ProceduresResponse = { items: Procedure[] }

export default function BookingForm({
  slot,
  procedureId,
  onSuccess,
}: {
  slot: Slot
  procedureId?: string
  onSuccess?: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [, setEventId] = useState<string | null>(null)
  const [tsToken, setTsToken] = useState<string | null>(null)
  
  // ConsentModal states
  type BookingState = 'form' | 'consent' | 'success'
  const [bookingState, setBookingState] = useState<BookingState>('form')
  const [dataProcessingConsent, setDataProcessingConsent] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)
  const [notificationsConsent, setNotificationsConsent] = useState(false)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined
  const tsRef = useRef<HTMLDivElement | null>(null)

  const { data: proceduresData } = useQuery<ProceduresResponse>({
    queryKey: ['procedures'],
    queryFn: () => fetch('/api/procedures').then(r => r.json() as Promise<ProceduresResponse>),
  })

  const selectedProcedure = useMemo(() => {
    if (!procedureId) return null
    return proceduresData?.items.find(p => p.id === procedureId) ?? null
  }, [procedureId, proceduresData])

  const selectedProcedureName = selectedProcedure?.name_pl ?? null

  useEffect(() => {
    if (!siteKey) return
    // load script once
    const id = 'cf-turnstile'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.id = id
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true; s.defer = true
      document.head.appendChild(s)
    }
    // render widget when available
    const iv = setInterval(() => {
      // @ts-ignore -- Turnstile render helper lacks type definitions
      const t = (window as any).turnstile
      if (t && tsRef.current) {
        try {
          tsRef.current.setAttribute('data-language', 'pl')
          t.render(tsRef.current, {
            sitekey: siteKey,
            language: 'pl',
            callback: (token: string) => setTsToken(token),
          })
          clearInterval(iv)
        } catch {}
      }
    }, 200)
    return () => clearInterval(iv)
  }, [siteKey])

  const canSubmit = useMemo(() => {
    // Validate phone format: should have country code + at least 6 digits
    const phoneDigits = phone.replace(/\D/g, '')
    const hasValidPhone = phoneDigits.length >= 9 // country code (2-3 digits) + phone (6+ digits)
    
    const basic = name.trim().length >= 2 && hasValidPhone && !loading
    return siteKey ? basic && !!tsToken : basic
  }, [name, phone, loading, siteKey, tsToken])
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false }),
    [],
  )
  const startDate = useMemo(() => new Date(slot.startISO), [slot.startISO])
  const endDate = useMemo(() => new Date(slot.endISO), [slot.endISO])
  const label = `${timeFormatter.format(startDate)}–${timeFormatter.format(endDate)}`
  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [],
  )
  const terminLabel = `${fullDateFormatter.format(startDate)}, ${label}`

  // Show consent modal when user clicks "Zarezerwuj"
  async function showConsentModal() {
    if (!canSubmit) return
    setErr(null)
    setLoading(true)
    
    try {
      // Check if user already has valid consents (using phone + name + email for security)
      const consentCheckRes = await fetch('/api/consents/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, email: email || undefined }),
      })
      
      if (consentCheckRes.ok) {
        const consentData = await consentCheckRes.json()
        if (consentData.skipConsentModal) {
          // User already has valid consent, proceed directly to booking
          await finalizeBookingWithoutConsents()
          return
        }
      }
      
      // User needs to give consent, show modal
      setBookingState('consent')
      
      // Hide Turnstile widget if visible
      if (tsRef.current) {
        tsRef.current.style.display = 'none'
      }
    } catch (e: any) {
      setErr('Nie udało się sprawdzić zgód. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  // Booking when consents already exist (no need to save them again)
  async function finalizeBookingWithoutConsents() {
    setLoading(true)
    setErr(null)
    
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startISO: slot.startISO, 
          endISO: slot.endISO, 
          procedureId, 
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
      const msg = String(e?.message || '')
      if (msg.startsWith('BOOKING_TURNSTILE')) setErr('Potwierdź weryfikację Turnstile i spróbuj ponownie.')
      else if (msg.startsWith('BOOKING_DUPLICATE')) setErr('Już wysłałaś/-eś rezerwację na ten przedział. Odczekaj 5 minut lub wybierz inny termin.')
      else if (msg.startsWith('BOOKING_CONFLICT')) setErr('Ten termin jest już zajęty. Wybierz inny przedział.')
      else if (msg.startsWith('BOOKING_RATE_LIMITED')) setErr('Zbyt wiele prób. Spróbuj później.')
      else setErr('Nie udało się zarezerwować. Wybierz inny termin i spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  // Final booking after consent is given
  async function finalizeBooking() {
    if (!dataProcessingConsent || !termsConsent) return
    
    setLoading(true)
    setErr(null)
    
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startISO: slot.startISO, 
          endISO: slot.endISO, 
          procedureId, 
          name, 
          phone, 
          email: email || undefined, 
          turnstileToken: tsToken, // Use token from first step
          consents: {
            dataProcessing: dataProcessingConsent,
            terms: termsConsent,
            notifications: notificationsConsent
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
      const msg = String(e?.message || '')
      if (msg.startsWith('BOOKING_TURNSTILE')) setErr('Potwierdź weryfikację Turnstile i spróbuj ponownie.')
      else if (msg.startsWith('BOOKING_DUPLICATE')) setErr('Już wysłałaś/-eś rezerwację na ten przedział. Odczekaj 5 minut lub wybierz inny termin.')
      else if (msg.startsWith('BOOKING_CONFLICT')) setErr('Ten termin jest już zajęty. Wybierz inny przedział.')
      else if (msg.startsWith('BOOKING_RATE_LIMITED')) setErr('Zbyt wiele prób. Spróbuj później.')
      else setErr('Nie udało się zarezerwować. Wybierz inny termin i spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  // Success state (either new state or old ok flag)
  if (bookingState === 'success' || ok) {
    return (
      <div className="transition-all duration-300 ease-out">
        <div className="text-lg font-medium mb-3 dark:text-dark-text">Rezerwacja potwierdzona</div>
        
        <div className="space-y-1 mb-4">
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            <strong>Usługa:</strong> {selectedProcedureName ?? 'Brak danych'}
          </div>
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            <strong>Termin:</strong> {terminLabel}
          </div>
          {selectedProcedure?.price_pln && (
            <div className="text-sm text-neutral-600 dark:text-dark-muted">
              <strong>Cena:</strong> {selectedProcedure.price_pln} zł
            </div>
          )}
        </div>
        
        <div className="mb-4 p-3 bg-neutral-50 dark:bg-dark-border/30 rounded-lg">
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            <strong className="text-text dark:text-dark-text">Adres:</strong><br />
            Sarmacka 4B/ lokal 106<br />
            02-972 Warszawa<br />
            +48 789 894 948
          </div>
        </div>
        
        <div className="text-emerald-700 dark:text-emerald-400">Dziękujemy, do zobaczenia!</div>
      </div>
    )
  }

  // Consent modal state
  if (bookingState === 'consent') {
    const canConfirm = dataProcessingConsent && termsConsent && !loading
    
    return (
      <div className="transition-all duration-300 ease-out">
        <div className="text-lg font-medium mb-4 dark:text-dark-text">Przed dokonaniem rezerwacji:</div>
        
        {/* Booking summary */}
        <div className="mb-4 p-3 bg-neutral-50 dark:bg-dark-border/30 rounded-lg">
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            <strong className="text-text dark:text-dark-text">{selectedProcedureName}</strong>
            <br />
            {terminLabel}
          </div>
        </div>

        {/* Consent checkboxes */}
        <div className="space-y-4 mb-6">
          {/* Terms consent */}
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsConsent}
              onChange={(e) => setTermsConsent(e.target.checked)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border dark:border-dark-border rounded"
            />
            <span className="text-sm text-text dark:text-dark-text leading-5">
              Przeczytałem/am i akceptuję{' '}
              <Link 
                href="/terms" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 dark:text-accent dark:hover:text-accent/80 underline"
              >
                Warunki korzystania z usług
              </Link>
            </span>
          </label>

          {/* Data processing consent */}
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dataProcessingConsent}
              onChange={(e) => setDataProcessingConsent(e.target.checked)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border dark:border-dark-border rounded"
            />
            <span className="text-sm text-text dark:text-dark-text leading-5">
              Wyrażam zgodę na przetwarzanie moich danych osobowych w celu realizacji rezerwacji zgodnie z{' '}
              <Link 
                href="/privacy" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 dark:text-accent dark:hover:text-accent/80 underline"
              >
                Polityką Prywatności
              </Link>
            </span>
          </label>

          {/* Notifications consent (optional) */}
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationsConsent}
              onChange={(e) => setNotificationsConsent(e.target.checked)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary border-border dark:border-dark-border rounded"
            />
            <span className="text-sm text-text dark:text-dark-text leading-5">
              Wyrażam zgodę na otrzymywanie powiadomień SMS/e-mail o zbliżających się wizytach{' '}
              <span className="text-neutral-500 dark:text-dark-muted">(opcjonalnie)</span>
            </span>
          </label>
        </div>

        {/* Info about withdrawal */}
        <div style={{
          backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(30, 58, 138, 0.3)' : '#eff6ff',
          border: document.documentElement.classList.contains('dark') ? '1px solid rgba(59, 130, 246, 0.7)' : '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <span style={{
            color: document.documentElement.classList.contains('dark') ? '#93c5fd' : '#2563eb',
            fontSize: '14px',
            marginTop: '2px',
            flexShrink: 0
          }}>ⓘ</span>
          <p style={{
            color: document.documentElement.classList.contains('dark') ? '#dbeafe' : '#1e40af',
            fontSize: '14px',
            lineHeight: '1.5',
            margin: 0
          }}>
            Zgoda może być wycofana w każdym momencie poprzez naszą{' '}
            <Link 
              href="/support" 
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: document.documentElement.classList.contains('dark') ? '#bfdbfe' : '#1d4ed8',
                textDecoration: 'underline',
                fontWeight: '500'
              }}
            >
              stronę wsparcia
            </Link>
          </p>
        </div>

        {/* Error message */}
        {err && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{err}</div>}

        {/* Action buttons */}
        <div className="flex space-x-3">
          <button
            onClick={() => {
              // Minimal reset to prevent flickering but keep consent data
              setBookingState('form')
              setErr(null)
              setLoading(false)
              // DON'T reset consent states - keep them for potential re-use
              // Clear form data to prevent conflicts  
              setName('')
              setPhone('')
              setEmail('')
              // Restore Turnstile widget
              if (tsRef.current) {
                tsRef.current.style.display = ''
              }
            }}
            className="btn btn-outline flex-1"
            disabled={loading}
          >
            Powrót
          </button>
          <button
            onClick={finalizeBooking}
            disabled={!canConfirm}
            className={`btn btn-primary flex-1 ${!canConfirm ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {loading ? 'Rezerwowanie…' : 'Potwierdź i zarezerwuj'}
          </button>
        </div>
      </div>
    )
  }

  // Form state (default)
  if (bookingState === 'form' || !bookingState) {
    return (
      <div className={"transition-all duration-300 ease-out transform opacity-100 translate-y-0"}>
        <div className="mb-2 text-sm text-neutral-600 dark:text-dark-muted">Aby zakończyć rezerwację, uzupełnij dane:</div>
      <div className="mb-3 text-[15px] dark:text-dark-text"><span className="font-medium">Wybrany czas:</span> {label}</div>
      <div className="space-y-3">
        <input className="w-full rounded-xl border border-border bg-white/80 px-3 py-2 dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted" placeholder="Imię i nazwisko" value={name} onChange={e => setName(e.target.value)} />
        <PhoneInput 
          value={phone} 
          onChange={setPhone} 
          placeholder="Telefon"
          error={err && err.includes('telefon') ? err : undefined}
        />
        <input className="w-full rounded-xl border border-border bg-white/80 px-3 py-2 dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted" placeholder="E-mail (opcjonalnie)" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      {siteKey && (
        <div className="mt-3">
          <div ref={tsRef} className="rounded-xl" />
        </div>
      )}
        {err && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</div>}
        <button disabled={!canSubmit} onClick={showConsentModal} className={`btn btn-primary mt-4 w-full ${!canSubmit ? 'opacity-60 pointer-events-none' : ''}`}>
          Zarezerwuj
        </button>
      </div>
    )
  }
  
  // Fallback (should not happen)
  return <div>Unknown state: {bookingState}</div>
}
