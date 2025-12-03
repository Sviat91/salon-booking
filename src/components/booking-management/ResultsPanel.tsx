"use client"
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { pl, enGB, uk } from 'date-fns/locale'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { translateProcedureName } from '@/lib/procedure-translator'
import type { BookingResult, ProcedureOption } from './types'

interface ResultsPanelProps {
  results: BookingResult[]
  selectedBookingId?: string
  searchCriteria?: {
    fullName?: string
    phone: string
    email?: string
  }
  procedures?: ProcedureOption[]
  onSelect: (booking: BookingResult | null) => void
  onChangeBooking: (booking: BookingResult) => void
  onCancelRequest: (booking: BookingResult) => void
  onContactMaster: () => void
  onBackToSearch: () => void
  onNewSearch: () => void
}

export default function ResultsPanel({
  results,
  selectedBookingId,
  searchCriteria,
  procedures,
  onSelect,
  onChangeBooking,
  onCancelRequest,
  onContactMaster,
  onBackToSearch,
  onNewSearch,
}: ResultsPanelProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()

  const dateLocale = useMemo(() => {
    switch (language) {
      case 'uk': return uk
      case 'en': return enGB
      default: return pl
    }
  }, [language])

  const displayName = searchCriteria?.fullName || t('management.unknown')
  const displayPhone = searchCriteria?.phone || t('management.unknown')

  const getBookingCountText = (count: number) => {
    if (count === 1) return t('management.bookingOne')
    if (count >= 2 && count <= 4) return t('management.bookingFew')
    return t('management.bookingMany')
  }
  
  return (
    <div className="overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <div className="space-y-2">
        <div className="text-sm text-neutral-700 dark:text-dark-text font-medium">
          {t('management.foundBookingsFor')} <span className="text-primary dark:text-accent">{displayName}</span>, {t('management.phone')} <span className="text-primary dark:text-accent">{displayPhone}</span>
        </div>
        <div className="text-sm text-neutral-600 dark:text-dark-muted">
          {t('management.total')} <strong>{results.length}</strong> {getBookingCountText(results.length)}
        </div>
        <div className="text-xs text-neutral-500 dark:text-dark-muted bg-neutral-50 dark:bg-dark-border/30 rounded-lg p-2">
          ℹ️ {t('management.onlineBookingsNote')}
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 dark:bg-dark-card/80 dark:border-dark-border">
        <div className="space-y-3">
          {results.map((booking) => {
            const isSelected = booking.eventId === selectedBookingId
            
            // Format date and time with current locale
            const dateStr = format(booking.startTime, 'EEEE, d MMMM', { locale: dateLocale })
            const timeStr = `${format(booking.startTime, 'HH:mm')}–${format(booking.endTime, 'HH:mm')}`
            
            // Translate procedure name
            const matchedProcedure = procedures?.find(p => p.id === booking.procedureId)
            const nameToTranslate = matchedProcedure?.name_pl || booking.procedureName
            const procedureName = translateProcedureName(nameToTranslate, language)

            return (
              <div
                key={booking.eventId}
                className={`relative cursor-pointer rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? 'border-primary bg-primary/10 dark:border-accent dark:bg-accent/10'
                    : 'border-border bg-white/50 hover:bg-primary/5 dark:border-dark-border dark:bg-dark-card/50 dark:hover:bg-dark-border/30'
                }`}
                onClick={() => onSelect(isSelected ? null : booking)}
              >
                <div className="space-y-1 p-3">
                  <div className="text-sm font-medium dark:text-dark-text">{procedureName}</div>
                  <div className="text-xs text-neutral-600 dark:text-dark-muted">
                    {dateStr} • {timeStr}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-dark-muted">{t('management.price')} {booking.price}zł</div>
                  {!booking.canModify && (
                    <div className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                      {t('management.lessThan24h')}
                    </div>
                  )}
                  {isSelected && booking.canModify ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onChangeBooking(booking)
                        }}
                        className="btn btn-outline text-xs px-3 py-1"
                      >
                        {t('management.change')}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onCancelRequest(booking)
                        }}
                        className="text-xs px-3 py-1 rounded-lg border border-red-400 text-red-600 transition-colors hover:bg-red-50 hover:border-red-500 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10"
                      >
                        {t('management.cancelBtn')}
                      </button>
                    </div>
                  ) : null}
                  {isSelected && !booking.canModify ? (
                    <div className="mt-3 text-xs text-neutral-500 dark:text-dark-muted">
                      {t('management.cannotModifyOnline')}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="space-y-2">
        <button type="button" onClick={onContactMaster} className="btn btn-outline w-full">
          {t('management.contactMasterBtn')}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onBackToSearch} className="btn btn-outline flex-1">
            {t('management.back')}
          </button>
          <button type="button" onClick={onNewSearch} className="btn btn-primary flex-1">
            {t('management.newSearch')}
          </button>
        </div>
      </div>
    </div>
  )
}
