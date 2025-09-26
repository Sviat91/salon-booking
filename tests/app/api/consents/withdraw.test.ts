import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const rateLimit = vi.fn()
const cacheSetNX = vi.fn()
const cacheDel = vi.fn()
const validateTurnstileForAPI = vi.fn()
const withdrawUserConsent = vi.fn()

vi.mock('../../../../src/lib/logger', () => ({
  getLogger: () => mockLogger,
}))

vi.mock('../../../../src/lib/cache', () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
  cacheSetNX: (...args: unknown[]) => cacheSetNX(...args),
  cacheDel: (...args: unknown[]) => cacheDel(...args),
}))

vi.mock('../../../../src/lib/turnstile', () => ({
  validateTurnstileForAPI: (...args: unknown[]) => validateTurnstileForAPI(...args),
}))

vi.mock('../../../../src/lib/google/sheets', () => ({
  withdrawUserConsent: (...args: unknown[]) => withdrawUserConsent(...args),
}))

vi.mock('../../../../src/lib/sentry', () => ({
  reportError: vi.fn(),
}))

vi.mock('../../../../src/lib/env', () => ({
  config: {
    TURNSTILE_SECRET_EFFECTIVE: undefined,
  },
}))

let postHandler: any

describe('POST /api/consents/withdraw', () => {
  const payload = {
    name: 'Sviatoslav Upirow',
    phone: '+48501748708',
    email: 'user@example.com',
    consentAcknowledged: true,
    turnstileToken: 'dev-token-12345',
  }

  function createRequest(body = payload) {
    return {
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      json: vi.fn().mockResolvedValue(body),
    } as unknown as Request
  }

  beforeAll(async () => {
    ;({ POST: postHandler } = await import('../../../../src/app/api/consents/withdraw/route'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    rateLimit.mockResolvedValue({ allowed: true })
    cacheSetNX.mockResolvedValue(true)
    cacheDel.mockResolvedValue(true)
    validateTurnstileForAPI.mockResolvedValue({ success: true })
    withdrawUserConsent.mockResolvedValue({ updated: true })
  })

  it('releases idempotency lock after successful withdrawal', async () => {
    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('accepted')
    expect(cacheDel).toHaveBeenCalledTimes(1)
    expect(withdrawUserConsent).toHaveBeenCalledTimes(1)
  })

  it('returns 202 without calling Sheets when request already in progress', async () => {
    cacheSetNX.mockResolvedValue(false)

    const response = await postHandler(createRequest())
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body.code).toBe('ALREADY_PROCESSING')
    expect(withdrawUserConsent).not.toHaveBeenCalled()
    expect(cacheDel).not.toHaveBeenCalled()
  })

  it('allows subsequent requests after successful withdrawal', async () => {
    const first = await postHandler(createRequest())
    expect(first.status).toBe(200)

    const second = await postHandler(createRequest())
    expect(second.status).toBe(200)

    expect(cacheSetNX).toHaveBeenCalledTimes(2)
    expect(withdrawUserConsent).toHaveBeenCalledTimes(2)
    expect(cacheDel).toHaveBeenCalledTimes(2)
  })
})
