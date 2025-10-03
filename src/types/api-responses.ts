/**
 * Type definitions for API responses
 * 
 * Provides strict typing for all API endpoints to ensure
 * type safety between client and server.
 */

// ============================================
// Booking API Responses
// ============================================

export interface BookingResponse {
  success: boolean
  eventId: string
  summary?: string
  start?: string
  end?: string
}

export interface SearchResponse {
  results: BookingResult[]
}

export interface BookingResult {
  id: string
  summary: string
  start: string
  end: string
  procedureId?: string
  procedureName?: string
  procedureDurationMin?: number
  procedurePricePLN?: number
  canModify: boolean
  canCancel: boolean
}

export interface CancelBookingResponse {
  success: boolean
  message: string
}

export interface UpdateTimeResponse {
  success: boolean
  eventId: string
  newStart: string
  newEnd: string
}

export interface UpdateProcedureResponse {
  success: boolean
  eventId: string
  newProcedureId: string
  newStart?: string
  newEnd?: string
}

export interface CheckExtensionResponse {
  status: 'can_extend' | 'can_shift_back' | 'no_availability'
  suggestedStartISO?: string
  suggestedEndISO?: string
  alternativeSlots?: Array<{
    startISO: string
    endISO: string
  }>
}

export interface BookingAvailabilityResponse {
  available: boolean
  conflictingEvents?: Array<{
    id: string
    start: string
    end: string
  }>
}

// ============================================
// Procedures API Responses
// ============================================

export interface ProceduresResponse {
  items: ProcedureItem[]
}

export interface ProcedureItem {
  id: string
  name_pl: string
  name_ua?: string
  name_en?: string
  description_pl?: string
  description_ua?: string
  description_en?: string
  duration_min: number
  price_pln: number
  active: boolean
  order?: number
}

// ============================================
// Availability API Responses
// ============================================

export interface AvailabilityResponse {
  date: string
  slots: TimeSlot[]
  dayOff?: boolean
  reason?: string
}

export interface TimeSlot {
  startISO: string
  endISO: string
  available: boolean
}

// ============================================
// Consent API Responses (GDPR)
// ============================================

export interface CheckConsentResponse {
  skipConsentModal: boolean
  hasValidConsent: boolean
  consentDate?: string
}

export interface WithdrawConsentResponse {
  success: boolean
  message: string
  withdrawnDate: string
}

export interface EraseDataResponse {
  success: boolean
  message: string
  erasedRecordsCount: number
  anonymizedRecordsCount: number
}

export interface ExportDataResponse {
  success: boolean
  data: {
    personalData: {
      name: string
      phone: string
      email?: string
    }
    consentHistory: Array<{
      consentDate: string
      ipHash: string
      privacyV10: boolean
      termsV10: boolean
      notificationsV10: boolean
      withdrawnDate?: string
      withdrawalMethod?: string
    }>
    bookings?: Array<{
      date: string
      procedureName: string
      status: string
    }>
    isAnonymized: boolean
    exportTimestamp: string
  }
}

// ============================================
// Contact API Responses
// ============================================

export interface ContactResponse {
  success: boolean
  message: string
}

export interface SupportContactResponse extends ContactResponse {
  ticketId?: string
}

// ============================================
// Error Response
// ============================================

export interface ErrorResponse {
  error: string
  code: string
  details?: Record<string, any>
}

// ============================================
// Generic API Response Wrapper
// ============================================

export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: ErrorResponse }
