"use client"
import type { BookingResult, ProcedureOption, SlotSelection } from './types'

interface ConfirmChangePanelProps {
  booking: BookingResult
  newProcedure: ProcedureOption | null
  newSlot: SlotSelection | null
  isSubmitting: boolean
  errorMessage?: string | null
  onConfirm: () => void
  onBack: () => void
}

export default function ConfirmChangePanel({
  booking,
  newProcedure,
  newSlot,
  isSubmitting,
  errorMessage,
  onConfirm,
  onBack,
}: ConfirmChangePanelProps) {
  const newStart = newSlot ? new Date(newSlot.startISO) : null
  const newEnd = newSlot ? new Date(newSlot.endISO) : null

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('pl-PL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)

  return (
    <div className="space-y-4">
      <div className="text-sm text-neutral-600 dark:text-dark-muted">
        Potwierdź zmiany rezerwacji:
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-neutral-50 p-3 dark:bg-dark-border/30 dark:border-dark-border">
          <div className="text-xs text-neutral-500 dark:text-dark-muted mb-1">Aktualnie:</div>
          <div className="text-sm font-medium dark:text-dark-text">{booking.procedureName}</div>
          <div className="text-xs text-neutral-500 dark:text-dark-muted">{formatDate(booking.startTime)}</div>
        </div>

        <div className="rounded-xl border border-primary bg-primary/10 p-3 dark:border-accent dark:bg-accent/10">
          <div className="text-xs text-primary dark:text-accent mb-1">Po zmianach:</div>
          <div className="text-sm font-medium text-primary dark:text-accent">
            {newProcedure ? newProcedure.name_pl : booking.procedureName}
          </div>
          {newStart && newEnd ? (
            <div className="text-xs text-primary/80 dark:text-accent/80">{formatDate(newStart)}</div>
          ) : (
            <div className="text-xs text-primary/80 dark:text-accent/80">
              Godzina bez zmian ({formatDate(booking.startTime)})
            </div>
          )}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400 dark:bg-red-400/10 dark:text-red-400">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="btn btn-outline flex-1">
          Powrót
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className={`btn btn-primary flex-1 ${isSubmitting ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {isSubmitting ? 'Zapisywanie…' : 'Potwierdź zmiany'}
        </button>
      </div>
    </div>
  )
}
