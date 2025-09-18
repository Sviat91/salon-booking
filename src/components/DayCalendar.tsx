"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import type { CaptionProps } from 'react-day-picker'
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
  const [month, setMonth] = useState<Date>(() => {
    const m = new Date(today)
    m.setDate(1)
    return m
  })
  const [monthAnimationClass, setMonthAnimationClass] = useState('opacity-100 translate-x-0')

  const fromISO = toISO(rangeFrom)
  const untilISO = toISO(rangeUntil)

  const { data, isFetching, isLoading } = useQuery({
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
      const newFromUnclamped = new Date(rangeFrom); newFromUnclamped.setDate(newFromUnclamped.getDate()-30)
      const clamped = newFromUnclamped < today ? new Date(today) : newFromUnclamped
      setRangeFrom(clamped)
      // Keep max window ~120 days
      const maxDays = 120
      const diffDays = Math.floor((rangeUntil.getTime() - clamped.getTime())/(24*3600*1000))
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

  function goToMonth(next: Date) {
    const normalized = new Date(next.getFullYear(), next.getMonth(), 1)
    if (normalized.getTime() === month.getTime()) return
    setMonthAnimationClass(normalized > month ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4')
    setMonth(normalized)
    extendWindowIfNeeded(normalized)
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMonthAnimationClass('opacity-100 translate-x-0'))
    return () => cancelAnimationFrame(frame)
  }, [month])

  const monthFormatter = useMemo(() => new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }), [])
  const showLoader = !!procedureId && (isLoading || isFetching)

  return (
    <div className="relative">
      <DayPicker
        mode="single"
        month={month}
        selected={selected}
        onSelect={(d) => { setSelected(d); onChange?.(d) }}
        fromDate={today}
        toDate={rangeUntil}
        disabled={isDisabled}
        modifiers={{ available }}
        modifiersClassNames={{ available: 'bg-accent/40 rounded-full', disabled: 'opacity-30 pointer-events-none' }}
        styles={{ caption: { color: '#2B2B2B' } }}
        onMonthChange={extendWindowIfNeeded}
        classNames={{
          months: `relative transition duration-300 ease-out ${monthAnimationClass}`,
          month: 'w-full',
          caption: 'px-1 py-2',
          caption_label: 'text-sm font-medium text-neutral-800 capitalize',
          nav: 'hidden',
        }}
        components={{
          Caption: ({ displayMonth }: CaptionProps) => (
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-1 py-2">
              <button
                type="button"
                onClick={() => goToMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition hover:bg-neutral-100"
                aria-label="Предыдущий месяц"
              >
                ‹
              </button>
              <div className="text-center text-sm font-medium text-neutral-800 capitalize">
                {monthFormatter.format(displayMonth)}
              </div>
              <button
                type="button"
                onClick={() => goToMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition hover:bg-neutral-100"
                aria-label="Следующий месяц"
              >
                ›
              </button>
            </div>
          ),
        }}
      />
      {showLoader && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/80 backdrop-blur-sm">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent" />
          <span className="text-sm font-medium text-neutral-700">Подбираем доступные дни…</span>
        </div>
      )}
    </div>
  )
}
