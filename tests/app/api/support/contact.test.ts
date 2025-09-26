import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const rateLimit = vi.fn()
const mockFetch = vi.fn()
const mockEnvConfig = {
  N8N_WEBHOOK_URL: 'https://n8n.example.com/webhook/test',
  N8N_SECRET_TOKEN: 'test-secret-token',
  N8N_SECRET_HEADER: 'x-secret-token',
}

vi.mock('../../../../src/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('../../../../src/lib/cache', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}))

vi.mock('../../../../src/lib/sentry', () => ({
  reportError: vi.fn(),
}))

vi.mock('../../../../src/lib/env', () => ({
  config: mockEnvConfig,
}))

// Mock global fetch
global.fetch = mockFetch

let postHandler: any

describe('POST /api/support/contact', () => {
  const validPayload = {
    name: 'Sviatoslav Upirow',
    email: 'user@example.com',
    subject: 'booking',
    message: 'This is a test message for booking support.',
  }

  function createRequest(body: any = validPayload) {
    return {
      headers: new Headers({ 
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'Mozilla/5.0 Test Browser'
      }),
      json: vi.fn().mockResolvedValue(body),
      ip: '127.0.0.1',
    } as unknown as Request
  }

  beforeAll(async () => {
    ;({ POST: postHandler } = await import('../../../../src/app/api/support/contact/route'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ allowed: true, count: 1 })
    mockEnvConfig.N8N_WEBHOOK_URL = 'https://n8n.example.com/webhook/test'
    mockEnvConfig.N8N_SECRET_TOKEN = 'test-secret-token'
    mockEnvConfig.N8N_SECRET_HEADER = 'x-secret-token'
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
      text: vi.fn().mockResolvedValue(''),
    })
  })

  it('successfully forwards contact form to N8N webhook', async () => {
    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('success')
    expect(body.message).toContain('Wiadomość została wysłana pomyślnie')
    expect(body.requestId).toBeDefined()

    expect(mockFetch).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-secret-token': 'test-secret-token',
        }),
        body: expect.stringContaining(validPayload.name),
      })
    )
  })

  it('validates required fields and returns 400 for missing data', async () => {
    const invalidPayload = {
      name: 'A', // Too short
      email: 'invalid-email',
      subject: '', // Empty
      message: 'Short', // Too short
    }

    const response = await postHandler(createRequest(invalidPayload))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.field).toBeDefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('enforces rate limiting and returns 429 when exceeded', async () => {
    rateLimit.mockResolvedValue({ allowed: false, count: 4 })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.error).toContain('Zbyt wiele wiadomości')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 503 when N8N configuration is missing', async () => {
    mockEnvConfig.N8N_WEBHOOK_URL = undefined as any
    mockEnvConfig.N8N_SECRET_TOKEN = undefined as any

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.code).toBe('SERVICE_UNAVAILABLE')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('retries N8N webhook on failure and returns success on retry', async () => {
    // First call fails, second succeeds
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('success')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns 503 after all retries fail', async () => {
    // All attempts fail
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.code).toBe('DELIVERY_FAILED')
    expect(mockFetch).toHaveBeenCalledTimes(3) // Initial + 2 retries
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('returns 502 when n8n rejects credentials', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue('Authorization data is wrong!'),
    })

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.code).toBe('UPSTREAM_AUTH_FAILED')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.code).toBe('DELIVERY_FAILED')
    expect(mockLogger.error).toHaveBeenCalled()
  })

  it('masks email in logs for privacy', async () => {
    await postHandler(createRequest())

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'u***r@example.com', // Masked email
      }),
      expect.any(String)
    )
  })

  it('includes metadata in N8N payload', async () => {
    await postHandler(createRequest())

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"metadata"'),
      })
    )

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.metadata).toEqual(
      expect.objectContaining({
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        timestamp: expect.any(String),
        requestId: expect.any(String),
      })
    )
  })

  it('normalizes input data correctly', async () => {
    const mesyPayload = {
      name: '  Sviatoslav Upirow  ',
      email: '  USER@EXAMPLE.COM  ',
      subject: '  booking  ',
      message: '  This is a test message.  ',
    }

    const response = await postHandler(createRequest(mesyPayload))
    const body = await response.json()
    expect(response.status).toBe(200)

    expect(mockFetch).toHaveBeenCalled()
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.name).toBe('Sviatoslav Upirow')
    expect(callBody.email).toBe('user@example.com')
    expect(callBody.subject).toBe('booking')
    expect(callBody.message).toBe('This is a test message.')
  })
})
