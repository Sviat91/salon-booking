"use client"
import { useMemo } from 'react'
import type { BookingResult } from './types'

interface ResultsPanelProps {
  results: BookingResult[]
  selectedBookingId?: string
  onSelect: (booking: BookingResult | null) => void
  onChangeProcedure: (booking: BookingResult) => void
  onCancelRequest: (booking: BookingResult) => void
}

export default function ResultsPanel({
  results,
  selectedBookingId,
  onSelect,
  onChangeProcedure,
  onCancelRequest,
}: ResultsPanelProps) {
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [],
  )
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('pl-PL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [],
  )

  return (
    <div className="space-y-4">
      <div className="text-sm text-neutral-600 dark:text-dark-muted">
        Znalezione rezerwacje ({results.length}):
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 dark:bg-dark-card/80 dark:border-dark-border">
        <div className="space-y-3">
          {results.map((booking) => {
            const isSelected = booking.eventId === selectedBookingId
            const dateStr = dateFormatter.format(booking.startTime)
            const timeStr = `${timeFormatter.format(booking.startTime)}–${timeFormatter.format(booking.endTime)}`

            return (
              <div
                key={booking.eventId}
                className={`relative cursor-pointer rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? 'border-primary bg-primary/10 dark:border-accent dark:bg-accent/10'
                    : 'border-border bg-white/50 hover:bg-primary/5 dark:border-dark-border dark:bg-dark-card/50 dark:hover:bg-dark-border/30'
                }`}
                onClick={() => onSelect(isSelected ? null : booking)}
              >
                <div className="space-y-1 p-3">
                  <div className="text-sm font-medium dark:text-dark-text">{booking.procedureName}</div>
                  <div className="text-xs text-neutral-600 dark:text-dark-muted">
                    {dateStr} • {timeStr}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-dark-muted">Cena: {booking.price}zł</div>
                  {!booking.canModify && (
                    <div className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                      Mniej niż 24h - skontaktuj się z mistrzem
                    </div>
                  )}
                  {isSelected && booking.canModify ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onChangeProcedure(booking)
                        }}
                        className="btn btn-outline text-xs px-3 py-1"
                      >
                        Zmień
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onCancelRequest(booking)
                        }}
                        className="text-xs px-3 py-1 rounded-lg border border-red-400 text-red-600 transition-colors hover:bg-red-50 hover:border-red-500 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
                      >
                        Anuluj
                      </button>
                    </div>
                  ) : null}
                  {isSelected && !booking.canModify ? (
                    <div className="mt-3 text-xs text-neutral-500 dark:text-dark-muted">
                      Ta rezerwacja nie może być zmodyfikowana online.
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
