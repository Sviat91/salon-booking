import type {
  BookingResult,
  ProcedureOption,
  SearchFormData,
  SlotSelection,
} from '../types'

// API response interfaces
export interface SearchResultApi {
  eventId: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  procedureName: string
  startTime: string
  endTime: string
  price: number
  canModify: boolean
  canCancel: boolean
}

export interface SearchResponseApi {
  results: SearchResultApi[]
  totalFound?: number
}

export interface ProceduresResponse {
  items: ProcedureOption[]
}

export interface ApiError {
  message: string
  code?: string
}

// Utility functions
export function splitFullName(fullName: string) {
  const trimmed = fullName.trim()
  if (!trimmed) {
    return { firstName: '', lastName: '' }
  }
  const parts = trimmed.split(/\s+/)
  return {
    firstName: parts[0] ?? '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  }
}

export function mapApiResult(entry: SearchResultApi, procedures: ProcedureOption[]): BookingResult {
  const start = new Date(entry.startTime)
  const end = new Date(entry.endTime)
  const durationMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000))
  const matchedProcedure = procedures.find((proc) => proc.name_pl === entry.procedureName)
  
  return {
    eventId: entry.eventId,
    procedureName: entry.procedureName,
    procedureId: matchedProcedure?.id,
    procedureDurationMin: durationMin,
    startTime: start,
    endTime: end,
    price: entry.price,
    canModify: entry.canModify,
    canCancel: entry.canCancel,
    firstName: entry.firstName,
    lastName: entry.lastName,
    phone: entry.phone,
    email: entry.email,
  }
}

// API Functions
export async function fetchProcedures(): Promise<ProceduresResponse> {
  const response = await fetch('/api/procedures')
  if (!response.ok) {
    throw new Error('Nie udało się pobrać listy procedur')
  }
  return response.json()
}

export async function searchBookings(
  form: SearchFormData,
  procedures: ProcedureOption[],
  turnstileToken?: string,
): Promise<BookingResult[]> {
  const { firstName, lastName } = splitFullName(form.fullName)
  
  console.log('🔍 Searching for:', { firstName, lastName, phone: form.phone })

  // Fetch ALL calendar events for the period, then filter on client
  // Add force=true to bypass cache for new searches
  const response = await fetch('/api/bookings/all?force=true')
  
  if (!response.ok) {
    throw new Error('Nie udało się pobrać danych z kalendarza')
  }
  
  const allBookingsData = await response.json()
  console.log(`📅 Fetched ${allBookingsData.count} bookings (cached: ${allBookingsData.cached})`)
  
  const allBookings = allBookingsData.bookings || []
  
  // Filter bookings with strict matching rules to prevent showing foreign bookings
  const matchingBookings = allBookings.filter((booking: any) => {
    // Normalize search data
    const searchFirstName = firstName.toLowerCase().trim()
    const searchLastName = lastName.toLowerCase().trim()  
    const searchPhone = form.phone.replace(/\D/g, '')
    const searchEmail = form.email ? form.email.toLowerCase().trim() : ''
    
    // Normalize booking data
    const bookingFirstName = booking.firstName.toLowerCase().trim()
    const bookingLastName = booking.lastName.toLowerCase().trim()
    const bookingPhone = booking.phone.replace(/\D/g, '')
    const bookingEmail = booking.email ? booking.email.toLowerCase().trim() : ''
    
    // SECURITY-FIRST MATCHING RULES:
    
    // 1. First name must match exactly
    const firstNameMatch = bookingFirstName === searchFirstName
    if (!firstNameMatch) return false
    
    // 2. STRICT FULL NAME MATCHING to prevent showing foreign bookings
    const searchHasLastName = searchLastName.length > 0
    const bookingHasLastName = bookingLastName.length > 0
    
    let fullNameMatch = false
    
    if (searchHasLastName && bookingHasLastName) {
      // Both have last names - must match exactly
      fullNameMatch = searchLastName === bookingLastName
    } else if (!searchHasLastName && !bookingHasLastName) {
      // Both have only first names - already checked above
      fullNameMatch = true
    } else {
      // One has last name, other doesn't - NO MATCH by default
      // This prevents "Natalia" from seeing "Natalia Kowalska" bookings
      fullNameMatch = false
    }
    
    // 3. Phone number must match (last 9 digits)
    let phoneMatch = false
    if (searchPhone.length >= 9 && bookingPhone.length >= 9) {
      phoneMatch = bookingPhone.slice(-9) === searchPhone.slice(-9)
    }
    
    // 4. Email verification (exact match if provided)
    let emailMatch = true
    if (searchEmail && bookingEmail) {
      emailMatch = bookingEmail === searchEmail
    } else if (searchEmail && !bookingEmail) {
      emailMatch = false
    }
    
    // 5. MAIN SECURITY RULE: Full name structure + phone must match
    if (fullNameMatch && phoneMatch) {
      return true
    }
    
    // 6. EXCEPTION: Email as additional verification allows name structure mismatch
    // Only if email is provided and matches exactly + either name or phone matches
    if (searchEmail && emailMatch) {
      if (firstNameMatch && phoneMatch) {
        return true // Name + Phone + Email = OK even if lastName structure differs
      }
      if (fullNameMatch) {
        return true // Full name + Email = OK even if phone partial
      }
    }
    
    return false
  })
  
  console.log(`✅ Found ${matchingBookings.length} matching bookings`)
  
  return matchingBookings.map((booking: SearchResultApi) => mapApiResult(booking, procedures))
}

