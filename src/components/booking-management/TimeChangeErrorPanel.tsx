"use client"
import type { BookingResult } from './types'

interface TimeChangeErrorPanelProps {
  timeChangeSession: {
    originalBooking: BookingResult
    newSlot: { startISO: string; endISO: string }
  } | null
  errorMessage: string | null
  onBackToResults: () => void
  onTryAgain: () => void
}

export default function TimeChangeErrorPanel({
  timeChangeSession,
  errorMessage,
  onBackToResults,
  onTryAgain,
}: TimeChangeErrorPanelProps) {
  const booking = timeChangeSession?.originalBooking
  
  return (
    <div className="space-y-4">
      {/* Error Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
          Nie udało się zmienić terminu
        </h3>
        <p className="text-sm text-red-600 dark:text-red-300 mt-1">
          Wystąpił problem podczas aktualizacji rezerwacji
        </p>
      </div>

      {/* Current Booking Details */}
      {booking && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="space-y-3">
            {/* Procedure */}
            <div>
              <span className="text-sm font-medium text-red-800 dark:text-red-200">Zabieg:</span>
              <p className="text-red-900 dark:text-red-100 font-medium">{booking.procedureName}</p>
            </div>

            {/* Current Time */}
            <div>
              <span className="text-sm font-medium text-red-800 dark:text-red-200">Aktualny termin:</span>
              <p className="text-red-900 dark:text-red-100 font-medium">
                {new Intl.DateTimeFormat('pl-PL', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                }).format(booking.startTime)}
              </p>
              <p className="text-red-800 dark:text-red-200">
                {new Intl.DateTimeFormat('pl-PL', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }).format(booking.startTime)}–{new Intl.DateTimeFormat('pl-PL', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                }).format(booking.endTime)}
              </p>
            </div>

            {/* Client Info */}
            <div>
              <span className="text-sm font-medium text-red-800 dark:text-red-200">Klient:</span>
              <p className="text-red-900 dark:text-red-100">{booking.firstName} {booking.lastName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 dark:bg-red-900/20 dark:border-red-800">
        <div className="flex items-start space-x-3">
          <svg className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm text-red-800 dark:text-red-200 font-medium">Szczegóły błędu:</p>
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">
              {errorMessage || 'Wystąpił nieoczekiwany błąd podczas zmiany terminu.'}
            </p>
          </div>
        </div>
      </div>

      {/* Support Info */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 dark:bg-blue-900/20 dark:border-blue-800">
        <div className="flex items-start space-x-3">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Potrzebujesz pomocy?</p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              Skontaktuj się z obsługą lub napisz bezpośrednio do mistrza. Twoja obecna rezerwacja pozostaje bez zmian.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onTryAgain}
          className="flex-1 rounded-lg border border-red-300 bg-white px-4 py-3 text-sm font-medium text-red-700 transition-all duration-200 hover:bg-red-50 hover:border-red-400 hover:shadow-sm dark:border-red-700 dark:bg-dark-card dark:text-red-300 dark:hover:bg-red-900/10"
        >
          Spróbuj ponownie
        </button>
        <button
          type="button"
          onClick={onBackToResults}
          className="flex-1 rounded-lg bg-neutral-600 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-700 hover:shadow-md dark:bg-neutral-500 dark:hover:bg-neutral-600"
        >
          Powrót do wyników
        </button>
      </div>
    </div>
  )
}
