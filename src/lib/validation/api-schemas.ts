/**
 * Server-side validation schemas using Zod
 * 
 * ⚠️ ВАЖНО: Этот файл импортируется ТОЛЬКО в API routes (серверная сторона).
 * НИКОГДА не импортировать в клиентские компоненты!
 * 
 * Zod добавляет ~40KB в bundle - это приемлемо на сервере, но критично на клиенте.
 */

import { z } from 'zod'

// ============================================
// Booking API Schemas
// ============================================

/**
 * Schema for POST /api/book
 * Creates a new booking
 */
export const bookingApiSchema = z.object({
  startISO: z.string().min(16, 'Invalid start time format'),
  endISO: z.string().min(16, 'Invalid end time format'),
  procedureId: z.string().optional(),
  masterId: z.string().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  phone: z.string().min(5, 'Phone number is too short').max(20, 'Phone number is too long'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  turnstileToken: z.string().optional(),
  consents: z.object({
    dataProcessing: z.boolean(),
    terms: z.boolean(),
    notifications: z.boolean(),
  }).optional(),
})

export type BookingApiInput = z.infer<typeof bookingApiSchema>

/**
 * Schema for POST /api/bookings/search
 * Searches for bookings by phone and name
 */
export const searchApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
})

export type SearchApiInput = z.infer<typeof searchApiSchema>

/**
 * Schema for POST /api/bookings/cancel
 * Cancels an existing booking
 */
export const cancelBookingApiSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
})

export type CancelBookingApiInput = z.infer<typeof cancelBookingApiSchema>

/**
 * Schema for POST /api/bookings/update-time
 * Updates booking time
 */
export const updateTimeApiSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
  newStartISO: z.string().min(16, 'Invalid start time format'),
  newEndISO: z.string().min(16, 'Invalid end time format'),
})

export type UpdateTimeApiInput = z.infer<typeof updateTimeApiSchema>

/**
 * Schema for POST /api/bookings/update-procedure
 * Updates booking procedure
 */
export const updateProcedureApiSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
  newProcedureId: z.string().min(1, 'Procedure ID is required'),
  newStartISO: z.string().min(16, 'Invalid start time format').optional(),
  newEndISO: z.string().min(16, 'Invalid end time format').optional(),
})

export type UpdateProcedureApiInput = z.infer<typeof updateProcedureApiSchema>

/**
 * Schema for POST /api/bookings/[id]/check-extension
 * Checks if procedure can be extended
 */
export const checkExtensionApiSchema = z.object({
  phone: z.string().min(5),
  name: z.string().min(2),
  currentStartISO: z.string().min(16),
  currentEndISO: z.string().min(16),
  newDurationMin: z.number().min(15).max(300),
})

export type CheckExtensionApiInput = z.infer<typeof checkExtensionApiSchema>

// ============================================
// Consent API Schemas (GDPR)
// ============================================

/**
 * Schema for POST /api/consents/check
 * Checks if user has valid consents
 */
export const checkConsentApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
})

export type CheckConsentApiInput = z.infer<typeof checkConsentApiSchema>

/**
 * Schema for POST /api/consents/withdraw
 * Withdraws user consent (GDPR)
 */
export const withdrawConsentApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  turnstileToken: z.string().optional(),
})

export type WithdrawConsentApiInput = z.infer<typeof withdrawConsentApiSchema>

/**
 * Schema for POST /api/consents/erase
 * Erases user data (GDPR)
 */
export const eraseDataApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  turnstileToken: z.string().optional(),
})

export type EraseDataApiInput = z.infer<typeof eraseDataApiSchema>

/**
 * Schema for POST /api/consents/export
 * Exports user data (GDPR)
 */
export const exportDataApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  turnstileToken: z.string().optional(),
})

export type ExportDataApiInput = z.infer<typeof exportDataApiSchema>

// ============================================
// Contact Form Schemas
// ============================================

/**
 * Schema for POST /api/support/contact
 * Support contact form
 */
export const supportContactApiSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  email: z.string().email('Invalid email format'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000, 'Message is too long'),
  turnstileToken: z.string().optional(),
})

export type SupportContactApiInput = z.infer<typeof supportContactApiSchema>

/**
 * Schema for POST /api/master/contact
 * Contact master form
 */
export const masterContactApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
  eventId: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(500, 'Message is too long'),
  turnstileToken: z.string().optional(),
})

export type MasterContactApiInput = z.infer<typeof masterContactApiSchema>