export async function updateBooking(
  booking: BookingResult,
  changes: {
    newProcedureId?: string
    newSlot?: SlotSelection
  },
  turnstileToken?: string, // Not used anymore - kept for compatibility
): Promise<{ startTime?: string; endTime?: string; procedure?: string }> {
  // NO USER DATA - user already validated during search
  // We trust the eventId and only send changes
  const body: Record<string, unknown> = {}
  
  if (changes.newProcedureId) {
    body.newProcedureId = changes.newProcedureId
  }
  
  if (changes.newSlot) {
    body.newStartISO = changes.newSlot.startISO
    body.newEndISO = changes.newSlot.endISO
  }
  
  const response = await fetch(`/api/bookings/${booking.eventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  
  if (!response.ok) {
    let detail = 'Nie udało się zaktualizować rezerwacji.'
    try {
      const json = (await response.json()) as { error?: string }
      if (json?.error) detail = json.error
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  
  // Return new booking data from API response
  const result = await response.json()
  return result.changes || {}
}

// Проверка возможности увеличения длительности процедуры
// NO TURNSTILE - user already verified during search
export async function checkProcedureExtension(
  booking: BookingResult,
  newProcedureId: string,
): Promise<{
  result: {
    status: 'can_extend' | 'can_shift_back' | 'no_availability'
    message: string
    suggestedStartISO?: string
    suggestedEndISO?: string
    alternativeSlots?: Array<{ startISO: string; endISO: string }>
  }
  currentBooking: {
    startISO: string
    endISO: string
  }
  newProcedure: {
    id: string
    name: string
    duration: number
  }
}> {
  console.log('🔍 Checking procedure extension availability (no Turnstile):', {
    eventId: booking.eventId,
    newProcedureId,
  })

  const body = {
    eventId: booking.eventId,
    currentStartISO: booking.startTime.toISOString(),
    currentEndISO: booking.endTime.toISOString(),
    newProcedureId,
  }

  const response = await fetch(`/api/bookings/${booking.eventId}/check-extension`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let detail = 'Nie udało się sprawdzić dostępności.'
    try {
      const json = (await response.json()) as { error?: string }
      if (json?.error) detail = json.error
    } catch {
      // ignore
    }
    throw new Error(detail)
  }

  return await response.json()
}

// Простая функция для изменения процедуры - без валидации
export async function updateBookingProcedure(
  booking: BookingResult,
  newProcedureId: string,
  turnstileToken?: string,
): Promise<void> {
  console.log('🔄 Updating booking procedure:', {
    eventId: booking.eventId,
    oldProcedure: booking.procedureName,
    newProcedureId,
  })

  // Payload с данными для сохранения (не для валидации)
  const body = {
    turnstileToken,
    eventId: booking.eventId,
    // Данные клиента для сохранения в записи
    firstName: booking.firstName,
    lastName: booking.lastName,
    phone: booking.phone,
    email: booking.email || '',
    // Текущее время начала (для расчёта нового времени окончания)
    currentStartISO: booking.startTime.toISOString(),
    // Новая процедура
    newProcedureId,
  }
  
  const response = await fetch('/api/bookings/update-procedure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  
  if (!response.ok) {
    let detail = 'Nie udało się zaktualizować procedury rezerwacji.'
    try {
      const json = (await response.json()) as { error?: string }
      if (json?.error) detail = json.error
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
}

// Простая функция только для изменения времени - чистая архитектура
export async function updateBookingTime(
  booking: BookingResult,
  newSlot: SlotSelection,
  turnstileToken?: string,
): Promise<void> {
  console.log('🔄 Updating booking time:', {
    eventId: booking.eventId,
    oldTime: `${booking.startTime.toISOString()} - ${booking.endTime.toISOString()}`,
    newTime: `${newSlot.startISO} - ${newSlot.endISO}`,
  })

  // Payload с данными для сохранения (не для валидации)
  const body = {
    turnstileToken,
    eventId: booking.eventId,
    // Данные для сохранения в записи
    procedureName: booking.procedureName,
    firstName: booking.firstName,
    lastName: booking.lastName,
    phone: booking.phone,
    email: booking.email || '',
    price: booking.price,
    // Новое время
    newStartISO: newSlot.startISO,
    newEndISO: newSlot.endISO,
  }
  
  const response = await fetch('/api/bookings/update-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  
  if (!response.ok) {
    let detail = 'Nie udało się zaktualizować terminu rezerwacji.'
    try {
      const json = (await response.json()) as { error?: string }
      if (json?.error) detail = json.error
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  
  console.log('✅ Booking time updated successfully')
}

export async function cancelBooking(booking: BookingResult): Promise<void> {
  // No Turnstile needed for cancellation - user was already verified during search
  const body = {
    eventId: booking.eventId,
    firstName: booking.firstName,
    phone: booking.phone,
    email: booking.email || '',
  }
  
  console.log('🔓 Cancelling without Turnstile (user already verified during search)')
  console.log('🗑️ Cancelling booking with eventId:', booking.eventId)
  
  const response = await fetch('/api/bookings/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  
  if (!response.ok) {
    let detail = 'Nie udało się anulować rezerwacji.'
    const status = response.status
    try {
      const json = (await response.json()) as { error?: string; code?: string }
      if (json?.error) {
        detail = json.error
      }
      // HTTP status specific mapping
      if (status === 429) {
        detail = 'Zbyt wiele prób. Poczekaj 5 minut i spróbuj ponownie.'
      }
      // Improve code-based messages
      if (json?.code === 'BOOKING_NOT_FOUND') {
        detail = 'Rezerwacja nie została znaleziona. Spróbuj wyszukać ponownie.'
      } else if (json?.code === 'VERIFICATION_FAILED') {
        detail = 'Weryfikacja nie powiodła się. Sprawdź poprawność danych.'
      } else if (json?.code === 'TOO_LATE_TO_CANCEL') {
        detail = 'Nie można anulować rezerwacji mniej niż 24 godziny przed terminem.'
      } else if (json?.code === 'RATE_LIMITED' || json?.code === 'TOO_MANY_REQUESTS') {
        detail = 'Zbyt wiele prób. Poczekaj 5 minut i spróbuj ponownie.'
      }
    } catch {
      // ignore parsing errors
      if (status === 429) {
        detail = 'Zbyt wiele prób. Poczekaj 5 minut i spróbuj ponownie.'
      }
    }
    throw new Error(detail)
  }
}
