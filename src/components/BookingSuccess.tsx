"use client"

type Procedure = { name_pl: string; price_pln?: number }

interface BookingSuccessProps {
  procedureName: string | null
  terminLabel: string
  procedurePrice?: number
  onClose: () => void
}

export default function BookingSuccess({
  procedureName,
  terminLabel,
  procedurePrice,
  onClose,
}: BookingSuccessProps) {
  return (
    <div className="transition-all duration-300 ease-out">
      <div className="text-lg font-medium mb-3 dark:text-dark-text">Rezerwacja potwierdzona</div>
      
      <div className="space-y-1 mb-4">
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          <strong>Usługa:</strong> {procedureName ?? 'Brak danych'}
        </div>
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          <strong>Termin:</strong> {terminLabel}
        </div>
        {procedurePrice && (
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            <strong>Cena:</strong> {procedurePrice} zł
          </div>
        )}
      </div>
      
      <div className="mb-4 p-3 bg-neutral-50 dark:bg-dark-border/30 rounded-lg">
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          <strong className="text-text dark:text-dark-text">Adres:</strong><br />
          Sarmacka 4B/ lokal 106<br />
          02-972 Warszawa<br />
          +48 789 894 948
        </div>
      </div>
      
      <div className="text-emerald-700 dark:text-emerald-400 mb-4">Dziękujemy, do zobaczenia!</div>
      
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-lg bg-neutral-800 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-900 hover:shadow-md dark:bg-neutral-700 dark:hover:bg-neutral-600"
      >
        Zamknij
      </button>
    </div>
  )
}
