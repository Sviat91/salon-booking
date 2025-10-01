"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { pl } from 'date-fns/locale'
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
  const today = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return now
  }, [])
  const initialMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const [month, setMonth] = useState<Date>(initialMonth)
  const [navDirection, setNavDirection] = useState<'forward' | 'backward'>('forward')
  const [rangeFrom, setRangeFrom] = useState<Date>(new Date(today))
  const [rangeUntil, setRangeUntil] = useState<Date>(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 90)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [daysMap, setDaysMap] = useState<Map<string, boolean>>(new Map())
  const monthRef = useRef<Date>(initialMonth)

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
    const endOfMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)
    endOfMonth.setHours(0, 0, 0, 0)
    const thresholdEnd = new Date(rangeUntil)
    thresholdEnd.setDate(thresholdEnd.getDate() - 7)
    if (endOfMonth > thresholdEnd) {
      const newUntil = new Date(rangeUntil)
      newUntil.setDate(newUntil.getDate() + 30)
      setRangeUntil(newUntil)
      // Keep max window ~120 days
      const maxDays = 120
      const diffDays = Math.floor((newUntil.getTime() - rangeFrom.getTime()) / (24 * 3600 * 1000))
      if (diffDays > maxDays) {
        const newFrom = new Date(rangeFrom)
        newFrom.setDate(newFrom.getDate() + 30)
        setRangeFrom(newFrom)
      }
    }
    // near start -> extend backward -30 days
    const startOfMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)
    startOfMonth.setHours(0, 0, 0, 0)
    const thresholdStart = new Date(rangeFrom)
    thresholdStart.setDate(thresholdStart.getDate() + 7)
    if (startOfMonth < thresholdStart) {
      const newFromUnclamped = new Date(rangeFrom)
      newFromUnclamped.setDate(newFromUnclamped.getDate() - 30)
      const clamped = newFromUnclamped < today ? new Date(today) : newFromUnclamped
      setRangeFrom(clamped)
      // Keep max window ~120 days
      const maxDays = 120
      const diffDays = Math.floor((rangeUntil.getTime() - clamped.getTime()) / (24 * 3600 * 1000))
      if (diffDays > maxDays) {
        const newUntil = new Date(rangeUntil)
        newUntil.setDate(newUntil.getDate() - 30)
        setRangeUntil(newUntil)
      }
    }
  }

  const set = useMemo(() => new Set<string>(Array.from(daysMap.entries()).filter(([, v]) => v).map(([k]) => k)), [daysMap])
  const available = useMemo(() => Array.from(set.values()).map(s => new Date(s + 'T00:00:00')), [set])

  const isDisabled = (day: Date) => {
    const iso = toISO(day)
    if (day < today) return true
    if (!procedureId) return true // до выбора услуги все дни отключены
    return !set.has(iso)
  }

  function handleMonthChange(next: Date) {
    const normalized = new Date(next.getFullYear(), next.getMonth(), 1)
    if (normalized.getTime() === month.getTime()) return
    setNavDirection(normalized.getTime() >= month.getTime() ? 'forward' : 'backward')
    setMonth(normalized)
    extendWindowIfNeeded(normalized)
  }


  const isLoadingDays = !!procedureId && (isFetching || isLoading)

  function handleContainerClick() {
    if (selected !== undefined) setSelected(undefined)
    onChange?.(undefined)
  }

  // Стили для кнопок навигации
  const buttonBase = "flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 dark:border-dark-muted text-sm font-medium text-neutral-700 dark:text-dark-text transition-all duration-200 hover:bg-neutral-100 dark:hover:bg-dark-muted hover:border-neutral-400 dark:hover:border-dark-text hover:scale-110 hover:shadow-lg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:scale-100 disabled:hover:shadow-none"

  return (
    <div className="relative overflow-visible w-full max-w-full box-border" onClick={handleContainerClick}>
      {/* Custom Header with Navigation */}
      <div className="flex items-center justify-between px-2 pb-3">
        <button
          type="button"
          aria-label="Poprzedni miesiąc"
          onClick={(event) => {
            event.stopPropagation()
            const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1)
            const minMonth = new Date(today.getFullYear(), today.getMonth(), 1)
            if (prevMonth >= minMonth) handleMonthChange(prevMonth)
          }}
          disabled={month <= new Date(today.getFullYear(), today.getMonth(), 1)}
          className={buttonBase}
        >
          ‹
        </button>
        <div className="relative flex-1 text-center">
          <div className="h-6 overflow-hidden">
            <span className="inline-block text-base font-medium text-neutral-800 dark:text-dark-text">
              {month.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
                .replace(/^\w/, c => c.toUpperCase())}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Następny miesiąc"
          onClick={(event) => {
            event.stopPropagation()
            const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1)
            handleMonthChange(nextMonth)
          }}
          className={buttonBase}
        >
          ›
        </button>
      </div>
      <div className="overflow-x-hidden w-full max-w-full box-border lg:-m-4 lg:p-4">
        <DayPicker
          mode="single"
          month={month}
          locale={pl}
          selected={selected}
          onSelect={(d) => {
            setSelected(d || undefined)
            onChange?.(d || undefined)
          }}
          onDayClick={(_, __, event) => {
            event.stopPropagation()
          }}
          fromDate={today}
          toDate={rangeUntil}
          disabled={isDisabled}
          modifiers={{ available }}
          modifiersClassNames={{
            available:
              'bg-accent/40 rounded-full transition duration-200 hover:scale-103 hover:bg-accent/60 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-accent/60',
            disabled: 'opacity-30 pointer-events-none',
          }}
          classNames={{
            day: 'h-10 w-10 rounded-full transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
            month: 'space-y-2',
            table: 'w-full max-w-full border-collapse mx-auto',
          }}
          onMonthChange={handleMonthChange}
          className="w-full max-w-full"
        />
      </div>
      {isLoadingDays && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-dark-card/80"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500 dark:border-dark-muted dark:border-t-dark-text" />
          <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-dark-text">Wyszukujemy dostępne dni…</p>
        </div>
      )}
    </div>
  )
}
