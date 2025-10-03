/**
 * Type definitions for Google Calendar integration
 * 
 * Provides strict typing for Google Calendar events and metadata
 * used in the booking system.
 */

import type { calendar_v3 } from 'googleapis'

// Re-export commonly used Google Calendar types
export type GoogleCalendarEvent = calendar_v3.Schema$Event
export type GoogleCalendarEventList = calendar_v3.Schema$Events
export type GoogleCalendarFreeBusyResponse = calendar_v3.Schema$FreeBusyResponse

// ============================================
// Extended Metadata Types
// ============================================

/**
 * Extended properties stored in Google Calendar events
 * These are custom metadata fields we attach to bookings
 */
export interface BookingMetadata {
  /** Normalized phone number (E.164 format) */
  phone: string
  /** Customer name */
  customerName: string
  /** Customer email (optional) */
  customerEmail?: string
  /** ID of the procedure booked */
  procedureId?: string
  /** Name of the procedure (cached for quick access) */
  procedureName?: string
  /** Duration of the procedure in minutes */
  procedureDurationMin?: number
  /** Price of the procedure in PLN */
  procedurePricePLN?: number
  /** Booking source (web, mobile, admin, etc.) */
  bookingSource?: 'web' | 'mobile' | 'admin' | 'import'
  /** Creation timestamp */
  createdAt?: string
  /** Last modification timestamp */
  modifiedAt?: string
}

/**
 * Helper type for creating events with our metadata
 */
export interface CreateBookingEvent {
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  extendedProperties?: {
    private?: Partial<BookingMetadata>
  }
  colorId?: string
  reminders?: {
    useDefault: boolean
    overrides?: Array<{
      method: 'email' | 'popup'
      minutes: number
    }>
  }
}

/**
 * Parsed booking event with strongly-typed metadata
 */
export interface ParsedBookingEvent {
  id: string
  summary: string
  description?: string
  start: string // ISO 8601
  end: string // ISO 8601
  metadata: Partial<BookingMetadata>
  colorId?: string
  created?: string
  updated?: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
}

// ============================================
// Free/Busy Types
// ============================================

export interface FreeBusySlot {
  start: string // ISO 8601
  end: string // ISO 8601
}

export interface FreeBusyResult {
  busy: FreeBusySlot[]
  errors?: Array<{
    domain: string
    reason: string
  }>
}

// ============================================
// Calendar Query Parameters
// ============================================

export interface CalendarListEventsParams {
  calendarId: string
  timeMin?: string // ISO 8601
  timeMax?: string // ISO 8601
  q?: string // Search query
  singleEvents?: boolean
  orderBy?: 'startTime' | 'updated'
  maxResults?: number
  pageToken?: string
}

export interface CalendarFreeBusyParams {
  timeMin: string // ISO 8601
  timeMax: string // ISO 8601
  timeZone?: string
  items: Array<{ id: string }>
}

// ============================================
// Helper Types
// ============================================

/**
 * Time range for queries
 */
export interface TimeRange {
  start: string // ISO 8601
  end: string // ISO 8601
}

/**
 * Calendar event update payload
 */
export interface UpdateEventPayload {
  summary?: string
  description?: string
  start?: {
    dateTime: string
    timeZone: string
  }
  end?: {
    dateTime: string
    timeZone: string
  }
  extendedProperties?: {
    private?: Partial<BookingMetadata>
  }
  colorId?: string
}
