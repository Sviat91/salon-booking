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
