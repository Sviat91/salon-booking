"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
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

export default function DayCalendar({ procedureId, onChange }: { procedureId?: string; onChange?: (d: Date | undefined) => void }) {
  const [selected, setSelected] = useState<Date | undefined>(undefined)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const initialFrom = new Date(today)
  const [rangeFrom, setRangeFrom] = useState<Date>(initialFrom)
  const [rangeUntil, setRangeUntil] = useState<Date>(() => { const d=new Date(today); d.setDate(d.getDate()+90); d.setHours(0,0,0,0); return d })
  const [daysMap, setDaysMap] = useState<Map<string, boolean>>(new Map())
  const monthRef = useRef<Date>(new Date())

  const fromISO = toISO(rangeFrom)
  const untilISO = toISO(rangeUntil)

  const { data } = useQuery({
    queryKey: ['availability', procedureId, fromISO, untilISO],
    enabled: !!procedureId, // подсветку дней делаем только после выбора процедуры
    queryFn: async () => {
      const qs = new URLSearchParams({ from: fromISO, until: untilISO })
      if (procedureId) qs.set('procedureId', procedureId)
      const res = await fetch(`/api/availability?${qs.toString()}`)
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })

  // Merge fetched days into an accumulator map; clear on procedure change
  useEffect(() => {
    setDaysMap(new Map())
  }, [procedureId])

  useEffect(() => {
    if (!data?.days) return
    setDaysMap(prev => {
      const m = new Map(prev)
      for (const d of data.days as any[]) m.set(d.date, !!d.hasWindow)
      // Evict outside of current range to keep memory bounded (~4 months)
      for (const k of Array.from(m.keys())) {
        if (k < fromISO || k > untilISO) m.delete(k)
      }
      return m
    })
  }, [data, fromISO, untilISO])

  function extendWindowIfNeeded(nextMonth: Date) {
    monthRef.current = nextMonth
    // near end -> extend +30 days
    const endOfMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth()+1, 0)
    endOfMonth.setHours(0,0,0,0)
    const thresholdEnd = new Date(rangeUntil); thresholdEnd.setDate(thresholdEnd.getDate()-7)
    if (endOfMonth > thresholdEnd) {
      const newUntil = new Date(rangeUntil); newUntil.setDate(newUntil.getDate()+30)
      setRangeUntil(newUntil)
      // Keep max window ~120 days
      const maxDays = 120
      const diffDays = Math.floor((newUntil.getTime() - rangeFrom.getTime())/(24*3600*1000))
      if (diffDays > maxDays) {
        const newFrom = new Date(rangeFrom); newFrom.setDate(newFrom.getDate()+30)
        setRangeFrom(newFrom)
      }
    }
    // near start -> extend backward -30 days
    const startOfMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
    startOfMonth.setHours(0,0,0,0)
    const thresholdStart = new Date(rangeFrom); thresholdStart.setDate(thresholdStart.getDate()+7)
    if (startOfMonth < thresholdStart) {
      const newFrom = new Date(rangeFrom); newFrom.setDate(newFrom.getDate()-30)
      setRangeFrom(newFrom)
      // Keep max window ~120 days
      const maxDays = 120
      const diffDays = Math.floor((rangeUntil.getTime() - newFrom.getTime())/(24*3600*1000))
      if (diffDays > maxDays) {
        const newUntil = new Date(rangeUntil); newUntil.setDate(newUntil.getDate()-30)
        setRangeUntil(newUntil)
      }
    }
  }

  const set = useMemo(() => new Set<string>(Array.from(daysMap.entries()).filter(([,v]) => v).map(([k]) => k)), [daysMap])
  const available = useMemo(() => Array.from(set.values()).map(s => new Date(s + 'T00:00:00')), [set])

  const isDisabled = (day: Date) => {
    const iso = toISO(day)
    if (day < today) return true
    if (!procedureId) return true // до выбора услуги все дни отключены
    return !set.has(iso)
  }

  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={(d) => { setSelected(d); onChange?.(d) }}
      fromDate={today}
      toDate={rangeUntil}
      disabled={isDisabled}
      modifiers={{ available }}
      modifiersClassNames={{ available: 'bg-accent/40 rounded-full', disabled: 'opacity-30 pointer-events-none' }}
      styles={{ caption: { color: '#2B2B2B' } }}
      onMonthChange={extendWindowIfNeeded}
    />
  )
}
