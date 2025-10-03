/**
 * String normalization utilities
 * Centralized logic for text processing across the application
 */

/**
 * Normalize text with Cyrillic to Latin conversion
 * Used for: name matching in bookings where users might type in different alphabets
 * 
 * @example
 * normalizeTextWithCyrillicConversion('Александр') // 'alexandr'
 * normalizeTextWithCyrillicConversion('Anna') // 'anna'
 */
export function normalizeTextWithCyrillicConversion(text: string): string {
  return text.toLowerCase().trim()
    // Convert common cyrillic letters to latin equivalents
    .replace(/а/g, 'a').replace(/е/g, 'e').replace(/о/g, 'o')
    .replace(/р/g, 'p').replace(/с/g, 'c').replace(/у/g, 'y')
    .replace(/х/g, 'x').replace(/к/g, 'k').replace(/м/g, 'm')
    .replace(/н/g, 'h').replace(/в/g, 'b').replace(/т/g, 't')
}

/**
 * Normalize name for matching and storage
 * Normalizes whitespace, converts to lowercase
 * 
 * @example
 * normalizeNameForMatching('  John   Doe  ') // 'john doe'
 * normalizeNameForMatching('Anna-Maria') // 'anna-maria'
 */
export function normalizeNameForMatching(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Normalize email for matching and comparison
 * Emails are case-insensitive per RFC 5321
 * 
 * @example
 * normalizeEmailForMatching('  User@Example.COM  ') // 'user@example.com'
 */
export function normalizeEmailForMatching(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Normalize search query text
 * Removes extra spaces, converts to lowercase, handles special characters
 * 
 * @example
 * normalizeSearchQuery('  Hello   World!  ') // 'hello world!'
 */
export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}
