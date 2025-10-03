/**
 * Universal API error handler
 * 
 * Provides consistent error handling, logging, and reporting
 * across all API endpoints.
 */

import { z } from 'zod'
import { getLogger } from '../logger'
import { reportError } from '../sentry'
import { ApiError, ErrorResponses, ErrorCodes, errorResponse } from './error-responses'
import type { NextResponse } from 'next/server'

const log = getLogger({ module: 'api.error-handler' })

interface ErrorContext {
  /** Identifier for the error context (e.g., 'api.book', 'api.consents.withdraw') */
  module: string
  /** Client IP address */
  ip?: string
  /** Additional context data to log */
  extras?: Record<string, any>
}

/**
 * Universal API error handler
 * 
 * Handles different error types appropriately:
 * - Zod validation errors → 400 with field details
 * - ApiError instances → use their status and code
 * - Unknown errors → 500 with logging and Sentry reporting
 * 
 * @example
 * ```ts
 * try {
 *   // ... API logic
 * } catch (err) {
 *   return handleApiError(err, {
 *     module: 'api.book',
 *     ip: req.headers.get('x-forwarded-for'),
 *     extras: { bookingId: '123' }
 *   })
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  context: ErrorContext
): NextResponse {
  const { module: moduleName, ip, extras } = context

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {}
    const issuePaths: string[] = []

    error.issues.forEach(issue => {
      const path = issue.path.length ? issue.path.join('.') : '(root)'
      issuePaths.push(path)
      fieldErrors[path] = issue.message
    })

    log.warn(
      { module: moduleName, ip, issuePaths, fieldErrors },
      'Validation error'
    )

    return ErrorResponses.validationError({ fields: fieldErrors })
  }

  // Handle custom ApiError instances
  if (error instanceof ApiError) {
    log.warn(
      { module: moduleName, ip, code: error.code, details: error.details, ...extras },
      `API error: ${error.message}`
    )

    return errorResponse(
      error.code as any,
      error.message,
      error.statusCode,
      error.details
    )
  }

  // Handle unknown errors
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  const errorStack = error instanceof Error ? error.stack : undefined

  log.error(
    { 
      module: moduleName, 
      ip, 
      error: errorMessage,
      stack: errorStack,
      ...extras 
    },
    'Unexpected error in API handler'
  )

  // Report to Sentry (only in production)
  if (process.env.NODE_ENV === 'production') {
    reportError(error as Error, {
      tags: { module: moduleName },
      extras: { ip, ...extras },
    }).catch(sentryErr => {
      log.error({ sentryErr }, 'Failed to report error to Sentry')
    })
  }

  return ErrorResponses.internalError()
}

/**
 * Throws an ApiError with the given parameters
 * Useful for explicit error throwing in business logic
 * 
 * @example
 * ```ts
 * if (!booking) {
 *   throw apiError('BOOKING_NOT_FOUND', 'Booking not found', 404)
 * }
 * ```
 */
export function throwApiError(
  code: keyof typeof ErrorCodes,
  message: string,
  statusCode: number = 500,
  details?: Record<string, any>
): never {
  throw new ApiError(ErrorCodes[code], message, statusCode, details)
}

/**
 * Asserts a condition and throws ApiError if false
 * 
 * @example
 * ```ts
 * assertApi(booking !== null, 'BOOKING_NOT_FOUND', 'Booking not found', 404)
 * ```
 */
export function assertApi(
  condition: boolean,
  code: keyof typeof ErrorCodes,
  message: string,
  statusCode: number = 500,
  details?: Record<string, any>
): asserts condition {
  if (!condition) {
    throwApiError(code, message, statusCode, details)
  }
}
