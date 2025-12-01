"use client"
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { pl, enGB, uk } from 'date-fns/locale'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { translateProcedureName } from '@/lib/procedure-translator'
import type { BookingResult, SlotSelection } from './types'

interface ConfirmTimeChangePanelProps {
  booking: BookingResult
  newSlot: SlotSelection
  isSubmitting: boolean
  errorMessage?: string | null
  onCancel: () => void
  onConfirm: () => void
  onBack: () => void
}

export default function ConfirmTimeChangePanel({
  booking,
  newSlot,
  isSubmitting,
  errorMessage,
  onConfirm,
  onBack,
}: ConfirmTimeChangePanelProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  
  const dateLocale = useMemo(() => {
    switch (language) {
      case 'uk': return uk
      case 'en': return enGB
      default: return pl
    }
  }, [language])

  // Current booking time
  const currentDateStr = format(booking.startTime, 'EEEE, d MMMM', { locale: dateLocale })
  const currentTimeStr = `${format(booking.startTime, 'HH:mm')}–${format(booking.endTime, 'HH:mm')}`

  // New selected time
  const newStartTime = new Date(newSlot.startISO)
  const newEndTime = new Date(newSlot.endISO)
  const newDateStr = format(newStartTime, 'EEEE, d MMMM', { locale: dateLocale })
  const newTimeStr = `${format(newStartTime, 'HH:mm')}–${format(newEndTime, 'HH:mm')}`
  
  const procedureName = translateProcedureName(booking.procedureName, language)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-dark-text">
          {t('management.termChangeConfirmation')}
        </h3>
        <p className="text-sm text-neutral-600 dark:text-dark-muted mt-1">
          {t('management.checkDetailsBeforeConfirm')}
        </p>
      </div>

      {/* Procedure info */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 dark:border-dark-border dark:bg-dark-border/30">
        <div className="font-medium text-neutral-800 dark:text-dark-text mb-3">
          {procedureName}
        </div>
        
        {/* Current time */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 border border-red-200/50 dark:bg-red-900/10 dark:border-red-800/30">
            <div>
              <div className="text-sm font-medium text-red-800 dark:text-red-400">{t('management.currentTermLabel')}</div>
              <div className="text-sm text-red-600 dark:text-red-300">
                {currentDateStr} • {currentTimeStr}
              </div>
            </div>
            <div className="text-red-500 dark:text-red-400">❌</div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="text-neutral-400 dark:text-neutral-500">↓</div>
          </div>

          {/* New time */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-50/50 border border-green-200/50 dark:bg-green-900/10 dark:border-green-800/30">
            <div>
              <div className="text-sm font-medium text-green-800 dark:text-green-400">{t('management.newTermLabel')}</div>
              <div className="text-sm text-green-600 dark:text-green-300">
                {newDateStr} • {newTimeStr}
              </div>
            </div>
            <div className="text-green-500 dark:text-green-400">✅</div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-sm text-red-700 dark:text-red-300">{errorMessage}</div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition-all duration-200 hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-border/50 dark:hover:border-dark-border/80"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed dark:bg-accent dark:hover:bg-accent/90"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
              <span>{t('management.saving')}</span>
            </div>
          ) : (
            t('management.confirmChange')
          )}
        </button>
      </div>
    </div>
  )
}
