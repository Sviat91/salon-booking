import { beforeEach, describe, expect, it, vi } from 'vitest'

import { exportUserData } from '../../../src/lib/google/sheets'

const valuesGetMock = vi.fn()

function buildMockClients() {
  return {
    sheets: {
      spreadsheets: {
        values: {
          get: valuesGetMock,
          update: vi.fn(),
          append: vi.fn(),
        },
      },
    },
  }
}

vi.mock('../../../src/lib/google/auth', () => ({
  getClients: () => buildMockClients(),
}))

describe('exportUserData', () => {
  const headerRow = [
    'phone',
    'email', 
    'name',
    'consent_date',
    'ip_hash',
    'consent_privacy_v1.0',
    'consent_terms_v1.0',
    'consent_notifications_v1.0',
    'withdrawn_date',
    'withdrawal_method',
    'request_erasure_date',
    'erasure_date',
    'erasure_method',
  ]

  beforeEach(() => {
    valuesGetMock.mockReset()
  })

  it('successfully exports user data with consent history', async () => {
    valuesGetMock.mockResolvedValue({
      data: {
        values: [
          headerRow,
          [
            '48501748708',
            'user@example.com',
            'Sviatoslav Upirow',
            '2024-06-01T10:00:00+02:00',
            '127.0.0.xxx',
            'TRUE',
            'TRUE',
            'FALSE',
            '',
            '',
            '',
            '',
            '',
          ],
          [
            '48501748708',
            'user@example.com',
            'Sviatoslav Upirow', 
            '2024-07-01T15:30:00+02:00',
            '127.0.0.xxx',
            'TRUE',
            'TRUE',
            'TRUE',
            '',
            '',
            '',
            '',
            '',
          ],
        ],
      },
    })

    const result = await exportUserData({
      phone: '+48 501 748 708',
      name: 'Sviatoslav Upirow',
      email: 'user@example.com',
      requestId: 'test-request-123',
    })

    expect(result.exportedData).not.toBeNull()
    expect(result.exportedData!.personalData).toEqual({
      name: 'Sviatoslav Upirow',
      phone: '48501748708',
      email: 'user@example.com',
    })

    expect(result.exportedData!.consentHistory).toHaveLength(2)
    expect(result.exportedData!.consentHistory[0].consentDate).toBe('2024-07-01T15:30:00+02:00')
    expect(result.exportedData!.consentHistory[0].privacyV10).toBe(true)
    expect(result.exportedData!.consentHistory[0].termsV10).toBe(true) 
    expect(result.exportedData!.consentHistory[0].notificationsV10).toBe(true)

    expect(result.exportedData!.consentHistory[1].consentDate).toBe('2024-06-01T10:00:00+02:00')
    expect(result.exportedData!.consentHistory[1].notificationsV10).toBe(false)
    
    expect(result.exportedData!.isAnonymized).toBe(false)
    expect(result.exportedData!.exportTimestamp).toBeDefined()
  })

  it('includes withdrawn consent in export history', async () => {
    valuesGetMock.mockResolvedValue({
      data: {
        values: [
          headerRow,
          [
            '48501748708',
            'user@example.com',
            'Sviatoslav Upirow',
            '2024-06-01T10:00:00+02:00',
            '127.0.0.xxx',
            'FALSE',
            'FALSE', 
            'FALSE',
            '2024-08-01T12:00:00+02:00',
            'support_form',
            '',
            '',
            '',
          ],
        ],
      },
    })

    const result = await exportUserData({
      phone: '+48 501 748 708',
      name: 'Sviatoslav Upirow',
      email: 'user@example.com',
    })

    expect(result.exportedData).not.toBeNull()
    expect(result.exportedData!.consentHistory).toHaveLength(1)
    expect(result.exportedData!.consentHistory[0].withdrawnDate).toBe('2024-08-01T12:00:00+02:00')
    expect(result.exportedData!.consentHistory[0].withdrawalMethod).toBe('support_form')
  })

  it('returns NOT_FOUND when user data does not exist', async () => {
    valuesGetMock.mockResolvedValue({
      data: {
        values: [
          headerRow,
          [
            '48999999999',
            'other@example.com',
            'Other User',
            '2024-06-01T10:00:00+02:00',
            '127.0.0.xxx',
            'TRUE',
            'TRUE',
            'TRUE',
            '',
            '',
            '',
            '',
            '',
          ],
        ],
      },
    })

    const result = await exportUserData({
      phone: '+48 501 748 708',
      name: 'Sviatoslav Upirow',
      email: 'user@example.com',
    })

    expect(result.exportedData).toBeNull()
    expect(result.reason).toBe('NOT_FOUND')
  })

  it('skips anonymized records during matching', async () => {
    valuesGetMock.mockResolvedValue({
      data: {
        values: [
          headerRow,
          [
            'a7b3f9c12e4d5678', // Anonymized phone hash
            '',
            '',
            '2024-06-01T10:00:00+02:00',
            '127.0.0.xxx',
            'FALSE',
            'FALSE',
            'FALSE',
            '2024-08-01T12:00:00+02:00',
            'support_form',
            '2024-08-01T12:00:00+02:00',
            '2024-08-01T12:00:02+02:00',
            'support_form',
          ],
        ],
      },
    })

    const result = await exportUserData({
      phone: '+48 501 748 708',
      name: 'Sviatoslav Upirow',
      email: 'user@example.com',
    })

    expect(result.exportedData).toBeNull()
    expect(result.reason).toBe('NOT_FOUND')
  })

  it('handles empty sheets gracefully', async () => {
    valuesGetMock.mockResolvedValue({
      data: {
        values: [headerRow],
      },
    })

    const result = await exportUserData({
      phone: '+48 501 748 708',
      name: 'Sviatoslav Upirow',
    })

    expect(result.exportedData).toBeNull()
    expect(result.reason).toBe('NOT_FOUND')
  })

  it('handles missing optional fields correctly', async () => {
    valuesGetMock.mockResolvedValue({
      data: {
        values: [
          headerRow,
          [
            '48501748708',
            '', // No email
            'Sviatoslav Upirow',
            '2024-06-01T10:00:00+02:00',
            '127.0.0.xxx',
            'TRUE',
            'TRUE',
            'TRUE',
            '',
            '',
            '',
            '',
            '',
          ],
        ],
      },
    })

    const result = await exportUserData({
      phone: '+48 501 748 708',
      name: 'Sviatoslav Upirow',
      // No email provided
    })

    expect(result.exportedData).not.toBeNull()
    expect(result.exportedData!.personalData.email).toBeUndefined()
    expect(result.exportedData!.personalData.name).toBe('Sviatoslav Upirow')
    expect(result.exportedData!.personalData.phone).toBe('48501748708')
  })
})
