import * as Sentry from '@sentry/nextjs'
import type { SeverityLevel } from '@sentry/nextjs'
import { config } from './env'

const sentryEnabled = Boolean(config.SENTRY_DSN)

if (sentryEnabled && !Sentry.getCurrentHub().getClient()) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
    enableTracing: false,
  })
}

export type CaptureContext = {
  tags?: Record<string, string>
  extras?: Record<string, unknown>
  level?: SeverityLevel
}

export function captureException(error: unknown, context?: CaptureContext) {
  if (!sentryEnabled) return

  Sentry.withScope(scope => {
    if (context?.level) scope.setLevel(context.level)

    const tags = context?.tags ?? {}
    const extras = context?.extras ?? {}

    if (!tags.module) scope.setTag('module', 'unspecified')
    for (const [key, value] of Object.entries(tags)) {
      scope.setTag(key, value)
    }

    for (const [key, value] of Object.entries(extras)) {
      scope.setExtra(key, value)
    }

    Sentry.captureException(error)
  })
}

export async function reportError(error: unknown, context?: CaptureContext, flushTimeout = 500) {
  if (!sentryEnabled) return

  captureException(error, context)
  try {
    await Sentry.flush(flushTimeout)
  } catch {
    /* noop */
  }
}

export { sentryEnabled }