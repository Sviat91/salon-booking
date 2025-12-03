"use client"
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { pl, enGB, uk } from 'date-fns/locale'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { translateProcedureName } from '@/lib/procedure-translator'
import type { TimeChangeSession } from './types'

interface TimeChangeSuccessPanelProps {
  timeChangeSession: TimeChangeSession
  onBackToResults: () => void
}

export default function TimeChangeSuccessPanel({
  timeChangeSession,
  onBackToResults,
}: TimeChangeSuccessPanelProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const { originalBooking: booking, newSlot } = timeChangeSession
  
  const dateLocale = useMemo(() => {
    switch (language) {
      case 'uk': return uk
      case 'en': return enGB
      default: return pl
    }
  }, [language])

  // Safety check - should not happen in success state
  if (!newSlot) {
    return null
  }

  const newStartTime = new Date(newSlot.startISO)
  const newEndTime = new Date(newSlot.endISO)
  const newDateStr = format(newStartTime, 'EEEE, d MMMM', { locale: dateLocale })
  const newTimeStr = `${format(newStartTime, 'HH:mm')}–${format(newEndTime, 'HH:mm')}`
  
  const procedureName = translateProcedureName(booking.procedureName, language)

  return (
    <div className="space-y-4">
      {/* Success Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
          {t('management.termChangedSuccess')}
        </h3>
        <p className="text-sm text-green-600 dark:text-green-300 mt-1">
          {t('management.bookingUpdated')}
        </p>
      </div>

      {/* Updated Booking Details */}
      <div className="rounded-xl border border-green-200 bg-green-50/50 p-4 dark:border-green-800 dark:bg-green-900/20">
        <div className="space-y-3">
          {/* Procedure */}
          <div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">{t('management.treatmentLabel')}</span>
            <p className="text-green-900 dark:text-green-100 font-medium">{procedureName}</p>
          </div>

          {/* New Time - highlighted in green */}
          <div className="bg-green-100 dark:bg-green-800/30 rounded-lg p-3 border border-green-300 dark:border-green-700">
            <span className="text-sm font-medium text-green-800 dark:text-green-200">{t('management.newTerm')}</span>
            <p className="text-green-900 dark:text-green-100 font-semibold text-lg">
              {newDateStr}
            </p>
            <p className="text-green-800 dark:text-green-200 font-medium">
              {newTimeStr}
            </p>
          </div>

          {/* Price */}
          <div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">{t('management.priceLabel')}</span>
            <p className="text-green-900 dark:text-green-100 font-medium">{booking.price} zł</p>
          </div>

          {/* Duration */}
          <div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">{t('management.durationLabel')}</span>
            <p className="text-green-900 dark:text-green-100">{booking.procedureDurationMin} min</p>
          </div>

          {/* Client Info */}
          <div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">{t('management.clientLabel')}</span>
            <p className="text-green-900 dark:text-green-100">{booking.firstName} {booking.lastName}</p>
          </div>
        </div>
      </div>

      {/* Info Message */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 dark:bg-blue-900/20 dark:border-blue-800">
        <div className="flex items-start space-x-2">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">{t('management.changeSaved')}</p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
              {t('management.bookingAutoUpdated')}
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onBackToResults}
          className="rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-green-700 hover:shadow-md dark:bg-green-500 dark:hover:bg-green-600"
        >
          {t('management.backToResults')}
        </button>
      </div>
    </div>
  )
}
