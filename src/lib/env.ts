import { z } from 'zod'

// Support raw JSON or base64-encoded JSON for Google credentials
function parseServiceAccount(jsonOrB64: string) {
  const tryParse = (s: string) => {
    try { return JSON.parse(s) } catch { return null }
  }

  const raw = jsonOrB64.trim()
  const asJson = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  const parsed = tryParse(asJson)
  if (!parsed) throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON: not JSON or base64 JSON')
  return parsed as {
    client_email: string
    private_key: string
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  GOOGLE_APPLICATION_CREDENTIALS_JSON: z.string(),
  GOOGLE_CALENDAR_ID: z.string(),
  GOOGLE_SHEET_ID: z.string(),
  USER_CONSENTS_GOOGLE_SHEET_ID: z.string(),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  N8N_WEBHOOK_URL: z.string().url().optional(),
  N8N_SECRET_TOKEN: z.string().optional(),
  N8N_SECRET_HEADER: z.string().default('x-secret-token'),
})

const env = EnvSchema.parse(process.env)

export const config = {
  ...env,
  TURNSTILE_SECRET_EFFECTIVE: env.TURNSTILE_SECRET || env.TURNSTILE_SECRET_KEY,
  GOOGLE_SERVICE_ACCOUNT: parseServiceAccount(env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
  SHEET_TABS: {
    WEEKLY: 'Weekly',
    EXCEPTIONS: 'Exceptions',
    PROCEDURES: 'PROCEDURES',
  },
} as const

export type AppConfig = typeof config

