const defaultPrivateKey = '-----BEGIN PRIVATE KEY-----\nTESTKEY\n-----END PRIVATE KEY-----\n'

// @ts-expect-error - NODE_ENV is read-only, but we need to set it for tests
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON =
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  JSON.stringify({ client_email: 'test@example.com', private_key: defaultPrivateKey })
process.env.GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'test-calendar'
process.env.GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || 'test-sheet'
process.env.USER_CONSENTS_GOOGLE_SHEET_ID = process.env.USER_CONSENTS_GOOGLE_SHEET_ID || 'test-consents-sheet'
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://example.com'
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'token'
process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''
process.env.TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || ''
process.env.TURNSTILE_SECRET = process.env.TURNSTILE_SECRET || ''
process.env.SENTRY_DSN = process.env.SENTRY_DSN || ''
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent'