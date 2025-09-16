"use client"
import { useMemo, useState } from 'react'

export type Slot = { startISO: string; endISO: string }

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

  const canSubmit = useMemo(() => name.trim().length >= 2 && phone.trim().length >= 5 && !loading, [name, phone, loading])
  const label = `${slot.startISO.slice(11, 16)} - ${slot.endISO.slice(11, 16)}`

  async function submit() {
    if (!canSubmit) return
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startISO: slot.startISO, endISO: slot.endISO, procedureId, name, phone, email: email || undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      setOk(true)
      onSuccess?.()
    } catch (e: any) {
      setErr('Не удалось забронировать. Попробуйте другое время.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={"transition-all duration-300 ease-out transform opacity-100 translate-y-0"}>
      <div className="text-sm text-muted-foreground mb-2">Для завершения бронирования заполните данные:</div>
      <div className="mb-3 text-[15px]"><span className="font-medium">Выбранное время:</span> {label}</div>
      <div className="grid grid-cols-2 gap-3">
        <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Имя и Фамилия" value={name} onChange={e => setName(e.target.value)} />
        <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} />
      </div>
      <div className="mt-3">
        <input className="w-full rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Email (по желанию)" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
      {ok && <div className="mt-3 text-sm text-emerald-600">Забронировано! Мы скоро свяжемся с вами.</div>}
      <button disabled={!canSubmit} onClick={submit} className={`btn btn-primary mt-4 w-full ${!canSubmit ? 'opacity-60 pointer-events-none' : ''}`}>
        {loading ? 'Отправка…' : 'Забронировать'}
      </button>
    </div>
  )
}

