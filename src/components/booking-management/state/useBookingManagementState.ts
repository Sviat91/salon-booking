import { useReducer, useCallback } from 'react'
import type {
  BookingResult,
  ManagementState,
  ProcedureOption,
  SearchFormData,
  SlotSelection,
  TimeChangeSession,
  ExtensionCheckResult,
  ExtensionCheckStatus,
} from '../types'

// State interface
export interface BookingManagementState {
  // UI State
  isOpen: boolean
  state: ManagementState
  wasEditing: boolean
  
  // Form Data
  form: SearchFormData
  formError: string | null
  
  // Search Results
  results: BookingResult[]
  
  // Selected Items
  selectedBooking: BookingResult | null
  selectedProcedure: ProcedureOption | null
  pendingSlot: SlotSelection | null
  
  // Time Change Session - простой кеш для изменения времени
  timeChangeSession: TimeChangeSession | null
  
  // Extension Check - результат проверки доступности для длинных процедур
  extensionCheckStatus: ExtensionCheckStatus
  extensionCheckResult: ExtensionCheckResult | null
  selectedAlternativeSlot: SlotSelection | null
  
  // Action State
  actionError: string | null
  
  // Turnstile
  turnstileToken: string | null
}

// Action types
export type BookingManagementAction =
  | { type: 'TOGGLE_PANEL' }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SET_STATE'; payload: ManagementState }
  | { type: 'SET_WAS_EDITING'; payload: boolean }
  | { type: 'UPDATE_FORM'; payload: Partial<SearchFormData> }
  | { type: 'SET_FORM_ERROR'; payload: string | null }
  | { type: 'SELECT_BOOKING'; payload: BookingResult | null }
  | { type: 'SELECT_PROCEDURE'; payload: ProcedureOption | null }
  | { type: 'SET_PENDING_SLOT'; payload: SlotSelection | null }
  | { type: 'SET_ACTION_ERROR'; payload: string | null }
  | { type: 'SET_RESULTS'; payload: BookingResult[] }
  | { type: 'RESET_FORM' }
  | { type: 'SET_TURNSTILE_TOKEN'; payload: string | null }
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_SUCCESS'; payload: BookingResult[] }
  | { type: 'SEARCH_ERROR'; payload: string }
  | { type: 'SEARCH_NOT_FOUND' }
  | { type: 'START_TIME_CHANGE'; payload: TimeChangeSession }
  | { type: 'SET_TIME_CHANGE_SLOT'; payload: SlotSelection }
  | { type: 'CLEAR_TIME_CHANGE' }
  | { type: 'SET_EXTENSION_CHECK_STATUS'; payload: ExtensionCheckStatus }
  | { type: 'SET_EXTENSION_CHECK_RESULT'; payload: ExtensionCheckResult | null }
  | { type: 'SELECT_ALTERNATIVE_SLOT'; payload: SlotSelection | null }
  | { type: 'CLEAR_EXTENSION_CHECK' }
  | { type: 'UPDATE_BOOKING_TIME'; payload: { startTime: Date; endTime: Date } }

// Initial state
const initialState: BookingManagementState = {
  isOpen: false,
  state: 'search',
  wasEditing: false,
  form: { fullName: '', phone: '', email: '' },
  formError: null,
  results: [],
  selectedBooking: null,
  selectedProcedure: null,
  pendingSlot: null,
  timeChangeSession: null,
  extensionCheckStatus: null,
  extensionCheckResult: null,
  selectedAlternativeSlot: null,
  actionError: null,
  turnstileToken: null,
}

