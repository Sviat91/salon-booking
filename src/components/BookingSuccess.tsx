"use client"
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

  return (
    <div className="transition-all duration-300 ease-out">
      <div className="text-lg font-medium mb-3 dark:text-dark-text">{t('success.title')}</div>
      
      <div className="space-y-1 mb-4">
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          <strong>{t('success.serviceLabel')}</strong> {procedureName ?? t('common.noData')}
        </div>
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          <strong>{t('success.dateLabel')}</strong> {terminLabel}
        </div>
        {procedurePrice && (
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            <strong>{t('success.priceLabel')}</strong> {procedurePrice} zł
          </div>
        )}
      </div>
      
      <div className="mb-4 p-3 bg-neutral-50 dark:bg-dark-border/30 rounded-lg">
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          <strong className="text-text dark:text-dark-text">{t('success.addressLabel')}</strong><br />
          Sarmacka 4B/ lokal 106<br />
          02-972 Warszawa<br />
          +48 789 894 948
        </div>
      </div>
      
      <div className="text-emerald-700 dark:text-emerald-400 mb-4">{t('success.thankYou')}</div>
      
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-lg bg-neutral-800 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-900 hover:shadow-md dark:bg-neutral-700 dark:hover:bg-neutral-600"
      >
        {t('success.close')}
      </button>
    </div>
  )
}
