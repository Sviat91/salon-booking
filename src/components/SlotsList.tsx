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

  if (!dateISO) return <div className="text-sm text-muted-foreground">Выберите дату</div>
  if (!procedureId) return <div className="text-sm text-muted-foreground">Сначала выберите услугу</div>
  if (isFetching) return <div className="text-sm text-muted-foreground">Загрузка слотов…</div>
  if (error) return <div className="text-sm text-red-600">Ошибка загрузки слотов</div>
  if (!slots.length) return <div className="text-sm text-muted-foreground">Нет доступных слотов</div>

  return (
    <div className="grid grid-cols-3 gap-2">
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
  )
}