// Reducer
function bookingManagementReducer(
  state: BookingManagementState,
  action: BookingManagementAction,
): BookingManagementState {
  switch (action.type) {
    case 'TOGGLE_PANEL':
      if (state.isOpen) {
        // Closing panel - reset everything
        return {
          ...initialState,
          isOpen: false,
        }
      } else {
        // Opening panel
        return {
          ...state,
          isOpen: true,
        }
      }

    case 'CLOSE_PANEL':
      return {
        ...initialState,
        isOpen: false,
      }

    case 'SET_STATE':
      return {
        ...state,
        state: action.payload,
      }

    case 'SET_WAS_EDITING':
      return {
        ...state,
        wasEditing: action.payload,
      }

    case 'UPDATE_FORM':
      return {
        ...state,
        form: { ...state.form, ...action.payload },
      }

    case 'SET_FORM_ERROR':
      return {
        ...state,
        formError: action.payload,
      }

    case 'SET_RESULTS':
      return {
        ...state,
        results: action.payload,
      }

    case 'SELECT_BOOKING':
      return {
        ...state,
        selectedBooking: action.payload,
        selectedProcedure: null,
        pendingSlot: null,
        actionError: null,
      }

    case 'SELECT_PROCEDURE':
      // Сбрасываем результаты проверки доступности при смене процедуры
      // Это важно! Иначе при повторном выборе другой процедуры
      // будет показываться старый результат для предыдущей процедуры
      return {
        ...state,
        selectedProcedure: action.payload,
        actionError: null,
        extensionCheckStatus: null,
        extensionCheckResult: null,
        selectedAlternativeSlot: null,
      }

    case 'SET_PENDING_SLOT':
      return {
        ...state,
        pendingSlot: action.payload,
      }

    case 'SET_ACTION_ERROR':
      return {
        ...state,
        actionError: action.payload,
      }

    case 'SET_TURNSTILE_TOKEN':
      return {
        ...state,
        turnstileToken: action.payload,
      }

    case 'RESET_FORM':
      return {
        ...state,
        form: { fullName: '', phone: '', email: '' },
        formError: null,
        results: [],
        selectedBooking: null,
        selectedProcedure: null,
        pendingSlot: null,
        actionError: null,
      }

    case 'SEARCH_START':
      return {
        ...state,
        formError: null,
        state: 'loading',
        selectedBooking: null,
        selectedProcedure: null,
        actionError: null,
      }

    case 'SEARCH_SUCCESS':
      const results = action.payload
      return {
        ...state,
        results,
        state: results.length === 0 ? 'not-found' : 'results',
        isOpen: true,
      }

    case 'SEARCH_ERROR':
      return {
        ...state,
        formError: action.payload,
        state: 'search',
        // DO NOT reset form on error - keep user's input
      }

    case 'SEARCH_NOT_FOUND':
      return {
        ...state,
        results: [],
        state: 'not-found',
        isOpen: true,
      }

    case 'START_TIME_CHANGE':
      return {
        ...state,
        timeChangeSession: action.payload,
        state: 'edit-datetime',
        actionError: null,
      }

    case 'SET_TIME_CHANGE_SLOT':
      return {
        ...state,
        timeChangeSession: state.timeChangeSession ? {
          ...state.timeChangeSession,
          newSlot: action.payload,
        } : null,
        state: 'confirm-time-change',
      }
      
    case 'CLEAR_TIME_CHANGE':
      return {
        ...state,
        timeChangeSession: null,
        pendingSlot: null,
      }

    case 'SET_EXTENSION_CHECK_STATUS':
      return {
        ...state,
        extensionCheckStatus: action.payload,
      }

    case 'SET_EXTENSION_CHECK_RESULT':
      return {
        ...state,
        extensionCheckResult: action.payload,
        extensionCheckStatus: action.payload ? action.payload.status : null,
      }

    case 'SELECT_ALTERNATIVE_SLOT':
      return {
        ...state,
        selectedAlternativeSlot: action.payload,
      }

    case 'CLEAR_EXTENSION_CHECK':
      return {
        ...state,
        extensionCheckStatus: null,
        extensionCheckResult: null,
        selectedAlternativeSlot: null,
      }

    case 'UPDATE_BOOKING_TIME':
      if (!state.selectedBooking) return state
      return {
        ...state,
        selectedBooking: {
          ...state.selectedBooking,
          startTime: action.payload.startTime,
          endTime: action.payload.endTime,
        },
      }

    default:
      return state
  }
}

