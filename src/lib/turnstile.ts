import { config } from './env'

export async function verifyTurnstile(token: string | undefined | null, remoteIp?: string | null) {
  if (!config.TURNSTILE_SECRET_EFFECTIVE) return { ok: true } // disabled
  if (!token) return { ok: false, code: 'NO_TOKEN' as const }
  try {
    const form = new URLSearchParams()
    form.set('secret', config.TURNSTILE_SECRET_EFFECTIVE)
    form.set('response', token)
    if (remoteIp) form.set('remoteip', remoteIp)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const data = await res.json() as { success?: boolean; "error-codes"?: string[] }
    return { ok: !!data.success, code: data.success ? undefined : (data["error-codes"]?.[0] || 'VERIFY_FAILED') }
  } catch {
    // In doubt, fail closed only when Turnstile is enabled but network failed
    return { ok: false, code: 'VERIFY_ERROR' as const }
  }
}

