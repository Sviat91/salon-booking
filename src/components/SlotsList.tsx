"use client"
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

function toISO(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function SlotsList({ date, procedureId, selected, onPick }: { date?: Date; procedureId?: string; selected?: { startISO: string; endISO: string } | null; onPick?: (slot: { startISO: string; endISO: string }) => void }) {
  const dateISO = date ? toISO(date) : null

  const { data, isFetching, error } = useQuery({
    queryKey: ['day-slots', dateISO, procedureId],
    enabled: !!dateISO && !!procedureId,
    queryFn: async () => {
      if (!dateISO) return { slots: [] }
      const qs = new URLSearchParams()
      if (procedureId) qs.set('procedureId', procedureId)
      const res = await fetch(`/api/day/${dateISO}?${qs.toString()}`)
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      return res.json()
    },
    staleTime: 30_000,
  })

  const slots = useMemo(() => (data?.slots ?? []) as { startISO: string; endISO: string }[], [data])
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false }),
    [],
  )

  const ready = !!procedureId && !!dateISO
  const panelState = ready
    ? 'mt-3 max-h-[24rem] opacity-100 overflow-hidden overflow-y-auto'
    : 'max-h-0 opacity-0 overflow-hidden pointer-events-none'

  return (
    <div>
      {!procedureId && <div className="text-sm text-neutral-500">Najpierw wybierz usługę</div>}
      {procedureId && !dateISO && <div className="text-sm text-neutral-500">Wybierz datę</div>}
      <div className={`relative overflow-x-hidden transition-[max-height,opacity] duration-300 ease-out ${panelState}`}>
        <div className={`relative rounded-2xl border border-neutral-200 bg-white/80 p-4 ${ready ? 'max-h-[24rem]' : ''}`}>
          {ready && (
            <>
              {isFetching && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500" />
                  <p className="mt-3 text-sm font-medium text-neutral-600">Wyszukujemy wolne godziny…</p>
                </div>
              )}
              {error && <div className="text-sm text-red-600">Błąd ładowania terminów</div>}
              {!error && slots.length === 0 && !isFetching && (
                <div className="text-sm text-neutral-500">Brak dostępnych terminów</div>
              )}
              {!error && slots.length > 0 && (
                <div className="grid max-h-[18rem] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {slots.map((s) => {
                    const label = `${timeFormatter.format(new Date(s.startISO))}–${timeFormatter.format(new Date(s.endISO))}`
                    const isSelected = selected?.startISO === s.startISO && selected?.endISO === s.endISO
                    const cls = isSelected ? 'btn btn-primary' : 'btn btn-outline'
                    return (
                      <button key={s.startISO} className={cls} aria-pressed={isSelected} onClick={() => onPick?.(s)}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
