import { getClients } from './auth'
import { getMasterCalendarIdSafe } from '@/config/masters.server'

export type BusyInterval = { start: string; end: string; id?: string } // ISO strings

export interface BookingData {
  firstName: string
  lastName: string
  phone: string
  email?: string
  price: number
  procedureName: string
  startTime: Date
  endTime: Date
  eventId: string
}

export async function freeBusy(timeMin: string, timeMax: string, masterId?: string) {
  const { calendar } = getClients()
  const calendarId = getMasterCalendarIdSafe(masterId)
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: 'Europe/Warsaw',
      items: [{ id: calendarId }],
    },
  })
  const cal = res.data.calendars?.[calendarId]
  const busy = (cal?.busy ?? []) as BusyInterval[]
  return busy
}

/**
 * Get detailed busy times with event IDs for a date range
 * This is more detailed than freeBusy() and includes event IDs
 */
export async function getBusyTimesWithIds(timeMin: string, timeMax: string, masterId?: string): Promise<BusyInterval[]> {
  const { calendar } = getClients()
  const calendarId = getMasterCalendarIdSafe(masterId)
  const res = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    timeZone: 'Europe/Warsaw',
    singleEvents: true,
    orderBy: 'startTime',
  })
  
  const events = res.data.items ?? []
  return events
    .filter(event => event.start?.dateTime && event.end?.dateTime)
    .map(event => ({
      start: event.start!.dateTime!,
      end: event.end!.dateTime!,
      id: event.id ?? undefined,
    }))
}

export async function createEvent(params: {
  startISO: string
  endISO: string
  summary: string
  description?: string
  attendees?: { email: string }[]
  masterId?: string
}) {
  const { calendar } = getClients()
  const calendarId = getMasterCalendarIdSafe(params.masterId)
  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startISO, timeZone: 'Europe/Warsaw' },
      end: { dateTime: params.endISO, timeZone: 'Europe/Warsaw' },
      attendees: params.attendees,
    },
  })
  return res.data
}

/**
 * Parses booking data from Google Calendar event
 * Supports both old and new formats for backward compatibility
 */
export function parseBookingData(event: any): BookingData | null {
  if (!event || !event.id || !event.start?.dateTime || !event.end?.dateTime) {
    return null
  }

  const summary = event.summary || ''
  const description = event.description || ''
  
  // Parse start and end times
  const startTime = new Date(event.start.dateTime)
  const endTime = new Date(event.end.dateTime)
  
  let firstName = ''
  let lastName = ''
  let phone = ''
  let email = ''
  let price = 0
  let procedureName = ''

  // Try to parse new format first
  if (description.includes('Imię Nazwisko:')) {
    // New format parsing
    const lines = description.split('\n')
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      if (trimmedLine.startsWith('Imię Nazwisko:')) {
        const fullName = trimmedLine.replace('Imię Nazwisko:', '').trim()
        const nameParts = fullName.split(' ')
        firstName = nameParts[0] || ''
        lastName = nameParts.slice(1).join(' ') || ''
      } else if (trimmedLine.startsWith('Telefon:')) {
        phone = trimmedLine.replace('Telefon:', '').trim()
      } else if (trimmedLine.startsWith('Email:')) {
        email = trimmedLine.replace('Email:', '').trim()
      } else if (trimmedLine.startsWith('Cena:')) {
        const priceMatch = trimmedLine.match(/Cena:\s*(\d+)zł/)
        if (priceMatch) {
          price = parseInt(priceMatch[1], 10) || 0
        }
      }
    }
    
    // In new format, summary is the procedure name
    procedureName = summary
  } else {
    // Old format parsing for backward compatibility
    if (summary.includes('Booking:')) {
      // Format: "Booking: [name]"
      const nameMatch = summary.match(/Booking:\s*(.+)/)
      if (nameMatch) {
        const fullName = nameMatch[1].trim()
        const nameParts = fullName.split(' ')
        firstName = nameParts[0] || ''
        lastName = nameParts.slice(1).join(' ') || ''
      }
      procedureName = 'Unknown procedure' // Old format doesn't specify procedure
    } else if (summary.includes('\u0007')) {
      // Format: "[procedure] [separator] [name]"
      const parts = summary.split('\u0007')
      if (parts.length >= 2) {
        procedureName = parts[0].trim()
        const fullName = parts[1].trim()
        const nameParts = fullName.split(' ')
        firstName = nameParts[0] || ''
        lastName = nameParts.slice(1).join(' ') || ''
      }
    }
    
    // Parse old format description: "Phone: [phone]\nEmail: [email]"
    const phoneMatch = description.match(/Phone:\s*(.+?)(?:\n|$)/)
    if (phoneMatch) {
      phone = phoneMatch[1].trim()
    }
    
    const emailMatch = description.match(/Email:\s*(.+?)(?:\n|$)/)
    if (emailMatch) {
      email = emailMatch[1].trim()
    }
  }

  // Normalize data for searching
  const normalizedFirstName = firstName.toLowerCase().trim()
  const normalizedLastName = lastName.toLowerCase().trim()
  const normalizedPhone = phone.replace(/\D/g, '') // Remove all non-digits

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    phone: normalizedPhone,
    email: email || undefined,
    price,
    procedureName,
    startTime,
    endTime,
    eventId: event.id,
  }
}
