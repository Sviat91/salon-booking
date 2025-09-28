"use client"
import type { BookingResult } from './types'

interface EditSelectionPanelProps {
  booking: BookingResult
  onChangeTime: () => void
  onBack: () => void
}

export default function EditSelectionPanel({
  booking,
  onChangeTime,
  onBack,
}: EditSelectionPanelProps) {
  const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const dateFormatter = new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const dateStr = dateFormatter.format(booking.startTime)
  const timeStr = `${timeFormatter.format(booking.startTime)}–${timeFormatter.format(booking.endTime)}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-dark-text">
          Wybierz typ zmiany
        </h3>
      </div>

      {/* Booking info */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-dark-border dark:bg-dark-border/30">
        <div className="space-y-1">
          <div className="font-medium text-neutral-800 dark:text-dark-text">{booking.procedureName}</div>
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            {dateStr} • {timeStr}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={onChangeTime}
          className="w-full rounded-lg border border-neutral-300 bg-white p-4 text-left transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-sm dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-border/50 dark:hover:border-dark-border/80"
        >
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🕐</div>
            <div>
              <div className="font-medium text-neutral-800 dark:text-dark-text">
                Zmień termin
              </div>
              <div className="text-sm text-neutral-600 dark:text-dark-muted">
                Wybierz inną datę lub godzinę
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => alert('Funkcja zmiany procedury będzie dostępna wkrótce')}
          className="w-full rounded-lg border border-neutral-300 bg-white p-4 text-left transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-sm dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-border/50 dark:hover:border-dark-border/80 opacity-60 cursor-not-allowed"
        >
          <div className="flex items-center space-x-3">
            <div className="text-2xl">💆‍♀️</div>
            <div>
              <div className="font-medium text-neutral-800 dark:text-dark-text">
                Zmień procedurę
              </div>
              <div className="text-sm text-neutral-600 dark:text-dark-muted">
                Funkcja w przygotowaniu
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Back button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-sm dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-border/50 dark:hover:border-dark-border/80"
        >
          ← Powrót do listy rezerwacji
        </button>
      </div>
    </div>
  )
}
