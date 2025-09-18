"use client"
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import { DayPicker, type CaptionProps } from 'react-day-picker'
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
  const containerRef = useRef<HTMLDivElement | null>(null)

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

  const CustomCaption = ({ displayMonth }: CaptionProps) => {
    const label = displayMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    const [stage, setStage] = useState<'enterStart' | 'enterEnd'>('enterEnd')
    const mountedRef = useRef(false)

    useEffect(() => {
      if (!mountedRef.current) {
        mountedRef.current = true
        return
      }
      setStage('enterStart')
      const id = requestAnimationFrame(() => setStage('enterEnd'))
      return () => cancelAnimationFrame(id)
    }, [label])

    const prevMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1)
    const nextMonthValue = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1)
    const minMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const isPrevDisabled = prevMonth < minMonth

    const buttonBase = "flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
    const enterClass = navDirection === 'forward' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'
    const finalClass = 'opacity-100 translate-x-0'

    return (
      <div className="flex items-center justify-between px-2 pb-3">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={(event) => {
            event.stopPropagation()
            if (!isPrevDisabled) handleMonthChange(prevMonth)
          }}
          disabled={isPrevDisabled}
          className={buttonBase}
          data-calendar-nav
        >
          ‹
        </button>
        <div className="relative flex-1 text-center">
          <div className="h-6 overflow-hidden">
            <span
              className={`inline-block text-base font-medium capitalize text-neutral-800 transition-all duration-300 ease-out ${stage === 'enterStart' ? enterClass : finalClass}`}
              onClick={(event) => event.stopPropagation()}
            >
              {label}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Следующий месяц"
          onClick={(event) => {
            event.stopPropagation()
            handleMonthChange(nextMonthValue)
          }}
          className={buttonBase}
          data-calendar-nav
        >
          ›
        </button>
      </div>
    )
  }

  const isLoadingDays = !!procedureId && (isFetching || isLoading)

  useEffect(() => {
    if (!procedureId && selected) {
      setSelected(undefined)
      onChange?.(undefined)
    }
  }, [procedureId, selected, onChange])

  function clearSelection() {
    if (!selected) return
    setSelected(undefined)
    onChange?.(undefined)
  }

  function handleContainerClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (!containerRef.current) return
    if (!containerRef.current.contains(target)) return
    if (target.closest('.rdp-day')) return
    if (target.closest('[data-calendar-nav]')) return
    clearSelection()
  }

  return (
    <div ref={containerRef} className="relative" onClick={handleContainerClick}>
      <DayPicker
        mode="single"
        month={month}
        selected={selected}
        onSelect={(d) => {
          setSelected(d)
          onChange?.(d)
        }}
        fromDate={today}
        toDate={rangeUntil}
        disabled={isDisabled}
        modifiers={{ available }}
        modifiersClassNames={{
          available:
            'bg-accent/40 rounded-full transition duration-200 ease-out hover:scale-105 hover:ring-1 hover:ring-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400',
          disabled: 'opacity-30 pointer-events-none',
        }}
        onMonthChange={handleMonthChange}
        onDayClick={(_, __, event) => {
          event.stopPropagation()
        }}
        components={{ Caption: CustomCaption }}
        className="mx-auto w-[320px] max-w-full"
      />
      {isLoadingDays && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500" />
          <p className="mt-3 text-sm font-medium text-neutral-600">Подбираем доступные дни…</p>
        </div>
      )}
    </div>
  )
}
