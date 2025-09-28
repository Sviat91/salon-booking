"use client"

interface NoResultsPanelProps {
  onRetry: () => void
  onExtendSearch: () => void
  onContactMaster: () => void
}

export default function NoResultsPanel({ onRetry, onExtendSearch, onContactMaster }: NoResultsPanelProps) {
  return (
    <div className="h-[18rem] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <div className="text-center py-6">
        <div className="text-2xl mb-2">😔</div>
        <div className="text-lg font-medium text-neutral-700 dark:text-dark-text mb-2">
          Nie znaleziono rezerwacji
        </div>
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          Sprawdź poprawność danych i spróbuj ponownie
        </div>
      </div>
      <div className="space-y-3">
        <button type="button" onClick={onRetry} className="btn btn-primary w-full">
          Sprawdź ponownie
        </button>
        <button type="button" onClick={onExtendSearch} className="btn btn-outline w-full">
          Rozszerz zakres dat
        </button>
        <button type="button" onClick={onContactMaster} className="btn btn-outline w-full">
          Skontaktuj się z mistrzem
        </button>
      </div>
    </div>
  )
}
