import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const rateLimit = vi.fn()
const validateTurnstileForAPI = vi.fn()
const exportUserData = vi.fn()

vi.mock('../../../../src/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('../../../../src/lib/cache', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('../../../../src/lib/turnstile', () => ({
  validateTurnstileForAPI: (...args: unknown[]) => validateTurnstileForAPI(...args),
}))

vi.mock('../../../../src/lib/google/sheets', () => ({
  exportUserData: (...args: unknown[]) => exportUserData(...args),
}))

vi.mock('../../../../src/lib/sentry', () => ({
  reportError: vi.fn(),
}))

vi.mock('../../../../src/lib/env', () => ({
  config: {
    TURNSTILE_SECRET_EFFECTIVE: undefined,
  },
}))

let postHandler: (req: any) => Promise<Response>

describe('POST /api/consents/export', () => {
  const payload = {
    name: 'Sviatoslav Upirow',
    phone: '+48501748708',
    email: 'user@example.com',
    turnstileToken: 'dev-token-12345',
  }

  const mockExportData = {
    personalData: {
      name: 'Sviatoslav Upirow',
      phone: '48501748708',
      email: 'user@example.com',
    },
    consentHistory: [
      {
        consentDate: '2024-06-01T10:00:00+02:00',
        ipHash: '127.0.0.xxx',
        privacyV10: true,
        termsV10: true,
        notificationsV10: false,
        withdrawnDate: undefined,
        withdrawalMethod: undefined,
      },
    ],
    isAnonymized: false,
    exportTimestamp: '2024-09-26T12:00:00+02:00',
  }

  function createRequest(body: any = payload) {
    return {
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Request
  }

  beforeAll(async () => {
    ;({ POST: postHandler } = await import('../../../../src/app/api/consents/export/route'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ allowed: true })
    validateTurnstileForAPI.mockResolvedValue({ success: true })
    exportUserData.mockResolvedValue({ exportedData: mockExportData })
  })

  it('successfully exports user data and returns 200', async () => {
    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.personalData).toEqual(mockExportData.personalData)
    expect(body.consentHistory).toHaveLength(1)
    expect(body.isAnonymized).toBe(false)
    expect(exportUserData).toHaveBeenCalledWith({
      phone: '48501748708',
      name: 'Sviatoslav Upirow',
      email: 'user@example.com',
      requestId: expect.any(String),
    })
  })

  it('returns 404 when user data not found', async () => {
    exportUserData.mockResolvedValue({
      exportedData: null,
      reason: 'NOT_FOUND',
    })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.code).toBe('DATA_NOT_FOUND')
    expect(body.error).toContain('Nie znaleźliśmy danych')
    expect(body.hints).toBeInstanceOf(Array)
  })

  it('validates required fields and returns 400 for invalid input', async () => {
    const invalidPayload = {
      name: 'A', // Too short
      phone: '123', // Too short
      email: 'invalid-email',
      turnstileToken: 'token',
    }

    const response = await postHandler(createRequest(invalidPayload))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('INVALID_PAYLOAD')
    expect(exportUserData).not.toHaveBeenCalled()
  })

  it('validates phone number format and returns 400 for invalid phone', async () => {
    const invalidPhonePayload = {
      ...payload,
      phone: 'invalid-phone',
    }

    const response = await postHandler(createRequest(invalidPhonePayload))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('INVALID_PHONE')
    expect(body.hints).toContain('Użyj pełnego numeru z kodem kraju, np. +48...')
  })

  it('enforces rate limiting and returns 429 when exceeded', async () => {
    rateLimit.mockResolvedValue({ allowed: false })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.code).toBe('RATE_LIMITED')
    expect(exportUserData).not.toHaveBeenCalled()
  })

  it('handles Turnstile validation failure', async () => {
    validateTurnstileForAPI.mockResolvedValue({
      success: false,
      status: 400,
      errorResponse: { error: 'Turnstile validation failed' },
    })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Turnstile validation failed')
    expect(exportUserData).not.toHaveBeenCalled()
  })

  it('handles internal server errors gracefully', async () => {
    exportUserData.mockRejectedValue(new Error('Database connection failed'))

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('handles export without email correctly', async () => {
    const payloadNoEmail = {
      name: 'Sviatoslav Upirow',
      phone: '+48501748708',
      email: undefined,
      turnstileToken: 'dev-token-12345',
    }

    const response = await postHandler(createRequest(payloadNoEmail))

    expect(response.status).toBe(200)
    expect(exportUserData).toHaveBeenCalledWith({
      phone: '48501748708',
      name: 'Sviatoslav Upirow',
      email: undefined,
      requestId: expect.any(String),
    })
  })

  it('normalizes phone numbers correctly', async () => {
    const phoneVariations = [
      '+48 501 748 708',
      '48501748708',
      '0501748708',
      '+48-501-748-708',
    ]

    for (const phone of phoneVariations) {
      vi.clearAllMocks()
      exportUserData.mockResolvedValue({ exportedData: mockExportData })

      const testPayload = { ...payload, phone }
      const response = await postHandler(createRequest(testPayload))

      expect(response.status).toBe(200)
      expect(exportUserData).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '48501748708',
        })
      )
    }
  })
})
