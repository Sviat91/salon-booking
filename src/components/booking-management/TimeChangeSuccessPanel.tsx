"use client"
import type { BookingResult, SlotSelection } from './types'

interface TimeChangeSuccessPanelProps {
  timeChangeSession: {
    originalBooking: BookingResult
    newSlot: SlotSelection
  }
  onBackToResults: () => void
}

export default function TimeChangeSuccessPanel({
  timeChangeSession,
  onBackToResults,
}: TimeChangeSuccessPanelProps) {
  const { originalBooking: booking, newSlot } = timeChangeSession
  
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

  const newStartTime = new Date(newSlot.startISO)
  const newEndTime = new Date(newSlot.endISO)
  const newDateStr = dateFormatter.format(newStartTime)
  const newTimeStr = `${timeFormatter.format(newStartTime)}–${timeFormatter.format(newEndTime)}`

  return (
    <div className="space-y-4">
      {/* Success Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
          Termin został pomyślnie zmieniony!
        </h3>
        <p className="text-sm text-green-600 dark:text-green-300 mt-1">
          Twoja rezerwacja została zaktualizowana
        </p>
      </div>

      {/* Updated Booking Details */}
      <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 dark:border-green-800 dark:bg-green-900/20">
        <div className="space-y-3">
          {/* Procedure */}
          <div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">Zabieg:</span>
            <p className="text-green-900 dark:text-green-100 font-medium">{booking.procedureName}</p>
          </div>

          {/* New Time - highlighted in green */}
          <div className="bg-green-100 dark:bg-green-800/30 rounded-lg p-3 border border-green-300 dark:border-green-700">
            <span className="text-sm font-medium text-green-800 dark:text-green-200">Nowy termin:</span>
            <p className="text-green-900 dark:text-green-100 font-semibold text-lg">
              {newDateStr}
            </p>
            <p className="text-green-800 dark:text-green-200 font-medium">
              {newTimeStr}
            </p>
          </div>

          {/* Price */}
          <div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">Cena:</span>
            <p className="text-green-900 dark:text-green-100 font-medium">{booking.price} zł</p>
          </div>

          {/* Duration */}
          <div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">Czas trwania:</span>
            <p className="text-green-900 dark:text-green-100">{booking.procedureDurationMin} min</p>
          </div>

          {/* Client Info */}
          <div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">Klient:</span>
            <p className="text-green-900 dark:text-green-100">{booking.firstName} {booking.lastName}</p>
          </div>
        </div>
      </div>

      {/* Info Message */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 dark:bg-blue-900/20 dark:border-blue-800">
        <div className="flex items-start space-x-2">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Zmiana została zapisana</p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              Twoja rezerwacja została automatycznie zaktualizowana w kalendarzu. Możesz bezpiecznie zamknąć to okno.
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onBackToResults}
          className="rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-green-700 hover:shadow-md dark:bg-green-500 dark:hover:bg-green-600"
        >
          Powrót do wyników
        </button>
      </div>
    </div>
  )
}