// Action creators
export interface BookingManagementActions {
  togglePanel: () => void
  closePanel: () => void
  setState: (state: ManagementState) => void
  setWasEditing: (wasEditing: boolean) => void
  updateForm: (updates: Partial<SearchFormData>) => void
  setFormError: (error: string | null) => void
  setResults: (results: BookingResult[]) => void
  selectBooking: (booking: BookingResult | null) => void
  selectProcedure: (procedure: ProcedureOption | null) => void
  setPendingSlot: (slot: SlotSelection | null) => void
  setActionError: (error: string | null) => void
  setTurnstileToken: (token: string | null) => void
  resetForm: () => void
  startSearch: () => void
  handleSearchSuccess: (results: BookingResult[]) => void
  handleSearchError: (error: string) => void
  handleSearchNotFound: () => void
  startTimeChange: (session: TimeChangeSession) => void
  setTimeChangeSlot: (slot: SlotSelection) => void
  clearTimeChange: () => void
  setExtensionCheckStatus: (status: ExtensionCheckStatus) => void
  setExtensionCheckResult: (result: ExtensionCheckResult | null) => void
  selectAlternativeSlot: (slot: SlotSelection | null) => void
  clearExtensionCheck: () => void
  updateBookingTime: (time: { startTime: Date; endTime: Date }) => void
}

// Main hook
export function useBookingManagementState() {
  const [state, dispatch] = useReducer(bookingManagementReducer, initialState)

  // Action creators
  const actions: BookingManagementActions = {
    togglePanel: useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), []),
    closePanel: useCallback(() => dispatch({ type: 'CLOSE_PANEL' }), []),
    setState: useCallback((state: ManagementState) => dispatch({ type: 'SET_STATE', payload: state }), []),
    setWasEditing: useCallback((wasEditing: boolean) => dispatch({ type: 'SET_WAS_EDITING', payload: wasEditing }), []),
    updateForm: useCallback((updates: Partial<SearchFormData>) => dispatch({ type: 'UPDATE_FORM', payload: updates }), []),
    setFormError: useCallback((error: string | null) => dispatch({ type: 'SET_FORM_ERROR', payload: error }), []),
    setResults: useCallback((results: BookingResult[]) => dispatch({ type: 'SET_RESULTS', payload: results }), []),
    selectBooking: useCallback((booking: BookingResult | null) => dispatch({ type: 'SELECT_BOOKING', payload: booking }), []),
    selectProcedure: useCallback((procedure: ProcedureOption | null) => dispatch({ type: 'SELECT_PROCEDURE', payload: procedure }), []),
    setPendingSlot: useCallback((slot: SlotSelection | null) => dispatch({ type: 'SET_PENDING_SLOT', payload: slot }), []),
    setActionError: useCallback((error: string | null) => dispatch({ type: 'SET_ACTION_ERROR', payload: error }), []),
    setTurnstileToken: useCallback((token: string | null) => dispatch({ type: 'SET_TURNSTILE_TOKEN', payload: token }), []),
    resetForm: useCallback(() => dispatch({ type: 'RESET_FORM' }), []),
    startSearch: useCallback(() => dispatch({ type: 'SEARCH_START' }), []),
    handleSearchSuccess: useCallback((results: BookingResult[]) => dispatch({ type: 'SEARCH_SUCCESS', payload: results }), []),
    handleSearchError: useCallback((error: string) => dispatch({ type: 'SEARCH_ERROR', payload: error }), []),
    handleSearchNotFound: useCallback(() => dispatch({ type: 'SEARCH_NOT_FOUND' }), []),
    startTimeChange: useCallback((session: TimeChangeSession) => dispatch({ type: 'START_TIME_CHANGE', payload: session }), []),
    setTimeChangeSlot: useCallback((slot: SlotSelection) => dispatch({ type: 'SET_TIME_CHANGE_SLOT', payload: slot }), []),
    clearTimeChange: useCallback(() => dispatch({ type: 'CLEAR_TIME_CHANGE' }), []),
    setExtensionCheckStatus: useCallback((status: ExtensionCheckStatus) => dispatch({ type: 'SET_EXTENSION_CHECK_STATUS', payload: status }), []),
    setExtensionCheckResult: useCallback((result: ExtensionCheckResult | null) => dispatch({ type: 'SET_EXTENSION_CHECK_RESULT', payload: result }), []),
    selectAlternativeSlot: useCallback((slot: SlotSelection | null) => dispatch({ type: 'SELECT_ALTERNATIVE_SLOT', payload: slot }), []),
    clearExtensionCheck: useCallback(() => dispatch({ type: 'CLEAR_EXTENSION_CHECK' }), []),
    updateBookingTime: useCallback((time: { startTime: Date; endTime: Date }) => dispatch({ type: 'UPDATE_BOOKING_TIME', payload: time }), []),
  }

  return {
    state,
    actions,
  }
}
