import { describe, it, expect, beforeEach, vi } from 'vitest'
import { verifyBookingAccess, canModifyBooking, matchesSearchCriteria } from '@/lib/booking-helpers'

describe('booking-helpers', () => {
  describe('verifyBookingAccess', () => {
    const mockEvent = {
      id: 'event123',
      summary: 'Test Booking',
      start: { dateTime: '2025-10-05T10:00:00Z' },
      end: { dateTime: '2025-10-05T11:00:00Z' },
      extendedProperties: {
        private: {
          phone: '+48123456789',
          customerName: 'Jan Kowalski',
        },
      },
    }

    it('should grant access with matching phone and name', () => {
      const result = verifyBookingAccess(
        mockEvent as any,
        '+48123456789',
        'Jan Kowalski'
      )
      expect(result).toBe(true)
    })

    it('should grant access with normalized phone', () => {
      const result = verifyBookingAccess(
        mockEvent as any,
        '123 456 789', // without country code
        'Jan Kowalski'
      )
      expect(result).toBe(true)
    })

    it('should grant access with normalized name (case insensitive)', () => {
      const result = verifyBookingAccess(
        mockEvent as any,
        '+48123456789',
        'jan kowalski' // lowercase
      )
      expect(result).toBe(true)
    })

    it('should grant access with Cyrillic name', () => {
      const eventWithCyrillic = {
        ...mockEvent,
        extendedProperties: {
          private: {
            phone: '+380501234567',
            customerName: 'Олександр Петров',
          },
        },
      }

      const result = verifyBookingAccess(
        eventWithCyrillic as any,
        '+380501234567',
        'Олександр Петров'
      )
      expect(result).toBe(true)
    })

    it('should deny access with wrong phone', () => {
      const result = verifyBookingAccess(
        mockEvent as any,
        '+48987654321', // different phone
        'Jan Kowalski'
      )
      expect(result).toBe(false)
    })

    it('should deny access with wrong name', () => {
      const result = verifyBookingAccess(
        mockEvent as any,
        '+48123456789',
        'Adam Nowak' // different name
      )
      expect(result).toBe(false)
    })

    it('should deny access with partial name match', () => {
      const result = verifyBookingAccess(
        mockEvent as any,
        '+48123456789',
        'Jan' // only first name
      )
      expect(result).toBe(false)
    })

    it('should handle event without extended properties', () => {
      const eventWithoutProps = {
        ...mockEvent,
        extendedProperties: undefined,
      }

      const result = verifyBookingAccess(
        eventWithoutProps as any,
        '+48123456789',
        'Jan Kowalski'
      )
      expect(result).toBe(false)
    })
  })

  describe('canModifyBooking', () => {
    beforeEach(() => {
      // Mock current time: 2025-10-03T08:00:00Z
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-10-03T08:00:00Z'))
    })

    it('should allow modification more than 24 hours before', () => {
      const booking = {
        start: { dateTime: '2025-10-05T10:00:00Z' }, // 2+ days ahead
      }

      expect(canModifyBooking(booking as any)).toBe(true)
    })

    it('should allow modification exactly 25 hours before', () => {
      const booking = {
        start: { dateTime: '2025-10-04T09:00:00Z' }, // exactly 25 hours
      }

      expect(canModifyBooking(booking as any)).toBe(true)
    })

    it('should deny modification less than 24 hours before', () => {
      const booking = {
        start: { dateTime: '2025-10-04T07:00:00Z' }, // 23 hours ahead
      }

      expect(canModifyBooking(booking as any)).toBe(false)
    })

    it('should deny modification exactly 24 hours before', () => {
      const booking = {
        start: { dateTime: '2025-10-04T08:00:00Z' }, // exactly 24 hours
      }

      // Depending on implementation: strict > or >=
      // Adjust expectation based on actual implementation
      expect(canModifyBooking(booking as any)).toBe(false)
    })

    it('should deny modification for past bookings', () => {
      const booking = {
        start: { dateTime: '2025-10-02T10:00:00Z' }, // in the past
      }

      expect(canModifyBooking(booking as any)).toBe(false)
    })

    it('should handle invalid date format', () => {
      const booking = {
        start: { dateTime: 'invalid-date' },
      }

      expect(canModifyBooking(booking as any)).toBe(false)
    })

    it('should handle missing start time', () => {
      const booking = {
        start: undefined,
      }

      expect(canModifyBooking(booking as any)).toBe(false)
    })
  })

  describe('matchesSearchCriteria', () => {
    const mockEvent = {
      id: 'event123',
      summary: 'Masaż twarzy',
      start: { dateTime: '2025-10-05T10:00:00Z' },
      end: { dateTime: '2025-10-05T11:00:00Z' },
      extendedProperties: {
        private: {
          phone: '+48123456789',
          customerName: 'Jan Kowalski',
          customerEmail: 'jan@example.com',
        },
      },
    }

    it('should match by exact phone', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        phone: '+48123456789',
      })
      expect(result).toBe(true)
    })

    it('should match by normalized phone', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        phone: '123 456 789',
      })
      expect(result).toBe(true)
    })

    it('should match by exact name', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        name: 'Jan Kowalski',
      })
      expect(result).toBe(true)
    })

    it('should match by normalized name', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        name: 'jan kowalski', // case insensitive
      })
      expect(result).toBe(true)
    })

    it('should match by email', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        email: 'jan@example.com',
      })
      expect(result).toBe(true)
    })

    it('should match by normalized email', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        email: 'JAN@EXAMPLE.COM', // case insensitive
      })
      expect(result).toBe(true)
    })

    it('should match with multiple criteria (AND logic)', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        phone: '+48123456789',
        name: 'Jan Kowalski',
      })
      expect(result).toBe(true)
    })

    it('should not match with wrong phone', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        phone: '+48987654321',
      })
      expect(result).toBe(false)
    })

    it('should not match with wrong name', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        name: 'Adam Nowak',
      })
      expect(result).toBe(false)
    })

    it('should not match when one criterion fails (AND logic)', () => {
      const result = matchesSearchCriteria(mockEvent as any, {
        phone: '+48123456789', // correct
        name: 'Wrong Name', // wrong
      })
      expect(result).toBe(false)
    })

    it('should return false for event without extended properties', () => {
      const eventWithoutProps = {
        ...mockEvent,
        extendedProperties: undefined,
      }

      const result = matchesSearchCriteria(eventWithoutProps as any, {
        phone: '+48123456789',
      })
      expect(result).toBe(false)
    })

    it('should return false when no criteria provided', () => {
      const result = matchesSearchCriteria(mockEvent as any, {})
      expect(result).toBe(false)
    })
  })
})
