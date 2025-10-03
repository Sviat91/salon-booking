"use client"
import Link from 'next/link'

interface BookingConsentModalProps {
  procedureName: string | null
  terminLabel: string
  dataProcessingConsent: boolean
  termsConsent: boolean
  notificationsConsent: boolean
  onDataProcessingChange: (checked: boolean) => void
  onTermsChange: (checked: boolean) => void
  onNotificationsChange: (checked: boolean) => void
  loading: boolean
  error: string | null
  onBack: () => void
  onConfirm: () => void
}

export default function BookingConsentModal({
  procedureName,
  terminLabel,
  dataProcessingConsent,
  termsConsent,
  notificationsConsent,
  onDataProcessingChange,
  onTermsChange,
  onNotificationsChange,
  loading,
  error,
  onBack,
  onConfirm,
}: BookingConsentModalProps) {
  const canConfirm = dataProcessingConsent && termsConsent && !loading
  
  return (
    <div className="transition-all duration-300 ease-out">
      <div className="text-lg font-medium mb-4 dark:text-dark-text">Przed dokonaniem rezerwacji:</div>
      
      {/* Booking summary */}
      <div className="mb-4 p-3 bg-neutral-50 dark:bg-dark-border/30 rounded-lg">
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          <strong className="text-text dark:text-dark-text">{procedureName}</strong>
          <br />
          {terminLabel}
        </div>
      </div>

      {/* Consent checkboxes */}
      <div className="space-y-4 mb-6">
        {/* Terms consent */}
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={termsConsent}
            onChange={(e) => onTermsChange(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary dark:border-dark-border dark:bg-dark-card dark:checked:bg-accent"
          />
          <span className="text-sm text-neutral-700 dark:text-dark-muted flex-1">
            Zapoznałem/am się i akceptuję{' '}
            <Link href="/terms" target="_blank" className="text-primary hover:underline dark:text-accent">
              Regulamin serwisu
            </Link>{' '}
            <span className="text-red-500">*</span>
          </span>
        </label>

        {/* Data processing consent */}
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={dataProcessingConsent}
            onChange={(e) => onDataProcessingChange(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary dark:border-dark-border dark:bg-dark-card dark:checked:bg-accent"
          />
          <span className="text-sm text-neutral-700 dark:text-dark-muted flex-1">
            Wyrażam zgodę na przetwarzanie moich danych osobowych zgodnie z{' '}
            <Link href="/privacy" target="_blank" className="text-primary hover:underline dark:text-accent">
              Polityką prywatności
            </Link>{' '}
            <span className="text-red-500">*</span>
          </span>
        </label>

        {/* Notifications consent (optional) */}
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={notificationsConsent}
            onChange={(e) => onNotificationsChange(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary dark:border-dark-border dark:bg-dark-card dark:checked:bg-accent"
          />
          <span className="text-sm text-neutral-700 dark:text-dark-muted flex-1">
            Wyrażam zgodę na otrzymywanie powiadomień o rezerwacji przez telefon/email (opcjonalnie)
          </span>
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 hover:border-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-border/50"
        >
          Powrót
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed dark:bg-accent dark:hover:bg-accent/90 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Rezerwowanie...</span>
            </>
          ) : (
            'Potwierdź i zarezerwuj'
          )}
        </button>
      </div>
    </div>
  )
}
