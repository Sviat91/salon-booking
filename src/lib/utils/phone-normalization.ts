/**
 * Phone number normalization utilities
 * Centralized logic for phone number processing across the application
 */

/**
 * Remove all non-digit characters from phone number
 * Used for: matching, comparison, database lookups
 * 
 * @example
 * normalizePhoneDigitsOnly('+48 123-456-789') // '48123456789'
 * normalizePhoneDigitsOnly('(123) 456 789')   // '123456789'
 */
export function normalizePhoneDigitsOnly(phone: string | null | undefined): string {
  if (!phone) return ''
  return String(phone).replace(/\D/g, '')
}

/**
 * Normalize phone number to E.164 format with validation
 * Handles Polish phone numbers specifically (adds +48 prefix if missing)
 * 
 * Throws Error('INVALID_PHONE') if phone doesn't match E.164 format
 * 
 * @example
 * normalizePhoneToE164('123456789')      // '+48123456789'
 * normalizePhoneToE164('0123456789')     // '+48123456789'
 * normalizePhoneToE164('00380501234567') // '+380501234567'
 * normalizePhoneToE164('+48123456789')   // '+48123456789'
 * 
 * @throws {Error} INVALID_PHONE if format is invalid
 */
export function normalizePhoneToE164(input: string): string {
  const raw = input.trim()
  if (!raw) return raw
  
  // Remove spaces and leading dashes
  let cleaned = raw.replace(/\s+/g, '').replace(/^-+/, '')
  
  // Convert 00 prefix to +
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`
  }
  
  // Add +48 (Poland) if no country code
  if (!cleaned.startsWith('+')) {
    cleaned = cleaned.startsWith('0') ? `+48${cleaned.slice(1)}` : `+48${cleaned}`
  }
  
  // Remove all non-digit characters except leading +
  const digits = cleaned.replace(/[^+\d]/g, '')
  
  // Validate E.164 format: +[1-9][0-9]{6,14}
  // Must start with +, then non-zero digit, then 6-14 more digits
  if (!/^\+[1-9]\d{6,14}$/.test(digits)) {
    throw new Error('INVALID_PHONE')
  }
  
  return digits
}

/**
 * Format phone number for display in UI
 * Converts E.164 format to human-readable format
 * 
 * @example
 * formatPhoneForDisplay('+48123456789')  // '+48 123 456 789'
 * formatPhoneForDisplay('48123456789')   // '+48 123 456 789'
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = normalizePhoneDigitsOnly(phone)
  if (!digits) return ''
  
  // Ensure + prefix
  const withPlus = digits.startsWith('+') ? digits : `+${digits}`
  
  // Polish numbers: +48 XXX XXX XXX
  if (withPlus.startsWith('+48') && withPlus.length === 12) {
    return `${withPlus.slice(0, 3)} ${withPlus.slice(3, 6)} ${withPlus.slice(6, 9)} ${withPlus.slice(9)}`
  }
  
  // Ukrainian numbers: +380 XX XXX XX XX
  if (withPlus.startsWith('+380') && withPlus.length === 13) {
    return `${withPlus.slice(0, 4)} ${withPlus.slice(4, 6)} ${withPlus.slice(6, 9)} ${withPlus.slice(9, 11)} ${withPlus.slice(11)}`
  }
  
  // Generic format: +CC XXXX...
  if (withPlus.length > 4) {
    return `${withPlus.slice(0, 3)} ${withPlus.slice(3)}`
  }
  
  return withPlus
}
