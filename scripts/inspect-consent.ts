import fs from 'node:fs'
import path from 'node:path'

(function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx <= 0) return
    const key = trimmed.slice(0, eqIdx)
    const value = trimmed.slice(eqIdx + 1)
    if (!(key in process.env)) {
      process.env[key] = value
    }
  })
})()

function mask(value: string | undefined) {
  if (!value) return ''
  const v = value.replace(/\s+/g, '')
  if (v.length <= 4) return '*'.repeat(v.length)
  return `${v.slice(0, 3)}***${v.slice(-2)}`
}

function maskEmail(value: string | undefined) {
  if (!value) return ''
  const trimmed = value.trim()
  const [local, domain] = trimmed.split('@')
  if (!domain) return mask(trimmed)
  if (local.length <= 2) return `**@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}

function maskName(value: string | undefined) {
  if (!value) return ''
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => (part.length ? `${part[0]}***` : ''))
    .join(' ')
}

async function run() {
  const [{ getClients }, { config }] = await Promise.all([
    import('../src/lib/google/auth'),
    import('../src/lib/env'),
  ])

  const { sheets } = getClients()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.USER_CONSENTS_GOOGLE_SHEET_ID,
    range: 'A1:O20',
  })

  const rows = res.data.values ?? []
  if (!rows.length) {
    console.log('No rows returned')
    return
  }

  const [header, ...data] = rows
  console.log('Header columns:', header)
  console.log('Sample rows (masked):')
  data.slice(0, 5).forEach((row, idx) => {
    const masked = row.map((cell, colIdx) => {
      const value = String(cell ?? '')
      if (colIdx === 0) return mask(value)
      if (colIdx === 1) return maskEmail(value)
      if (colIdx === 2) return maskName(value)
      return value
    })
    console.log(idx + 1, masked)
  })
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
