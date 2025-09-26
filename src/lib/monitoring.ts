import { getLogger } from './logger'
import { reportError } from './sentry'

const log = getLogger({ module: 'monitoring' })

interface MetricEvent {
  event: string
  value?: number
  tags?: Record<string, string>
  extras?: Record<string, any>
}

export async function trackMetric(metric: MetricEvent) {
  const { event, value = 1, tags = {}, extras = {} } = metric
  
  // Log metric for analysis
  log.info({
    metric: event,
    value,
    tags,
    extras,
    timestamp: new Date().toISOString(),
  }, `Metric: ${event}`)
  
  // Critical metrics to Sentry for alerting
  const criticalEvents = [
    'gdpr.export.failed',
    'gdpr.erasure.failed', 
    'contact.form.delivery.failed',
    'rate.limit.exceeded.severe'
  ]
  
  if (criticalEvents.includes(event)) {
    await reportError(new Error(`Critical metric: ${event}`), {
      level: 'warning',
      tags: { metric: event, ...tags },
      extras: { value, ...extras }
    })
  }
}

// Usage examples in API routes:
export const Metrics = {
  // GDPR Events
  gdprExportSuccess: (data: { requestId: string, recordCount: number }) =>
    trackMetric({ event: 'gdpr.export.success', value: data.recordCount, tags: { requestId: data.requestId } }),
    
  gdprExportFailed: (error: string, requestId: string) =>
    trackMetric({ event: 'gdpr.export.failed', tags: { error, requestId } }),
    
  gdprErasureSuccess: (data: { requestId: string, recordCount: number }) =>
    trackMetric({ event: 'gdpr.erasure.success', value: data.recordCount, tags: { requestId: data.requestId } }),
    
  // Contact Form Events  
  contactFormSuccess: (subject: string) =>
    trackMetric({ event: 'contact.form.success', tags: { subject } }),
    
  contactFormFailed: (error: string, attempt: number) =>
    trackMetric({ event: 'contact.form.delivery.failed', tags: { error, attempt: attempt.toString() } }),
    
  // Rate Limiting
  rateLimitHit: (endpoint: string, ip: string) =>
    trackMetric({ event: 'rate.limit.hit', tags: { endpoint, ip: ip.slice(0, 7) + 'xxx' } }),
    
  // Performance
  apiResponseTime: (endpoint: string, duration: number) =>
    trackMetric({ event: 'api.response.time', value: duration, tags: { endpoint } }),
}
