"use client"
import type { BookingResult, ProcedureOption } from './types'

interface EditProcedurePanelProps {
  booking: BookingResult
  selectedProcedure: ProcedureOption | null
  procedures: ProcedureOption[]
  onSelectProcedure: (procedure: ProcedureOption | null) => void
  onBack: () => void
  onConfirmSameTime: () => void
  onRequestNewTime: () => void
  onCheckAvailability: () => void
}

export default function EditProcedurePanel({
  booking,
  selectedProcedure,
  procedures,
  onSelectProcedure,
  onBack,
  onConfirmSameTime,
  onRequestNewTime,
  onCheckAvailability,
}: EditProcedurePanelProps) {
  const currentDuration = booking.procedureDurationMin
  const newDuration = selectedProcedure?.duration_min ?? currentDuration
  const durationDiff = newDuration - currentDuration
  const isSameOrShorter = durationDiff <= 0

  return (
    <div className="space-y-4" role="dialog" aria-label="Zmiana procedury">
      <div className="text-sm text-neutral-600 dark:text-dark-muted">
        Wybierz nową procedurę dla rezerwacji:
      </div>

      <div className="space-y-2">
        <div className="rounded-xl border border-border bg-neutral-50 p-3 dark:bg-dark-border/30 dark:border-dark-border">
          <div className="text-xs text-neutral-500 dark:text-dark-muted mb-1">Obecna procedura:</div>
          <div className="text-sm font-medium dark:text-dark-text">
            {booking.procedureName}
          </div>
          <div className="text-xs text-neutral-500 dark:text-dark-muted">
            {currentDuration} min • {booking.price}zł
          </div>
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto rounded-xl border border-border dark:border-dark-border">
        <div className="divide-y divide-border/60 dark:divide-dark-border/60">
          {procedures.map((procedure) => {
            const isCurrent = procedure.name_pl === booking.procedureName
            const isSelected = selectedProcedure?.id === procedure.id
            return (
              <button
                key={procedure.id}
                type="button"
                disabled={isCurrent}
                onClick={() => onSelectProcedure(isSelected ? null : procedure)}
                className={`w-full px-3 py-2 text-left transition-colors ${
                  isCurrent
                    ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed dark:bg-dark-border/50 dark:text-dark-muted'
                    : isSelected
                      ? 'bg-primary/10 border-l-2 border-primary dark:bg-accent/20 dark:border-accent'
                      : 'hover:bg-primary/5 dark:hover:bg-dark-border/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm dark:text-dark-text">{procedure.name_pl}</span>
                  <span className="text-xs text-neutral-500 dark:text-dark-muted">
                    {procedure.duration_min} min
                    {isCurrent ? ' (obecna)' : ''}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedProcedure ? (
        <div className="space-y-3">
          {isSameOrShorter ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-400/50 dark:bg-green-400/10">
              <div className="text-sm text-green-700 dark:text-green-400">
                ✓ Nowa procedura jest {durationDiff === 0 ? 'tej samej długości' : `krótsza o ${Math.abs(durationDiff)} min`}
              </div>
              <div className="text-xs text-green-600 dark:text-green-300">
                Możesz zachować obecny termin lub wybrać nowy.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/50 dark:bg-amber-400/10">
              <div className="text-sm text-amber-700 dark:text-amber-400">
                ⚠ Nowa procedura jest dłuższa o {durationDiff} min
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-300">
                Sprawdzimy dostępność dla dłuższego terminu.
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onBack} className="btn btn-outline flex-1">
              Powrót
            </button>
            {isSameOrShorter ? (
              <>
                <button type="button" onClick={onConfirmSameTime} className="btn btn-primary flex-1">
                  Potwierdź na ten sam czas
                </button>
                <button type="button" onClick={onRequestNewTime} className="btn btn-outline flex-1">
                  Wybierz nowy termin
                </button>
              </>
            ) : (
              <button type="button" onClick={onCheckAvailability} className="btn btn-primary flex-1">
                Sprawdź dostępność
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-xs text-neutral-500 dark:text-dark-muted">
          Wybierz procedurę, aby kontynuować.
        </div>
      )}
    </div>
  )
}
