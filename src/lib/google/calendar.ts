import { getClients } from './auth'
import { config } from '../env'

export type BusyInterval = { start: string; end: string } // ISO strings

export async function freeBusy(timeMin: string, timeMax: string) {
  const { calendar } = getClients()
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: 'Europe/Warsaw',
      items: [{ id: config.GOOGLE_CALENDAR_ID }],
    },
  })
  const cal = res.data.calendars?.[config.GOOGLE_CALENDAR_ID]
  const busy = (cal?.busy ?? []) as BusyInterval[]
  return busy
}

export async function createEvent(params: {
  startISO: string
  endISO: string
  summary: string
  description?: string
  attendees?: { email: string }[]
}) {
  const { calendar } = getClients()
  const res = await calendar.events.insert({
    calendarId: config.GOOGLE_CALENDAR_ID,
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
