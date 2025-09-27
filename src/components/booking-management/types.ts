export type ManagementState =
  | 'search'
  | 'loading'
  | 'results'
  | 'not-found'
  | 'edit-procedure'
  | 'edit-datetime'
  | 'confirm-cancel'
  | 'confirm-change'

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
  price_pln?: number
}

export interface SlotSelection {
  startISO: string
  endISO: string
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
