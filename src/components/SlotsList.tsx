"use client"
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

function toISO(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function SlotsList({ date, procedureId, selected, onPick }: { date?: Date; procedureId?: string; selected?: { startISO: string; endISO: string } | null; onPick?: (slot: { startISO: string; endISO: string }) => void }) {
  const dateISO = date ? toISO(date) : null

  const { data, isFetching, isLoading, error } = useQuery({
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

  if (!procedureId) return <div className="text-sm text-neutral-500">Сначала выберите услугу</div>

  const panelOpen = !!dateISO
  const hasSlots = slots.length > 0
  const showLoader = (isLoading || isFetching) && panelOpen

  return (
    <>
      {!panelOpen ? <div className="text-sm text-neutral-500">Выберите дату</div> : null}
      <div className={`transition-[max-height,opacity] duration-300 ease-out ${panelOpen ? 'max-h-[420px] opacity-100' : 'pointer-events-none max-h-0 opacity-0'}`}>
        <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white/70 p-3 shadow-sm">
          {showLoader && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-sm">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent" />
              <span className="text-sm font-medium text-neutral-700">Подбираем свободное время…</span>
            </div>
          )}
          {panelOpen && error && !showLoader ? (
            <div className="text-sm text-red-600">Ошибка загрузки слотов</div>
          ) : null}
          {panelOpen && !error && !hasSlots && !showLoader ? (
            <div className="text-sm text-neutral-500">Нет доступных слотов</div>
          ) : null}
          {panelOpen && hasSlots ? (
            <div className="max-h-80 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                {slots.map((s) => {
                  const label = `${s.startISO.slice(11, 16)} - ${s.endISO.slice(11, 16)}`
                  const isSelected = selected?.startISO === s.startISO && selected?.endISO === s.endISO
                  const cls = isSelected ? 'btn btn-primary' : 'btn btn-outline'
                  return (
                    <button key={s.startISO} className={cls} aria-pressed={isSelected} onClick={() => onPick?.(s)}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
