"use client"
import type { BookingResult, SlotSelection } from './types'

interface DirectTimeChangePanelProps {
  booking: BookingResult
  selectedDate?: Date
  selectedSlot?: SlotSelection | null
  newSlot?: SlotSelection | null
  isSubmitting: boolean
  errorMessage: string | null
  onConfirm: () => void
  onBack: () => void
  canConfirm: boolean
  turnstileNode?: React.ReactNode
  turnstileRequired?: boolean
}

export default function DirectTimeChangePanel({
  booking,
  selectedDate,
  selectedSlot,
  newSlot,
  isSubmitting,
  errorMessage,
  onConfirm,
  onBack,
  canConfirm,
  turnstileNode,
  turnstileRequired,
}: DirectTimeChangePanelProps) {
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

  // Current booking time
  const currentDateStr = dateFormatter.format(booking.startTime)
  const currentTimeStr = `${timeFormatter.format(booking.startTime)}–${timeFormatter.format(booking.endTime)}`

  // New selected time - показываем selectedSlot если есть, иначе newSlot
  let newDateStr = 'Wybierz datę'
  let newTimeStr = 'i czas'
  let hasNewTime = false

  const displaySlot = selectedSlot || newSlot
  if (displaySlot) {
    const newStartTime = new Date(displaySlot.startISO)
    const newEndTime = new Date(displaySlot.endISO)
    newDateStr = dateFormatter.format(newStartTime)
    newTimeStr = `${timeFormatter.format(newStartTime)}–${timeFormatter.format(newEndTime)}`
    hasNewTime = true
  } else if (selectedDate) {
    newDateStr = dateFormatter.format(selectedDate)
    newTimeStr = 'Wybierz czas'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-dark-text">
          Zmiana terminu
        </h3>
        <p className="text-sm text-neutral-600 dark:text-dark-muted mt-1">
          Wybierz nową datę i czas w kalendarzu
        </p>
      </div>

      {/* Procedure info */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-dark-border dark:bg-dark-border/30">
        <div className="font-medium text-neutral-800 dark:text-dark-text mb-3">
          {booking.procedureName}
        </div>
        
        {/* Current time - RED */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 border border-red-200/50 dark:bg-red-900/10 dark:border-red-800/30">
            <div>
              <div className="text-sm font-medium text-red-800 dark:text-red-400">Aktualny termin</div>
              <div className="text-sm text-red-600 dark:text-red-300">
                {currentDateStr} • {currentTimeStr}
              </div>
            </div>
            <div className="text-red-500 dark:text-red-400">❌</div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="text-neutral-400 dark:text-neutral-500">↓</div>
          </div>

          {/* New time - GREEN when selected */}
          <div className={`flex items-center justify-between p-3 rounded-lg border ${
            hasNewTime 
              ? 'bg-green-50/50 border-green-200/50 dark:bg-green-900/10 dark:border-green-800/30' 
              : 'bg-gray-50/50 border-gray-200/50 dark:bg-gray-900/10 dark:border-gray-800/30'
          }`}>
            <div>
              <div className={`text-sm font-medium ${
                hasNewTime 
                  ? 'text-green-800 dark:text-green-400'
                  : 'text-gray-800 dark:text-gray-400'
              }`}>
                Nowy termin
              </div>
              <div className={`text-sm ${
                hasNewTime 
                  ? 'text-green-600 dark:text-green-300'
                  : 'text-gray-600 dark:text-gray-300'
              }`}>
                {newDateStr} • {newTimeStr}
              </div>
            </div>
            <div className={hasNewTime ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
              {hasNewTime ? '✅' : '❓'}
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-sm text-red-700 dark:text-red-300">{errorMessage}</div>
        </div>
      )}

      {/* Turnstile */}
      {turnstileNode && (
        <div className="flex justify-center">
          {turnstileNode}
        </div>
      )}

      {/* Turnstile required message */}
      {turnstileRequired && (
        <div className="text-xs text-neutral-500 dark:text-dark-muted text-center">
          Potwierdź weryfikację Turnstile, aby kontynuować.
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-border/50 dark:hover:border-dark-border/80"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting || !canConfirm || turnstileRequired}
          className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed dark:bg-accent dark:hover:bg-accent/90"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
              <span>Zapisywanie...</span>
            </div>
          ) : (
            'Potwierdź zmianę'
          )}
        </button>
      </div>
    </div>
  )
}
