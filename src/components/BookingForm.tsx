"use client"
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

export type Slot = { startISO: string; endISO: string }

type Procedure = { id: string; name_pl: string }

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
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined
  const tsRef = useRef<HTMLDivElement | null>(null)

  const { data: proceduresData } = useQuery<ProceduresResponse>({
    queryKey: ['procedures'],
    queryFn: () => fetch('/api/procedures').then(r => r.json() as Promise<ProceduresResponse>),
  })

  const selectedProcedureName = useMemo(() => {
    if (!procedureId) return null
    return proceduresData?.items.find(p => p.id === procedureId)?.name_pl ?? null
  }, [procedureId, proceduresData])

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
    const basic = name.trim().length >= 2 && phone.trim().length >= 5 && !loading
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

  async function submit() {
    if (!canSubmit) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startISO: slot.startISO, endISO: slot.endISO, procedureId, name, phone, email: email || undefined, turnstileToken: tsToken || undefined }),
      })
      const body = await res.json()
      if (!res.ok) {
        const code = (body && body.code) || 'UNKNOWN'
        const details = (body && body.details) || ''
        throw new Error(`BOOKING_${code}${details ? `: ${details}` : ''}`)
      }
      setEventId(body.eventId || null)
      setOk(true)
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

  if (ok) {
    return (
      <div className="transition-all duration-300 ease-out">
        <div className="text-lg font-medium mb-2">Rezerwacja potwierdzona</div>
        <div className="text-sm text-neutral-600">Usługa: {selectedProcedureName ?? 'Brak danych'}</div>
        <div className="text-sm text-neutral-600">Termin: {terminLabel}</div>
        <div className="mt-3 text-emerald-700">Dziękujemy, do zobaczenia!</div>
      </div>
    )
  }

  return (
    <div className={"transition-all duration-300 ease-out transform opacity-100 translate-y-0"}>
      <div className="mb-2 text-sm text-neutral-600">Aby zakończyć rezerwację, uzupełnij dane:</div>
      <div className="mb-3 text-[15px]"><span className="font-medium">Wybrany czas:</span> {label}</div>
      <div className="grid grid-cols-2 gap-3">
        <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Imię i nazwisko" value={name} onChange={e => setName(e.target.value)} />
        <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Telefon" value={phone} onChange={e => setPhone(e.target.value)} />
      </div>
      <div className="mt-3">
        <input className="w-full rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="E-mail (opcjonalnie)" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      {siteKey && (
        <div className="mt-3">
          <div ref={tsRef} className="rounded-xl" />
        </div>
      )}
        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
        <button disabled={!canSubmit} onClick={submit} className={`btn btn-primary mt-4 w-full ${!canSubmit ? 'opacity-60 pointer-events-none' : ''}`}>
          {loading ? 'Wysyłanie…' : 'Zarezerwuj'}
        </button>
    </div>
  )
}
