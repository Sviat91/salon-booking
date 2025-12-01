"use client"
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { pl, enGB, uk } from 'date-fns/locale'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { translateProcedureName } from '@/lib/procedure-translator'
import type { BookingResult } from './types'

interface EditSelectionPanelProps {
  booking: BookingResult
  onChangeTime: () => void
  onBack: () => void
  onChangeProcedure: () => void
}

export default function EditSelectionPanel({
  booking,
  onChangeTime,
  onBack,
  onChangeProcedure,
}: EditSelectionPanelProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()

  const dateLocale = useMemo(() => {
    switch (language) {
      case 'uk': return uk
      case 'en': return enGB
      default: return pl
    }
  }, [language])

  const dateStr = format(booking.startTime, 'EEEE, d MMMM', { locale: dateLocale })
  const timeStr = `${format(booking.startTime, 'HH:mm')}–${format(booking.endTime, 'HH:mm')}`
  const procedureName = translateProcedureName(booking.procedureName, language)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-dark-text">
          {t('management.selectChangeType')}
        </h3>
      </div>

      {/* Booking info */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-dark-border dark:bg-dark-border/30">
        <div className="space-y-1">
          <div className="font-medium text-neutral-800 dark:text-dark-text">{procedureName}</div>
          <div className="text-sm text-neutral-600 dark:text-dark-muted">
            {dateStr} • {timeStr}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={onChangeTime}
          className="w-full rounded-lg border border-neutral-300 bg-white p-4 text-left transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-sm dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-border/50 dark:hover:border-dark-border/80"
        >
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🕐</div>
            <div>
              <div className="font-medium text-neutral-800 dark:text-dark-text">
                {t('management.changeTerm')}
              </div>
              <div className="text-sm text-neutral-600 dark:text-dark-muted">
                {t('management.selectOtherDateOrTime')}
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onChangeProcedure}
          className="w-full rounded-lg border border-neutral-300 bg-white p-4 text-left transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-sm dark:border-dark-border dark:bg-dark-card dark:hover:bg-dark-border/50 dark:hover:border-dark-border/80"
        >
          <div className="flex items-center space-x-3">
            <div className="text-2xl">💆‍♀️</div>
            <div>
              <div className="font-medium text-neutral-800 dark:text-dark-text">
                {t('management.changeProcedureBtn')}
              </div>
              <div className="text-sm text-neutral-600 dark:text-dark-muted">
                {t('management.selectNewProcedureOrBack')}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Back button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-sm dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-border/50 dark:hover:border-dark-border/80"
        >
          {t('management.backToBookingList')}
        </button>
      </div>
    </div>
  )
}
