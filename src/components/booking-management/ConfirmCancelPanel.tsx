"use client"
import { useTranslation } from 'react-i18next'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { translateProcedureName } from '@/lib/procedure-translator'
import type { BookingResult } from './types'

interface ConfirmCancelPanelProps {
  booking: BookingResult
  isSubmitting: boolean
  errorMessage?: string | null
  onConfirm: () => void
  onBack: () => void
}

export default function ConfirmCancelPanel({
  booking,
  isSubmitting,
  errorMessage,
  onConfirm,
  onBack,
}: ConfirmCancelPanelProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  
  const dateLocale = language === 'uk' ? 'uk-UA' : language === 'en' ? 'en-US' : 'pl-PL'
  const dateLabel = new Intl.DateTimeFormat(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(booking.startTime)

  const procedureName = translateProcedureName(booking.procedureName, language)

  return (
    <div className="overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <div className="text-sm text-neutral-600 dark:text-dark-muted">
        {t('management.cancelConfirm')}
      </div>

      <div className="rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-400 dark:bg-red-400/10">
        <div className="text-sm font-medium text-red-700 dark:text-red-400">{procedureName}</div>
        <div className="text-xs text-red-700/80 dark:text-red-300">{dateLabel}</div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400 dark:bg-red-400/10 dark:text-red-400">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="btn btn-outline flex-1">
          {t('management.cancelNo')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className={`btn flex-1 bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400 ${
            isSubmitting ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          {isSubmitting ? t('management.cancelling') : t('management.cancelYes')}
        </button>
      </div>
    </div>
  )
}
