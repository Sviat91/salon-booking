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
  confirmTimeChangeSubmitting: boolean
  confirmTimeChangeError: string | null
  onConfirmTimeChange: () => void
  onConfirmTimeChangeBack: () => void
  cancelSubmitting: boolean
  cancelError: string | null
  onConfirmCancel: () => void
  onCancelBack: () => void
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
    confirmTimeChangeSubmitting,
    confirmTimeChangeError,
    onConfirmTimeChange,
    onConfirmTimeChangeBack,
    cancelSubmitting,
    cancelError,
    onConfirmCancel,
    onCancelBack,
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
          <NoResultsPanel
            onRetry={onBackToSearch}
            onExtendSearch={onExtendSearch}
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
          <NoResultsPanel
            onRetry={onBackToSearch}
            onExtendSearch={onExtendSearch}
            onContactMaster={onContactMaster}
          />
        )
      }
      return (
        <EditDatetimePanel
          booking={selectedBooking}
          selectedProcedure={fallbackProcedure}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          onBack={onEditDatetimeBack}
          onConfirm={onConfirmSlot}
        />
      )
    case 'confirm-time-change':
      if (!selectedBooking || !pendingSlot) {
        return (
          <NoResultsPanel
            onRetry={onBackToSearch}
            onExtendSearch={onExtendSearch}
            onContactMaster={onContactMaster}
          />
        )
      }
      return (
        <ConfirmTimeChangePanel
          booking={selectedBooking}
          newSlot={pendingSlot}
          isSubmitting={confirmTimeChangeSubmitting}
          errorMessage={confirmTimeChangeError}
          onConfirm={onConfirmTimeChange}
          onBack={onConfirmTimeChangeBack}
        />
      )
    case 'confirm-cancel':
      if (!selectedBooking) {
        return (
          <NoResultsPanel
            onRetry={onBackToSearch}
            onExtendSearch={onExtendSearch}
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
    default:
      return (
        <NoResultsPanel
          onRetry={onBackToSearch}
          onExtendSearch={onExtendSearch}
          onContactMaster={onContactMaster}
        />
      )
  }
}
