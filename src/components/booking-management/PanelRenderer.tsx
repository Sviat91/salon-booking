"use client"
import { type ReactNode } from 'react'
import SearchPanel from './SearchPanel'
import LoadingPanel from './LoadingPanel'
import ResultsPanel from './ResultsPanel'
import EditProcedurePanel from './EditProcedurePanel'
import EditDatetimePanel from './EditDatetimePanel'
import ConfirmChangePanel from './ConfirmChangePanel'
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
  onChangeProcedure: (booking: BookingResult) => void
  onCancelRequest: (booking: BookingResult) => void
  selectedProcedure: ProcedureOption | null
  procedures: ProcedureOption[]
  onSelectProcedure: (procedure: ProcedureOption | null) => void
  onBackToSearch: () => void
  onStartNewSearch: () => void
  onContactMaster: () => void
  onEditProcedureBack: () => void
  onEditDatetimeBack: () => void
  onConfirmSameTime: () => void
  onRequestNewTime: () => void
  onExtendSearch: () => void
  onCheckAvailability: () => void
  selectedDate?: Date
  selectedSlot?: SlotSelection | null
  onConfirmSlot: () => void
  fallbackProcedure: ProcedureOption | null
  pendingSlot: SlotSelection | null
  confirmChangeSubmitting: boolean
  confirmChangeError: string | null
  onConfirmChange: () => void
  onConfirmChangeBack: () => void
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
    onChangeProcedure,
    onCancelRequest,
    selectedProcedure,
    procedures,
    onSelectProcedure,
    onBackToSearch,
    onStartNewSearch,
    onContactMaster,
    onEditProcedureBack,
    onEditDatetimeBack,
    onConfirmSameTime,
    onRequestNewTime,
    onExtendSearch,
    onCheckAvailability,
    selectedDate,
    selectedSlot,
    onConfirmSlot,
    fallbackProcedure,
    pendingSlot,
    confirmChangeSubmitting,
    confirmChangeError,
    onConfirmChange,
    onConfirmChangeBack,
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
          canSearch={canSearch}
          isLoading={searchPending}
          errorMessage={formError}
          onSearch={onSearch}
          turnstileNode={turnstileNode}
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
            onChangeProcedure={onChangeProcedure}
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
    case 'edit-procedure':
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
        <EditProcedurePanel
          booking={selectedBooking}
          selectedProcedure={selectedProcedure}
          procedures={procedures}
          onSelectProcedure={onSelectProcedure}
          onBack={onEditProcedureBack}
          onConfirmSameTime={onConfirmSameTime}
          onRequestNewTime={onRequestNewTime}
          onCheckAvailability={onCheckAvailability}
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
          selectedProcedure={selectedProcedure ?? fallbackProcedure}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          onBack={onEditDatetimeBack}
          onConfirm={onConfirmSlot}
        />
      )
    case 'confirm-change':
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
        <ConfirmChangePanel
          booking={selectedBooking}
          newProcedure={selectedProcedure ?? fallbackProcedure}
          newSlot={pendingSlot}
          isSubmitting={confirmChangeSubmitting}
          errorMessage={confirmChangeError}
          onConfirm={onConfirmChange}
          onBack={onConfirmChangeBack}
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
        <SearchPanel
          form={form}
          onFormChange={onFormChange}
          canSearch={canSearch}
          isLoading={searchPending}
          errorMessage={formError}
          onSearch={onSearch}
          turnstileNode={turnstileNode}
          turnstileRequired={turnstileRequired}
        />
      )
  }
}
