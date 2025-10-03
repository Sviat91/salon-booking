"use client"
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatTimeRange } from '@/lib/utils/date-formatters'

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
    staleTime: 5 * 60 * 1000, // 5 minutes - slots can change frequently
  })

  const slots = useMemo(() => (data?.slots ?? []) as { startISO: string; endISO: string }[], [data])

  const ready = !!procedureId && !!dateISO
  const panelState = ready
    ? 'mt-3 max-h-[24rem] opacity-100 overflow-hidden overflow-y-auto'
    : 'max-h-0 opacity-0 overflow-hidden pointer-events-none'

  return (
    <div>
      {!procedureId && <div className="text-sm text-neutral-500 dark:text-dark-muted">Najpierw wybierz usługę</div>}
      {procedureId && !dateISO && <div className="text-sm text-neutral-500 dark:text-dark-muted">Wybierz datę</div>}
      <div className={`relative overflow-x-hidden transition-[max-height,opacity] duration-300 ease-out ${panelState}`}>
        <div className={`relative rounded-2xl border border-neutral-200 bg-white/80 p-4 dark:bg-dark-card/80 dark:border-dark-border ${ready ? 'max-h-[24rem]' : ''}`}>
          {ready && (
            <>
              {isFetching && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-dark-card/80">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500" />
                  <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-dark-text">Wyszukujemy wolne godziny…</p>
                </div>
              )}
              {error && <div className="text-sm text-red-600 dark:text-red-400">Błąd ładowania terminów</div>}
              {!error && slots.length === 0 && !isFetching && (
                <div className="text-sm text-neutral-500 dark:text-dark-muted">Brak dostępnych terminów</div>
              )}
              {!error && slots.length > 0 && (
                <div className="grid max-h-[18rem] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {slots.map((s) => {
                    const label = formatTimeRange(new Date(s.startISO), new Date(s.endISO))
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
