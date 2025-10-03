/**
 * Client-side validation utilities
 * 
 * Pure TypeScript validators without external dependencies.
 * Designed to be lightweight (<1KB) and provide instant feedback in forms.
 * Server-side validation with Zod remains the source of truth.
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates phone number format
 * Accepts Polish (+48) and Ukrainian (+380) formats
 * @example validatePhone("+48123456789") // { valid: true }
 * @example validatePhone("123") // { valid: false, error: "..." }
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || phone.trim().length === 0) {
    return { valid: false, error: 'Numer telefonu jest wymagany' }
  }

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '')

  // Check minimum length (at least 9 digits)
  if (digitsOnly.length < 9) {
    return { valid: false, error: 'Numer telefonu jest za krótki (minimum 9 cyfr)' }
  }

  // Check maximum length (max 15 digits including country code)
  if (digitsOnly.length > 15) {
    return { valid: false, error: 'Numer telefonu jest za długi' }
  }

  // Polish format: +48 followed by 9 digits
  if (phone.startsWith('+48') && digitsOnly.length !== 11) {
    return { valid: false, error: 'Polski numer powinien mieć 9 cyfr po +48' }
  }

  // Ukrainian format: +380 followed by 9 digits
  if (phone.startsWith('+380') && digitsOnly.length !== 12) {
    return { valid: false, error: 'Ukraiński numer powinien mieć 9 cyfr po +380' }
  }

  return { valid: true }
}

/**
 * Validates email format
 * Uses basic RFC 5322 compatible regex
 * @example validateEmail("user@example.com") // { valid: true }
 * @example validateEmail("invalid") // { valid: false, error: "..." }
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    // Email is optional in most forms
    return { valid: true }
  }

  // Basic email regex - covers 99% of real-world cases
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Nieprawidłowy format email' }
  }

  if (email.length > 254) {
    return { valid: false, error: 'Email jest za długi' }
  }

  return { valid: true }
}

/**
 * Validates name format
 * Requires at least 2 characters
 * @example validateName("Jan Kowalski") // { valid: true }
 * @example validateName("A") // { valid: false, error: "..." }
 */
export function validateName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Imię i nazwisko są wymagane' }
  }

  const trimmed = name.trim()

  if (trimmed.length < 2) {
    return { valid: false, error: 'Imię i nazwisko muszą mieć minimum 2 znaki' }
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Imię i nazwisko są za długie (maksymalnie 100 znaków)' }
  }

  return { valid: true }
}

/**
 * Validates required field
 * Generic validator for any required text input
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} jest wymagane` }
  }

  return { valid: true }
}

/**
 * Validates Turnstile token
 * Checks if token is present (actual verification happens server-side)
 */
export function validateTurnstileToken(token: string | null): ValidationResult {
  if (!token || token.trim().length === 0) {
    return { valid: false, error: 'Weryfikacja Turnstile nie powiodła się. Odśwież stronę i spróbuj ponownie.' }
  }

  return { valid: true }
}

/**
 * Validates booking form data
 * Convenience function that validates all required fields at once
 */
export interface BookingFormData {
  name: string
  phone: string
  email?: string
  turnstileToken: string | null
}

export function validateBookingForm(data: BookingFormData): {
  valid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}

  const nameResult = validateName(data.name)
  if (!nameResult.valid) errors.name = nameResult.error!

  const phoneResult = validatePhone(data.phone)
  if (!phoneResult.valid) errors.phone = phoneResult.error!

  if (data.email) {
    const emailResult = validateEmail(data.email)
    if (!emailResult.valid) errors.email = emailResult.error!
  }

  const tokenResult = validateTurnstileToken(data.turnstileToken)
  if (!tokenResult.valid) errors.turnstile = tokenResult.error!

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validates search form data (for booking search)
 */
export interface SearchFormData {
  phone: string
  name: string
}

export function validateSearchForm(data: SearchFormData): {
  valid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}

  const nameResult = validateName(data.name)
  if (!nameResult.valid) errors.name = nameResult.error!

  const phoneResult = validatePhone(data.phone)
  if (!phoneResult.valid) errors.phone = phoneResult.error!

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
