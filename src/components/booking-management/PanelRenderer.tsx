"use client"
import { type ReactNode } from 'react'
import SearchPanel from './SearchPanel'
import LoadingPanel from './LoadingPanel'
import ResultsPanel from './ResultsPanel'
import EditSelectionPanel from './EditSelectionPanel'
import EditDatetimePanel from './EditDatetimePanel'
import ConfirmTimeChangePanel from './ConfirmTimeChangePanel'
import ConfirmCancelPanel from './ConfirmCancelPanel'
import NoResultsPanel from './NoResultsPanel'
import ErrorFallbackPanel from './ErrorFallbackPanel'
import DirectTimeChangePanel from './DirectTimeChangePanel'
import TimeChangeSuccessPanel from './TimeChangeSuccessPanel'
import TimeChangeErrorPanel from './TimeChangeErrorPanel'
import type {
  BookingResult,
  ManagementState,
  ProcedureOption,
  SearchFormData,
  SlotSelection,
} from './types'

interface PanelRendererProps {
  state: ManagementState
  form: SearchFormData
  onFormChange: (next: Partial<SearchFormData>) => void
  canSearch: boolean
  searchPending: boolean
  formError: string | null
  onSearch: () => void
  turnstileNode?: ReactNode
  turnstileRequired?: boolean
  results: BookingResult[]
  selectedBooking: BookingResult | null
  onSelectBooking: (booking: BookingResult | null) => void
  onChangeBooking: (booking: BookingResult) => void
  onCancelRequest: (booking: BookingResult) => void
  onBackToSearch: () => void
  onStartNewSearch: () => void
  onContactMaster: () => void
  onEditSelectionBack: () => void
  onSelectChangeTime: () => void
  onEditDatetimeBack: () => void
  onExtendSearch: () => void
  selectedDate?: Date
  selectedSlot?: SlotSelection | null
  onConfirmSlot: () => void
  fallbackProcedure: ProcedureOption | null
  pendingSlot: SlotSelection | null
  timeChangeSession: { originalBooking: BookingResult; selectedProcedure: ProcedureOption; newSlot: SlotSelection | null } | null
  confirmTimeChangeSubmitting: boolean
  confirmTimeChangeError: string | null
  onConfirmTimeChange: () => void
  onConfirmTimeChangeBack: () => void
  cancelSubmitting: boolean
  cancelError: string | null
  onConfirmCancel: () => void
  onCancelBack: () => void
  onBackToResults: () => void
  onRetryTimeChange: () => void
}

