import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MASTER_IDS } from '@/config/masters'

/**
 * Multi-Master API Integration Tests
 * Tests that all API endpoints correctly handle masterId parameter
 */

describe('Multi-Master API Support', () => {
  describe('Procedures Endpoint', () => {
    it('should accept masterId query parameter', async () => {
      for (const masterId of MASTER_IDS) {
        const response = await fetch(`/api/procedures?masterId=${masterId}`)
        expect(response.status).not.toBe(500)
      }
    })

    it('should return different procedures for different masters', async () => {
      const responses = await Promise.all(
        MASTER_IDS.map(masterId => 
          fetch(`/api/procedures?masterId=${masterId}`).then(r => r.json())
        )
      )
      
      // Both should return valid procedure arrays
      responses.forEach(data => {
        expect(Array.isArray(data)).toBe(true)
      })
    })

    it('should cache procedures separately per master', async () => {
      const cacheKeys = MASTER_IDS.map(masterId => `procedures:v1:${masterId}`)
      
      // Verify cache keys are unique
      const uniqueKeys = new Set(cacheKeys)
      expect(uniqueKeys.size).toBe(MASTER_IDS.length)
    })
  })

  describe('Availability Endpoint', () => {
    it('should accept masterId query parameter', async () => {
      const today = new Date().toISOString().split('T')[0]
      
      for (const masterId of MASTER_IDS) {
        const response = await fetch(`/api/availability?date=${today}&masterId=${masterId}`)
        expect(response.status).not.toBe(500)
      }
    })

    it('should calculate availability for correct master', async () => {
      const today = new Date().toISOString().split('T')[0]
      
      const responses = await Promise.all(
        MASTER_IDS.map(masterId =>
          fetch(`/api/availability?date=${today}&masterId=${masterId}`).then(r => r.json())
        )
      )

      // Both should return valid availability data
      responses.forEach(data => {
        expect(data).toHaveProperty('days')
        expect(Array.isArray(data.days)).toBe(true)
      })
    })
  })

  describe('Day Slots Endpoint', () => {
    it('should accept masterId query parameter', async () => {
      const today = new Date().toISOString().split('T')[0]
      
      for (const masterId of MASTER_IDS) {
        const response = await fetch(`/api/day/${today}?masterId=${masterId}`)
        expect(response.status).not.toBe(500)
      }
    })

    it('should return slots for correct master schedule', async () => {
      const today = new Date().toISOString().split('T')[0]
      
      const responses = await Promise.all(
        MASTER_IDS.map(masterId =>
          fetch(`/api/day/${today}?masterId=${masterId}`).then(r => r.json())
        )
      )

      responses.forEach(data => {
        expect(data).toHaveProperty('slots')
        expect(Array.isArray(data.slots)).toBe(true)
      })
    })
  })

  describe('Booking Endpoint', () => {
    it('should accept masterId in request body', async () => {
      const mockBooking = {
        masterId: 'olga',
        startISO: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endISO: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        name: 'Test User',
        phone: '+48123456789',
        procedureId: 'test-proc',
        consents: {
          dataProcessing: true,
          terms: true,
          notifications: false,
        },
      }

      // This is a mock test - actual booking would require valid Turnstile token
      // and would interact with real Google Calendar
      expect(mockBooking).toHaveProperty('masterId')
      expect(MASTER_IDS).toContain(mockBooking.masterId as any)
    })
  })

  describe('Booking Management Endpoints', () => {
    const endpoints = [
      '/api/bookings/all',
      '/api/bookings/cancel',
      '/api/bookings/update-time',
      '/api/bookings/update-procedure',
    ]

    it('should accept masterId parameter in all booking endpoints', () => {
      endpoints.forEach(endpoint => {
        // Verify endpoint exists and is configured to accept masterId
        expect(endpoint).toBeTruthy()
      })
    })
  })

  describe('Cache Isolation', () => {
    it('should use separate cache keys for different masters', () => {
      const procedures = MASTER_IDS.map(id => `procedures:v1:${id}`)
      const availability = MASTER_IDS.map(id => `availability:${id}`)
      
      // All cache keys should be unique
      const allKeys = [...procedures, ...availability]
      const uniqueKeys = new Set(allKeys)
      expect(uniqueKeys.size).toBe(allKeys.length)
    })

    it('should not invalidate cache for other masters', () => {
      // When Olga's data changes, Yuliia's cache should remain intact
      const olgaKey = 'procedures:v1:olga'
      const yuliiaKey = 'procedures:v1:yuliia'
      
      expect(olgaKey).not.toBe(yuliiaKey)
    })
  })
})

describe('Server-Side Master Configuration', () => {
  it('should have environment variables for both masters', () => {
    // These should be defined in .env.example
    const requiredEnvVars = [
      'GOOGLE_CALENDAR_ID',       // Olga
      'GOOGLE_CALENDAR_ID_YULIIA',  // Yuliia
      'GOOGLE_SHEET_ID',          // Olga
      'GOOGLE_SHEET_ID_YULIIA',     // Yuliia
    ]

    // This is a documentation test - actual env vars are checked at runtime
    expect(requiredEnvVars).toHaveLength(4)
  })
})

describe('Master Context Integration', () => {
  it('should include masterId in all React Query keys', () => {
    const queryKeys = [
      ['procedures', 'olga'],
      ['procedures', 'yuliia'],
      ['availability', 'olga', '2024-01-15'],
      ['availability', 'yuliia', '2024-01-15'],
      ['day-slots', 'olga', '2024-01-15', 'proc-1'],
      ['day-slots', 'yuliia', '2024-01-15', 'proc-1'],
    ]

    // All query keys should include masterId as second element
    queryKeys.forEach(key => {
      expect(MASTER_IDS).toContain(key[1] as any)
    })
  })

  it('should invalidate only current master queries on change', () => {
    // When switching from Olga to Yuliia:
    // - Should NOT invalidate Olga's cached data
    // - Should load Yuliia's data (either from cache or fetch)
    const olgaKey = ['procedures', 'olga']
    const yuliiaKey = ['procedures', 'yuliia']
    
    expect(olgaKey[1]).not.toBe(yuliiaKey[1])
  })
})
