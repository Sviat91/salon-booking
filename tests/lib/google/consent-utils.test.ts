import { describe, it, expect } from 'vitest'
import {
  parseConsentTimestamp,
  hashPhoneForErasure,
  resolveConsentColumns,
  DEFAULT_COLUMN_INDEX,
} from '@/lib/google/consent-utils'

describe('consent-utils', () => {
  describe('parseConsentTimestamp', () => {
    it('should parse valid ISO timestamp', () => {
      const timestamp = '2025-01-15T10:30:00.000Z'
      const result = parseConsentTimestamp(timestamp)
      
      expect(result).toBeTruthy()
      expect(result).toBeInstanceOf(Date)
      expect(result!.toISOString()).toBe(timestamp)
    })

    it('should parse Warsaw timezone timestamp', () => {
      const timestamp = '2025-01-15 10:30:00'
      const result = parseConsentTimestamp(timestamp)
      
      expect(result).toBeTruthy()
      expect(result).toBeInstanceOf(Date)
    })

    it('should return null for invalid timestamp', () => {
      expect(parseConsentTimestamp('invalid-date')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parseConsentTimestamp('')).toBeNull()
    })

    it('should handle different date formats', () => {
      const formats = [
        '2025-01-15T10:30:00Z',
        '2025-01-15 10:30:00',
        '2025-01-15T10:30:00.123Z',
      ]

      formats.forEach(format => {
        const result = parseConsentTimestamp(format)
        expect(result).toBeTruthy()
      })
    })
  })

  describe('hashPhoneForErasure', () => {
    it('should generate consistent hash for same phone', () => {
      const phone = '+48123456789'
      const hash1 = hashPhoneForErasure(phone)
      const hash2 = hashPhoneForErasure(phone)
      
      expect(hash1).toBe(hash2)
    })

    it('should generate different hashes for different phones', () => {
      const phone1 = '+48123456789'
      const phone2 = '+48987654321'
      
      const hash1 = hashPhoneForErasure(phone1)
      const hash2 = hashPhoneForErasure(phone2)
      
      expect(hash1).not.toBe(hash2)
    })

    it('should generate SHA-256 hash', () => {
      const phone = '+48123456789'
      const hash = hashPhoneForErasure(phone)
      
      // SHA-256 produces 64 character hex string
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should include salt in hash', () => {
      // Different salt should produce different hash
      const phone = '+48123456789'
      const hash = hashPhoneForErasure(phone)
      
      expect(hash).toBeTruthy()
      expect(hash.length).toBe(64)
    })

    it('should handle empty phone', () => {
      const hash = hashPhoneForErasure('')
      expect(hash).toBeTruthy()
      expect(hash.length).toBe(64)
    })

    it('should handle special characters in phone', () => {
      const phone = '+48 (123) 456-789'
      const hash = hashPhoneForErasure(phone)
      
      expect(hash).toBeTruthy()
      expect(hash.length).toBe(64)
    })
  })

  describe('resolveConsentColumns', () => {
    it('should return default columns when header is empty', () => {
      const result = resolveConsentColumns([])
      expect(result).toEqual(DEFAULT_COLUMN_INDEX)
    })

    it('should resolve columns from header row', () => {
      const header = [
        'Phone',
        'Email',
        'Name',
        'ConsentDate',
        'IPHash',
        'ConsentPrivacy',
        'ConsentTerms',
        'ConsentNotifications',
        'ConsentWithdrawn',
        'WithdrawalMethod',
        'RequestErasureDate',
        'ErasureDate',
        'ErasureMethod',
      ]

      const result = resolveConsentColumns(header)
      
      expect(result.phone).toBe(0)
      expect(result.email).toBe(1)
      expect(result.name).toBe(2)
      expect(result.consentDate).toBe(3)
    })

    it('should handle case-insensitive headers', () => {
      const header = [
        'PHONE',
        'EMAIL',
        'NAME',
        'CONSENTDATE',
      ]

      const result = resolveConsentColumns(header)
      
      expect(result.phone).toBe(0)
      expect(result.email).toBe(1)
      expect(result.name).toBe(2)
      expect(result.consentDate).toBe(3)
    })

    it('should handle Polish column names', () => {
      const header = [
        'Telefon',
        'Mail',
        'Imię i Nazwisko',
      ]

      const result = resolveConsentColumns(header)
      
      expect(result.phone).toBe(0)
      expect(result.email).toBe(1)
      expect(result.name).toBe(2)
    })

    it('should fallback to default index if column not found', () => {
      const header = ['UnknownColumn1', 'UnknownColumn2']
      
      const result = resolveConsentColumns(header)
      
      // Should use default column indices
      expect(result.phone).toBe(DEFAULT_COLUMN_INDEX.phone)
      expect(result.email).toBe(DEFAULT_COLUMN_INDEX.email)
    })

    it('should handle partial header match', () => {
      const header = [
        'Phone',
        'UnknownColumn',
        'Name',
      ]

      const result = resolveConsentColumns(header)
      
      expect(result.phone).toBe(0)
      expect(result.name).toBe(2)
      // Email falls back to default
      expect(result.email).toBe(DEFAULT_COLUMN_INDEX.email)
    })
  })
})