export default function PanelRenderer(props: PanelRendererProps) {
  const {
    state,
    form,
    onFormChange,
    canSearch,
    searchPending,
    formError,
    onSearch,
    turnstileNode,
    turnstileRequired,
    results,
    selectedBooking,
    onSelectBooking,
    onChangeBooking,
    onCancelRequest,
    onBackToSearch,
    onStartNewSearch,
    onContactMaster,
    onEditSelectionBack,
    onSelectChangeTime,
    onEditDatetimeBack,
    onExtendSearch,
    selectedDate,
    selectedSlot,
    onConfirmSlot,
    fallbackProcedure,
    pendingSlot,
    timeChangeSession,
    confirmTimeChangeSubmitting,
    confirmTimeChangeError,
    onConfirmTimeChange,
    onConfirmTimeChangeBack,
    cancelSubmitting,
    cancelError,
    onConfirmCancel,
    onCancelBack,
    onBackToResults,
    onRetryTimeChange,
  } = props

  switch (state) {
    case 'search':
      return (
        <SearchPanel
          form={form}
          onFormChange={onFormChange}
          onSearch={onSearch}
          canSearch={canSearch}
          isLoading={searchPending}
          errorMessage={formError}
          turnstileNode={turnstileNode}
          turnstileRequired={turnstileRequired}
        />
      )
    case 'loading':
      return <LoadingPanel />
    case 'results':
      return (
        <ResultsPanel
          results={results}
          selectedBookingId={selectedBooking?.eventId}
          searchCriteria={form}
          onSelect={onSelectBooking}
          onChangeBooking={onChangeBooking}
          onCancelRequest={onCancelRequest}
          onContactMaster={onContactMaster}
          onBackToSearch={onBackToSearch}
          onNewSearch={onStartNewSearch}
        />
      )
    case 'not-found':
      return (
        <NoResultsPanel
          onRetry={onBackToSearch}
          onExtendSearch={onExtendSearch}
          onContactMaster={onContactMaster}
        />
      )
    case 'edit-selection':
      if (!selectedBooking) {
        return (
          <ErrorFallbackPanel
            onRetry={onBackToSearch}
            onContactMaster={onContactMaster}
          />
        )
      }
      return (
        <EditSelectionPanel
          booking={selectedBooking}
          onChangeTime={onSelectChangeTime}
          onBack={onEditSelectionBack}
        />
      )
    case 'edit-datetime':
      if (!selectedBooking) {
        return (
          <ErrorFallbackPanel
            onRetry={onBackToSearch}
            onContactMaster={onContactMaster}
          />
        )
      }
      return (
        <EditDatetimePanel
          booking={selectedBooking}
          selectedProcedure={timeChangeSession?.selectedProcedure || fallbackProcedure}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          onBack={onEditDatetimeBack}
          onConfirm={onConfirmSlot}
        />
      )
    case 'confirm-time-change':
      // Используем timeChangeSession из state для получения данных
      if (!timeChangeSession?.newSlot) {
        return (
          <ErrorFallbackPanel
            onRetry={onBackToSearch}
            onContactMaster={onContactMaster}
          />
        )
      }
      return (
        <ConfirmTimeChangePanel
          booking={timeChangeSession.originalBooking}
          newSlot={timeChangeSession.newSlot}
          isSubmitting={confirmTimeChangeSubmitting}
          errorMessage={confirmTimeChangeError}
          onConfirm={onConfirmTimeChange}
          onBack={onConfirmTimeChangeBack}
        />
      )
    case 'direct-time-change':
      if (!timeChangeSession) {
        return (
          <ErrorFallbackPanel
            onRetry={onBackToSearch}
            onContactMaster={onContactMaster}
          />
        )
      }
      return (
        <DirectTimeChangePanel
          booking={timeChangeSession.originalBooking}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          newSlot={timeChangeSession.newSlot}
          isSubmitting={confirmTimeChangeSubmitting}
          errorMessage={confirmTimeChangeError}
          onConfirm={onConfirmTimeChange}
          onBack={onConfirmTimeChangeBack}
          canConfirm={!!(selectedSlot || timeChangeSession.newSlot)}
          turnstileNode={turnstileNode}
          turnstileRequired={turnstileRequired}
        />
      )
    case 'confirm-cancel':
      if (!selectedBooking) {
        return (
          <ErrorFallbackPanel
            onRetry={onBackToSearch}
            onContactMaster={onContactMaster}
          />
        )
      }
      return (
        <ConfirmCancelPanel
          booking={selectedBooking}
          isSubmitting={cancelSubmitting}
          errorMessage={cancelError}
          onConfirm={onConfirmCancel}
          onBack={onCancelBack}
        />
      )
    case 'time-change-success':
      if (!timeChangeSession?.newSlot) {
        return (
          <ErrorFallbackPanel
            onRetry={onBackToSearch}
            onContactMaster={onContactMaster}
          />
        )
      }
      return (
        <TimeChangeSuccessPanel
          timeChangeSession={{
            originalBooking: timeChangeSession.originalBooking,
            newSlot: timeChangeSession.newSlot,
          }}
          onBackToResults={onBackToResults}
        />
      )
    case 'time-change-error':
      return (
        <TimeChangeErrorPanel
          timeChangeSession={timeChangeSession?.newSlot ? {
            originalBooking: timeChangeSession.originalBooking,
            newSlot: timeChangeSession.newSlot,
          } : null}
          errorMessage={confirmTimeChangeError}
          onBackToResults={onBackToResults}
          onTryAgain={onRetryTimeChange}
        />
      )
    default:
      return null
  }
}
