"use client"
import { useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { useQuery } from '@tanstack/react-query'

// Produce YYYY-MM-DD in LOCAL time, not UTC.
function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DayCalendar({ procedureId }: { procedureId?: string }) {
  const [selected, setSelected] = useState<Date | undefined>(undefined)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const until = new Date(); until.setDate(until.getDate() + 90); until.setHours(0, 0, 0, 0)

  const { data } = useQuery({
    queryKey: ['availability', procedureId],
    queryFn: async () => {
      const qs = new URLSearchParams({ from: toISO(today), until: toISO(until) })
      if (procedureId) qs.set('procedureId', procedureId)
      const res = await fetch(`/api/availability?${qs.toString()}`)
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })

  const set = useMemo(() => new Set<string>((data?.days || []).filter((d: any) => d.hasWindow).map((d: any) => d.date)), [data])
  const available = useMemo(() => Array.from(set.values()).map(s => new Date(s + 'T00:00:00')), [set])

  const isDisabled = (day: Date) => {
    const iso = toISO(day)
    if (day < today) return true
    return !set.has(iso)
  }

  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={setSelected}
      fromDate={today}
      toDate={until}
      disabled={isDisabled}
      modifiers={{ available }}
      modifiersClassNames={{ available: 'bg-accent/40 rounded-full', disabled: 'opacity-30 pointer-events-none' }}
      styles={{ caption: { color: '#2B2B2B' } }}
    />
  )
}
