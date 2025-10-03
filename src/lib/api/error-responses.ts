/**
 * Standardized API error responses
 * 
 * Provides consistent error codes, messages, and HTTP status codes
 * across all API endpoints.
 */

import { NextResponse } from 'next/server'

/**
 * Custom API Error class for typed errors
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Standard error codes used across the application
 */
export const ErrorCodes = {
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Authentication/Authorization errors (401, 403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TURNSTILE_FAILED: 'TURNSTILE_FAILED',
  
  // Resource errors (404)
  NOT_FOUND: 'NOT_FOUND',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  PROCEDURE_NOT_FOUND: 'PROCEDURE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  SLOT_ALREADY_BOOKED: 'SLOT_ALREADY_BOOKED',
  DUPLICATE_BOOKING: 'DUPLICATE_BOOKING',
  
  // Business logic errors (422)
  UNPROCESSABLE: 'UNPROCESSABLE',
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  MODIFICATION_DEADLINE_PASSED: 'MODIFICATION_DEADLINE_PASSED',
  INVALID_TIME_RANGE: 'INVALID_TIME_RANGE',
  
  // Rate limiting (429)
  RATE_LIMITED: 'RATE_LIMITED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CALENDAR_ERROR: 'CALENDAR_ERROR',
  SHEETS_ERROR: 'SHEETS_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  EMAIL_ERROR: 'EMAIL_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * Creates a standardized error response
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  details?: Record<string, any>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      ...(details && { details }),
    },
    { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store',
      }
    }
  )
}

/**
 * Pre-defined error responses for common scenarios
 */
export const ErrorResponses = {
  // Validation errors
  validationError: (details?: Record<string, any>) =>
    errorResponse(
      ErrorCodes.VALIDATION_ERROR,
      'Validation failed',
      400,
      details
    ),

  invalidInput: (field: string) =>
    errorResponse(
      ErrorCodes.INVALID_INPUT,
      `Invalid input: ${field}`,
      400
    ),

  missingField: (field: string) =>
    errorResponse(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      `Missing required field: ${field}`,
      400
    ),

  // Authentication/Authorization
  unauthorized: (message: string = 'Unauthorized') =>
    errorResponse(ErrorCodes.UNAUTHORIZED, message, 401),

  accessDenied: (message: string = 'Access denied') =>
    errorResponse(ErrorCodes.ACCESS_DENIED, message, 403),

  turnstileFailed: () =>
    errorResponse(
      ErrorCodes.TURNSTILE_FAILED,
      'Security verification failed. Please refresh and try again.',
      403
    ),

  // Resource not found
  notFound: (resource: string = 'Resource') =>
    errorResponse(
      ErrorCodes.NOT_FOUND,
      `${resource} not found`,
      404
    ),

  bookingNotFound: () =>
    errorResponse(
      ErrorCodes.BOOKING_NOT_FOUND,
      'Booking not found or access denied',
      404
    ),

  // Conflicts
  slotAlreadyBooked: () =>
    errorResponse(
      ErrorCodes.SLOT_ALREADY_BOOKED,
      'This time slot is already booked',
      409
    ),

  duplicateBooking: () =>
    errorResponse(
      ErrorCodes.DUPLICATE_BOOKING,
      'You already have a booking at this time',
      409
    ),

  // Business logic errors
  slotUnavailable: (message?: string) =>
    errorResponse(
      ErrorCodes.SLOT_UNAVAILABLE,
      message || 'This time slot is not available',
      422
    ),

  modificationDeadline: () =>
    errorResponse(
      ErrorCodes.MODIFICATION_DEADLINE_PASSED,
      'Cannot modify booking less than 24 hours before appointment',
      422
    ),

  invalidTimeRange: () =>
    errorResponse(
      ErrorCodes.INVALID_TIME_RANGE,
      'Invalid time range',
      422
    ),

  // Rate limiting
  rateLimited: (window: string = '1m') =>
    errorResponse(
      ErrorCodes.RATE_LIMITED,
      `Too many requests. Please try again later. (${window})`,
      429
    ),

  // Server errors
  internalError: (message: string = 'Internal server error') =>
    errorResponse(ErrorCodes.INTERNAL_ERROR, message, 500),

  calendarError: () =>
    errorResponse(
      ErrorCodes.CALENDAR_ERROR,
      'Calendar service error. Please try again.',
      500
    ),

  sheetsError: () =>
    errorResponse(
      ErrorCodes.SHEETS_ERROR,
      'Data service error. Please try again.',
      500
    ),
}
