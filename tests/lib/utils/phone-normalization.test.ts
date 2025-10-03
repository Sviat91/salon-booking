import { describe, it, expect } from 'vitest'
import { normalizePhone } from '@/lib/utils/phone-normalization'

describe('normalizePhone', () => {
  describe('Polish numbers', () => {
    it('should normalize Polish mobile number with spaces', () => {
      expect(normalizePhone('123 456 789')).toBe('+48123456789')
    })

    it('should normalize Polish mobile number with dashes', () => {
      expect(normalizePhone('123-456-789')).toBe('+48123456789')
    })

    it('should keep already normalized Polish number', () => {
      expect(normalizePhone('+48123456789')).toBe('+48123456789')
    })

    it('should normalize Polish number with country code without plus', () => {
      expect(normalizePhone('48123456789')).toBe('+48123456789')
    })

    it('should handle Polish number with leading zero', () => {
      expect(normalizePhone('0123456789')).toBe('+48123456789')
    })
  })

  describe('Ukrainian numbers', () => {
    it('should normalize Ukrainian mobile number', () => {
      expect(normalizePhone('50 123 45 67')).toBe('+380501234567')
    })

    it('should keep Ukrainian number with country code', () => {
      expect(normalizePhone('+380501234567')).toBe('+380501234567')
    })

    it('should normalize Ukrainian number without plus', () => {
      expect(normalizePhone('380501234567')).toBe('+380501234567')
    })

    it('should handle Ukrainian number with leading zero', () => {
      expect(normalizePhone('0501234567')).toBe('+380501234567')
    })
  })

  describe('Other country codes', () => {
    it('should preserve German number', () => {
      expect(normalizePhone('+491234567890')).toBe('+491234567890')
    })

    it('should preserve UK number', () => {
      expect(normalizePhone('+447911123456')).toBe('+447911123456')
    })

    it('should preserve French number', () => {
      expect(normalizePhone('+33123456789')).toBe('+33123456789')
    })
  })

  describe('Edge cases', () => {
    it('should handle numbers with mixed separators', () => {
      expect(normalizePhone('123 456-789')).toBe('+48123456789')
    })

    it('should handle numbers with parentheses', () => {
      expect(normalizePhone('(123) 456-789')).toBe('+48123456789')
    })

    it('should remove all non-digit characters except plus', () => {
      expect(normalizePhone('+48 (123) 456-789')).toBe('+48123456789')
    })

    it('should handle very short numbers', () => {
      expect(normalizePhone('12')).toBe('+4812')
    })

    it('should handle empty string', () => {
      expect(normalizePhone('')).toBe('')
    })

    it('should handle only spaces', () => {
      expect(normalizePhone('   ')).toBe('')
    })
  })

  describe('Real-world examples', () => {
    it('should normalize typical Polish format', () => {
      expect(normalizePhone('793 265 142')).toBe('+48793265142')
    })

    it('should normalize Polish landline', () => {
      expect(normalizePhone('22 123 45 67')).toBe('+48221234567')
    })

    it('should normalize Ukrainian mobile operator codes', () => {
      expect(normalizePhone('066 123 45 67')).toBe('+380661234567')
      expect(normalizePhone('095 123 45 67')).toBe('+380951234567')
    })
  })
})
