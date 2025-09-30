export type ManagementState =
  | 'search'
  | 'loading'
  | 'results'
  | 'edit-selection'
  | 'edit-procedure'
  | 'edit-datetime'
  | 'confirm-change'
  | 'confirm-time-change'
  | 'direct-time-change'
  | 'confirm-cancel'
  | 'not-found'
  | 'time-change-success'
  | 'time-change-error'
  | 'cancel-success'
  | 'cancel-error'
  | 'procedure-change-success'
  | 'procedure-change-error'

export interface BookingResult {
  eventId: string
  procedureName: string
  procedureId?: string
  procedureDurationMin: number
  startTime: Date
  endTime: Date
  price: number
  canModify: boolean
  canCancel: boolean
  firstName: string
  lastName: string
  phone: string
  email?: string
}

export interface ProcedureOption {
  id: string
  name_pl: string
  duration_min: number
  price_pln: number
}

// Extension check result types
export type ExtensionCheckStatus = 'can_extend' | 'can_shift_back' | 'no_availability' | 'checking' | null

export interface ExtensionCheckResult {
  status: 'can_extend' | 'can_shift_back' | 'no_availability'
  message: string
  // For shift_back scenario
  suggestedStartISO?: string
  suggestedEndISO?: string
  shiftMinutes?: number
  reason?: string
  alternativeSlots?: Array<{ startISO: string; endISO: string }>
}

export interface SlotSelection {
  startISO: string
  endISO: string
  procedureId?: string
}

// Кеш для изменения времени - простой и чистый
export interface TimeChangeSession {
  originalBooking: BookingResult
  selectedProcedure: ProcedureOption
  newSlot: SlotSelection | null
}

export interface SearchFormData {
  fullName: string
  phone: string
  email: string
}

export interface BookingManagementRef {
  close: () => void
}

export type CalendarMode = 'booking' | 'editing'
