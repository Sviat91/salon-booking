import { google } from 'googleapis'
import { config } from '../env'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/spreadsheets', // For writing consents data
]

// Define the type explicitly to break the circular dependency.
export type GoogleClients = {
  auth: import('google-auth-library').JWT
  calendar: import('googleapis').calendar_v3.Calendar
  sheets: import('googleapis').sheets_v4.Sheets
}

let cached: GoogleClients | null = null

export function getClients(): GoogleClients {
  if (cached) return cached

  const jwt = new google.auth.JWT({
    email: config.GOOGLE_SERVICE_ACCOUNT.client_email,
    key: config.GOOGLE_SERVICE_ACCOUNT.private_key,
    scopes: SCOPES,
  })

  const calendar = google.calendar({ version: 'v3', auth: jwt })
  const sheets = google.sheets({ version: 'v4', auth: jwt })
  cached = { auth: jwt, calendar, sheets }
  return cached
}

