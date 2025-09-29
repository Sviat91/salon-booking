"use client"

interface ErrorFallbackPanelProps {
  onRetry: () => void
  onContactMaster: () => void
}

export default function ErrorFallbackPanel({ onRetry, onContactMaster }: ErrorFallbackPanelProps) {
  return (
    <div className="h-[18rem] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <div className="text-center py-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-dark-text mb-2">
          Wystąpił błąd
        </h3>
        <p className="text-sm text-neutral-600 dark:text-dark-muted mb-6">
          Nie można wyświetlić danych. Spróbuj ponownie.
        </p>
        <div className="space-y-3">
          <button type="button" onClick={onRetry} className="btn btn-primary w-full">
            Sprawdź ponownie
          </button>
          <button type="button" onClick={onContactMaster} className="btn btn-outline w-full">
            Skontaktuj się z mistrzem
          </button>
        </div>
      </div>
    </div>
  )
}
