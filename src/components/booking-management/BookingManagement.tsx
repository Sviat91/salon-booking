"use client"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Card from '../ui/Card'
import PanelRenderer from './PanelRenderer'
import { useBookingManagementState } from './state/useBookingManagementState'
import { useTurnstileSession } from './hooks/useTurnstileSession'
import { useBookingMutations } from './hooks/useBookingMutations'
import { useBookingHandlers } from './hooks/useBookingHandlers'
import { fetchProcedures } from './api/bookingManagementApi'
import { useSelectedMasterId } from '@/contexts/MasterContext'
import type { ProceduresResponse } from './api/bookingManagementApi'
import type {
  BookingManagementRef,
  CalendarMode,
  SlotSelection,
  ProcedureOption,
} from './types'

interface BookingManagementProps {
  selectedDate?: Date
  selectedSlot?: SlotSelection | null
  procedureId?: string
  onProcedureChange?: (procedureId: string | undefined) => void
  onDateReset?: () => void
  onCalendarModeChange?: (mode: CalendarMode) => void
  onSlotSelected?: (slot: SlotSelection) => void
  onPanelOpenChange?: (isOpen: boolean) => void
}

const BookingManagement = forwardRef<BookingManagementRef, BookingManagementProps>(
  (
    {
      selectedDate,
      selectedSlot,
      procedureId,
      onProcedureChange,
      onDateReset,
      onCalendarModeChange,
      onSlotSelected,
      onPanelOpenChange,
    },
    ref,
  ) => {
    // Initialize state management and turnstile
    const { state, actions } = useBookingManagementState()
    const masterId = useSelectedMasterId()
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined
    const turnstileSession = useTurnstileSession(siteKey)

    // Fetch procedures
    const { data: proceduresData } = useQuery<ProceduresResponse>({
      queryKey: ['procedures', masterId],
      queryFn: () => fetchProcedures(masterId),
      staleTime: 60 * 60 * 1000, // 1 hour - procedures rarely change
    })
    const procedures = proceduresData?.items ?? []

    // Expose close method via ref
    useImperativeHandle(ref, () => ({
      close: actions.closePanel,
    }))

    // Utility function for procedure derivation
    const deriveProcedureForBooking = useCallback(
      (booking: typeof state.selectedBooking) => {
        if (!booking) return null
        if (booking.procedureId) {
          const byId = procedures.find((p: ProcedureOption) => p.id === booking.procedureId)
          if (byId) return byId
        }
        const byName = procedures.find((p: ProcedureOption) => p.name_pl === booking.procedureName)
        return byName ?? null
      },
      [procedures],
    )

    // Calendar mode synchronization
    useEffect(() => {
      if (state.state === 'edit-datetime' || state.state === 'direct-time-change') {
        actions.setWasEditing(true)
        onCalendarModeChange?.('editing')
        const targetProcedure = state.selectedProcedure ?? deriveProcedureForBooking(state.selectedBooking)
        if (targetProcedure && targetProcedure.id !== procedureId) {
          onProcedureChange?.(targetProcedure.id)
        }
      } else if (state.wasEditing) {
        actions.setWasEditing(false)
        onCalendarModeChange?.('booking')
        onDateReset?.()
        actions.setPendingSlot(null)
      }
    }, [
      state.state,
      state.wasEditing,
      state.selectedBooking,
      state.selectedProcedure,
      onCalendarModeChange,
      deriveProcedureForBooking,
      procedureId,
      onProcedureChange,
      onDateReset,
      actions,
    ])

    // Ensure Turnstile widget is rendered whenever the panel opens
    useEffect(() => {
      if (state.isOpen && siteKey) {
        turnstileSession.ensureWidget()
      }
    }, [state.isOpen, siteKey, turnstileSession.ensureWidget])

    // Form validation
    const canSearch = useMemo(() => {
      const trimmedName = state.form.fullName.trim()
      const phoneDigits = state.form.phone.replace(/\D/g, '')
      const baseValid = trimmedName.length >= 2 && phoneDigits.length >= 9
      
      if (!siteKey) return baseValid
      return baseValid && !!turnstileSession.turnstileToken
    }, [state.form.fullName, state.form.phone, siteKey, turnstileSession.turnstileToken])

    // Initialize mutations hook
    const mutations = useBookingMutations({
      state,
      actions,
      procedures,
      turnstileToken: turnstileSession.turnstileToken,
      onDateReset,
      onCalendarModeChange,
      onProcedureChange,
      masterId,
    })

    // Initialize handlers hook
    const handlers = useBookingHandlers({
      state,
      actions,
      mutations,
      canSearch,
      siteKey,
      turnstileSession,
      deriveProcedureForBooking,
      selectedSlot,
      onSlotSelected,
    })

    // Destructure for convenience
    const {
      searchMutation,
      updateTimeMutation,
      updateMutation,
      updateProcedureMutation,
      cancelMutation,
    } = mutations

    const {
      handleSearch,
      handleSelectBooking,
      handleChangeBooking,
      handleSelectChangeProcedure,
      handleSelectProcedure,
      handleConfirmSameTime,
      handleSelectChangeTime,
      handleRequestNewTime,
      handleCheckAvailability,
      handleSelectAlternativeSlot,
      handleConfirmAlternativeSlot,
      handleConfirmSlot,
      handleConfirmTimeChange,
      handleConfirmTimeChangeBack,
      handleEditSelectionBack,
      handleBackToEditSelection,
      handleBackToResults,
      handleBackToSearch,
      handleStartNewSearch,
      handleRetryTimeChange,
      handleRetryCancel,
      handleConfirmCancel,
      handleContactMaster,
      handleContactMasterSuccess,
      handleContactMasterBack,
      handleContactMasterClose,
      handleExtendSearch,
      handleExtendedSearchSubmit,
      handleExtendedSearchBack,
    } = handlers

    // handleToggle needs onPanelOpenChange callback
    const handleToggle = useCallback(() => {
      handlers.handleToggle(onPanelOpenChange)
    }, [handlers, onPanelOpenChange])

    const fallbackProcedure = deriveProcedureForBooking(state.selectedBooking)

    return (
      <Card>
        <div className="space-y-3">
          {!state.isOpen ? (
            // Закрытое состояние - обычная кнопка
            <>
              <label className="block text-sm text-muted dark:text-dark-muted">Zarządzanie rezerwacją</label>
              <button
                type="button"
                onClick={handleToggle}
                className="btn btn-primary w-full"
              >
                Kliknij, aby zarządzać rezerwacją
              </button>
            </>
          ) : (
            // Открытое состояние - заголовок и кнопка закрытия в одной строке
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted dark:text-dark-muted">Zarządzanie rezerwacją</label>
              <button
                type="button"
                onClick={handleToggle}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                Zamknij panel
              </button>
            </div>
          )}
          <div
            className={`transition-all duration-200 ease-out w-full max-w-full ${
              state.isOpen ? 'opacity-100 mt-2' : 'max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            <div className={`rounded-xl border border-border bg-white/90 p-4 dark:border-dark-border dark:bg-dark-card/90 w-full max-w-full box-border overflow-x-hidden ${state.isOpen ? 'max-h-[35rem] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent' : ''}`}>
              <PanelRenderer
                state={state.state}
                form={state.form}
                onFormChange={(next) => actions.updateForm(next)}
                canSearch={canSearch}
                searchPending={searchMutation.isPending}
                formError={state.formError}
                onSearch={handleSearch}
                turnstileNode={turnstileSession.turnstileRef ? <div ref={turnstileSession.turnstileRef} className="rounded-xl"></div> : undefined}
                turnstileRequired={turnstileSession.turnstileRequired}
                results={state.results}
                selectedBooking={state.selectedBooking}
                onSelectBooking={handleSelectBooking}
                onChangeBooking={handleChangeBooking}
                onCancelRequest={(booking) => {
                  actions.selectBooking(booking)
                  actions.setActionError(null)
                  actions.setState('confirm-cancel')
                }}
                onBackToSearch={handleBackToSearch}
                onStartNewSearch={handleStartNewSearch}
                onContactMaster={handleContactMaster}
                onEditSelectionBack={handleEditSelectionBack}
                onSelectChangeTime={handleSelectChangeTime}
                onChangeProcedure={handleSelectChangeProcedure}
                onEditDatetimeBack={handleBackToEditSelection}
                onExtendSearch={handleExtendSearch}
                onExtendedSearchSubmit={handleExtendedSearchSubmit}
                onExtendedSearchBack={handleExtendedSearchBack}
                onContactMasterSuccess={handleContactMasterSuccess}
                onContactMasterBack={handleContactMasterBack}
                onContactMasterClose={handleContactMasterClose}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                onConfirmSlot={handleConfirmSlot}
                fallbackProcedure={fallbackProcedure}
                pendingSlot={state.pendingSlot}
                timeChangeSession={state.timeChangeSession}
                confirmTimeChangeSubmitting={updateTimeMutation.isPending || updateMutation.isPending}
                confirmTimeChangeError={state.actionError}
                onConfirmTimeChange={handleConfirmTimeChange}
                onConfirmTimeChangeBack={handleConfirmTimeChangeBack}
                cancelSubmitting={cancelMutation.isPending}
                cancelError={state.actionError}
                onConfirmCancel={handleConfirmCancel}
                onCancelBack={() => {
                  actions.setActionError(null)
                  handleBackToResults()
                }}
                onBackToResults={handleBackToResults}
                onRetryTimeChange={handleRetryTimeChange}
                onRetryCancel={handleRetryCancel}
                procedures={procedures}
                selectedProcedure={state.selectedProcedure}
                onSelectProcedure={handleSelectProcedure}
                onConfirmSameTime={handleConfirmSameTime}
                onRequestNewTime={handleRequestNewTime}
                onCheckAvailability={handleCheckAvailability}
                procedureChangeError={state.actionError}
                procedureChangeSubmitting={updateProcedureMutation.isPending || updateMutation.isPending}
                extensionCheckStatus={state.extensionCheckStatus}
                extensionCheckResult={state.extensionCheckResult}
                selectedAlternativeSlot={state.selectedAlternativeSlot}
                onSelectAlternativeSlot={handleSelectAlternativeSlot}
                onConfirmAlternativeSlot={handleConfirmAlternativeSlot}
              />
            </div>
          </div>
        </div>
      </Card>
    )
  },
)

BookingManagement.displayName = 'BookingManagement'
export default BookingManagement
