"use client"

interface ContactMasterSuccessPanelProps {
  onClose: () => void
}

export default function ContactMasterSuccessPanel({ onClose }: ContactMasterSuccessPanelProps) {
  return (
    <div className="space-y-4">
      {/* Success Header - Beautiful styled success message */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
          Wiadomość wysłana!
        </h3>
        <p className="text-sm text-green-600 dark:text-green-300 mt-1">
          Twoja wiadomość została przekazana mistrzowi
        </p>
      </div>

      {/* Info Message */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 dark:bg-blue-900/20 dark:border-blue-800">
        <div className="flex items-start space-x-2">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Mistrz skontaktuje się z Tobą wkrótce</p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              Otrzymaliśmy Twoją wiadomość i przekazaliśmy ją mistrzowi. Spodziewaj się odpowiedzi w najbliższym czasie.
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-green-700 hover:shadow-md dark:bg-green-500 dark:hover:bg-green-600"
        >
          Zamknij
        </button>
      </div>
    </div>
  )
}
