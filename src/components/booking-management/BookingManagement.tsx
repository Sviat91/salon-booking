"use client"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import Card from '../ui/Card'
import PanelRenderer from './PanelRenderer'
// Removed server-side imports - logic moved to API
import type {
  BookingManagementRef,
  BookingResult,
  CalendarMode,
  ManagementState,
  ProcedureOption,
  SearchFormData,
  SlotSelection,
} from './types'
import { getTurnstileTokenWithSession, storeTurnstileSession } from '../../lib/turnstile-client'

interface BookingManagementProps {
  selectedDate?: Date
  selectedSlot?: SlotSelection | null
  procedureId?: string
  onProcedureChange?: (procedureId: string | undefined) => void
  onDateReset?: () => void
  onCalendarModeChange?: (mode: CalendarMode) => void
  onSlotSelected?: (slot: SlotSelection) => void
}

interface ProceduresResponse {
  items: ProcedureOption[]
}

interface SearchResultApi {
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

interface SearchResponseApi {
  results: SearchResultApi[]
}

interface MutationError {
  message: string
}

const BookingManagement = forwardRef<BookingManagementRef, BookingManagementProps>(
  (
    {
      selectedDate,
      selectedSlot,
      procedureId,
      onProcedureChange,
      onDateReset,
      onCalendarModeChange,
      onSlotSelected,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const [state, setState] = useState<ManagementState>('search')
    const [form, setForm] = useState<SearchFormData>({ fullName: '', phone: '', email: '' })
    const [formError, setFormError] = useState<string | null>(null)
    const [results, setResults] = useState<BookingResult[]>([])
    const [selectedBooking, setSelectedBooking] = useState<BookingResult | null>(null)
    const [selectedProcedure, setSelectedProcedure] = useState<ProcedureOption | null>(null)
    const [pendingSlot, setPendingSlot] = useState<SlotSelection | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [wasEditing, setWasEditing] = useState(false)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined
    const turnstileRef = useRef<HTMLDivElement | null>(null)

    const proceduresQuery = useQuery<ProceduresResponse>({
      queryKey: ['procedures'],
      queryFn: () => fetch('/api/procedures').then((res) => res.json() as Promise<ProceduresResponse>),
      staleTime: 10 * 60 * 1000,
    })
    const procedures = proceduresQuery.data?.items ?? []

    const resetForm = useCallback(() => {
      setForm({ fullName: '', phone: '', email: '' })
      setFormError(null)
      setResults([])
      setSelectedBooking(null)
      setSelectedProcedure(null)
      setPendingSlot(null)
      setActionError(null)
    }, [])

    useImperativeHandle(ref, () => ({
      close: () => {
        setIsOpen(false)
        setState('search')
        resetForm()
      },
    }))

    const splitFullName = useCallback((fullName: string) => {
      const trimmed = fullName.trim()
      if (!trimmed) {
        return { firstName: '', lastName: '' }
      }
      const parts = trimmed.split(/\s+/)
      return {
        firstName: parts[0] ?? '',
        lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
      }
    }, [])

    const deriveProcedureForBooking = useCallback(
      (booking: BookingResult | null): ProcedureOption | null => {
        if (!booking) return null
        if (booking.procedureId) {
          const byId = procedures.find((p) => p.id === booking.procedureId)
          if (byId) return byId
        }
        const byName = procedures.find((p) => p.name_pl === booking.procedureName)
        return byName ?? null
      },
      [procedures],
    )

    useEffect(() => {
      if (state === 'edit-datetime') {
        setWasEditing(true)
        onCalendarModeChange?.('editing')
        const targetProcedure = selectedProcedure ?? deriveProcedureForBooking(selectedBooking)
        if (targetProcedure && targetProcedure.id !== procedureId) {
          onProcedureChange?.(targetProcedure.id)
        }
      } else if (wasEditing) {
        setWasEditing(false)
        onCalendarModeChange?.('booking')
        onDateReset?.()
        setPendingSlot(null)
      }
    }, [
      state,
      wasEditing,
      onCalendarModeChange,
      deriveProcedureForBooking,
      selectedBooking,
      selectedProcedure,
      procedureId,
      onProcedureChange,
      onDateReset,
    ])

    const canSearch = useMemo(() => {
      const trimmedName = form.fullName.trim()
      const phoneDigits = form.phone.replace(/\D/g, '')
      const baseValid = trimmedName.length >= 2 && phoneDigits.length >= 9
      
      // Validation check for debugging
      // console.log('Validation check:', { trimmedName, phoneDigits, baseValid })
      
      if (!siteKey) return baseValid
      return baseValid && !!turnstileToken
    }, [form.fullName, form.phone, siteKey, turnstileToken])

    const mapApiResult = useCallback(
      (entry: SearchResultApi): BookingResult => {
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
      },
      [procedures],
    )

    const searchMutation = useMutation<SearchResponseApi, MutationError, { turnstileToken?: string }>({
      mutationFn: async ({ turnstileToken: providedToken } = {}) => {
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
        
        return {
          results: matchingBookings,
          totalFound: matchingBookings.length
        } as SearchResponseApi
      },
      onMutate: () => {
        setFormError(null)
        setState('loading')
        setSelectedBooking(null)
        setSelectedProcedure(null)
        setActionError(null)
      },
      onSuccess: (data) => {
        const mapped = data.results.map(mapApiResult)
        setResults(mapped)
        if (mapped.length === 0) {
          console.log('❌ No bookings found matching criteria')
          setState('not-found')
        } else {
          console.log(`🎯 Showing ${mapped.length} matching bookings`)
          setState('results')
        }
        setIsOpen(true)
      },
      onError: (error) => {
        console.error('❌ Booking search failed:', error.message)
        setFormError(`Nie udało się wyszukać rezerwacji: ${error.message}`)
        setState('search')
        // DO NOT reset form on error - keep user's input
      },
    })

    const updateMutation = useMutation<Response, MutationError, Partial<{ newProcedureId: string; newSlot: SlotSelection }>>({
      mutationFn: async (changes) => {
        if (!selectedBooking) {
          throw { message: 'Brak wybranej rezerwacji.' }
        }
        const token = getTurnstileTokenWithSession() ?? undefined
        const body: Record<string, unknown> = {
          turnstileToken: token,
          firstName: selectedBooking.firstName,
          lastName: selectedBooking.lastName,
          phone: selectedBooking.phone,
          email: selectedBooking.email || '',
        }
        if (changes.newProcedureId) {
          body.newProcedureId = changes.newProcedureId
        }
        if (changes.newSlot) {
          body.newStartISO = changes.newSlot.startISO
          body.newEndISO = changes.newSlot.endISO
        }
        const response = await fetch(`/api/bookings/${selectedBooking.eventId}`, {
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
          throw { message: detail }
        }
        return response
      },
      onSuccess: () => {
        setActionError(null)
        setState('results')
        setPendingSlot(null)
        const token = siteKey ? getTurnstileTokenWithSession() ?? turnstileToken ?? undefined : undefined
        if (token) setTurnstileToken(token)
        searchMutation.mutate({ turnstileToken: token ?? undefined })
      },
      onError: (error) => {
        setActionError(error.message)
      },
    })

    const cancelMutation = useMutation<Response, MutationError, void>({
      mutationFn: async () => {
        if (!selectedBooking) {
          throw { message: 'Brak wybranej rezerwacji.' }
        }
        
        // No Turnstile needed for cancellation - user was already verified during search
        const body = {
          eventId: selectedBooking.eventId,
          firstName: selectedBooking.firstName,
          phone: selectedBooking.phone,
          email: selectedBooking.email || '',
        }
        
        console.log('🔓 Cancelling without Turnstile (user already verified during search)')
        
        console.log('🗑️ Cancelling booking with eventId:', selectedBooking.eventId)
        
        const response = await fetch('/api/bookings/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        
        if (!response.ok) {
          let detail = 'Nie udało się anulować rezerwacji.'
          try {
            const json = (await response.json()) as { error?: string; code?: string }
            if (json?.error) {
              detail = json.error
            }
            
            // Improve error messages
            if (json?.code === 'BOOKING_NOT_FOUND') {
              detail = 'Rezerwacja nie została znaleziona. Spróbuj wyszukać ponownie.'
            } else if (json?.code === 'VERIFICATION_FAILED') {
              detail = 'Weryfikacja nie powiodła się. Sprawdź poprawność danych.'
            } else if (json?.code === 'TOO_LATE_TO_CANCEL') {
              detail = 'Nie można anulować rezerwacji mniej niż 24 godziny przed terminem.'
            }
          } catch {
            // ignore parsing errors
          }
          throw { message: detail }
        }
        
        return response
      },
      onSuccess: () => {
        setActionError(null)
        setState('results')
        setSelectedBooking(null)
        const token = siteKey ? getTurnstileTokenWithSession() ?? turnstileToken ?? undefined : undefined
        if (token) setTurnstileToken(token)
        searchMutation.mutate({ turnstileToken: token ?? undefined })
      },
      onError: (error) => {
        setActionError(error.message)
      },
    })

    const handleSearch = useCallback(() => {
      if (!canSearch) {
        if (!siteKey) {
          setFormError('Podaj imię, nazwisko i numer telefonu (min. 9 cyfr).')
        } else if (!turnstileToken) {
          setFormError('Potwierdź weryfikację Turnstile i spróbuj ponownie.')
        } else {
          setFormError('Podaj imię, nazwisko i numer telefonu (min. 9 cyfr).')
        }
        return
      }
      const token = siteKey ? getTurnstileTokenWithSession() ?? turnstileToken : undefined
      if (siteKey && !token) {
        setFormError('Potwierdź weryfikację Turnstile i spróbuj ponownie.')
        return
      }
      if (token) {
        setTurnstileToken(token)
      }
      searchMutation.mutate({ turnstileToken: token ?? undefined })
    }, [canSearch, searchMutation, siteKey, turnstileToken])

    const handleToggle = () => {
      if (isOpen) {
        setIsOpen(false)
        resetForm()
        setState('search')
      } else {
        setIsOpen(true)
        if (siteKey) {
          const token = getTurnstileTokenWithSession()
          if (token) {
            setTurnstileToken(token)
            setFormError(null)
          }
        }
      }
    }

    const handleSelectBooking = (booking: BookingResult | null) => {
      setSelectedBooking(booking)
      setSelectedProcedure(null)
      setPendingSlot(null)
      setActionError(null)
    }

    const handleStartEditProcedure = (booking: BookingResult) => {
      setSelectedBooking(booking)
      const procedure = deriveProcedureForBooking(booking)
      setSelectedProcedure(procedure)
      setPendingSlot(null)
      setActionError(null)
      setState('edit-procedure')
    }

    const handleConfirmSameTime = () => {
      if (!selectedBooking || !selectedProcedure) return
      setPendingSlot(null)
      setState('confirm-change')
    }

    const handleRequestNewTime = () => {
      setState('edit-datetime')
      setPendingSlot(null)
    }

    const handleCheckAvailability = () => {
      setState('edit-datetime')
      setPendingSlot(null)
    }

    const handleConfirmSlot = () => {
      if (!selectedSlot) return
      setPendingSlot(selectedSlot)
      if (onSlotSelected) {
        onSlotSelected(selectedSlot)
      }
      setState('confirm-change')
    }

    const handleBackToSearch = () => {
      setState('search')
      setActionError(null)
      setSelectedProcedure(null)
      setPendingSlot(null)
      resetForm()
    }

    const handleBackToResults = () => {
      setState(results.length === 0 ? 'not-found' : 'results')
      setActionError(null)
      setPendingSlot(null)
    }

    const handleContactMaster = useCallback(() => {
      console.log('Contact master')
    }, [])

    const handleStartNewSearch = useCallback(() => {
      resetForm()
      setState('search')
    }, [resetForm])

    const handleExtendSearch = useCallback(() => {
      console.log('Extended search requested')
    }, [])

    const handleBackToProcedure = () => {
      setState('edit-procedure')
      setActionError(null)
      setPendingSlot(null)
    }

    const handleConfirmChange = () => {
      if (!selectedBooking) return
      if (pendingSlot) {
        updateMutation.mutate({ newProcedureId: selectedProcedure?.id, newSlot: pendingSlot })
      } else if (selectedProcedure?.id) {
        updateMutation.mutate({ newProcedureId: selectedProcedure.id })
      } else {
        setActionError('Wybierz procedurę lub termin do zmiany.')
      }
    }

    const handleConfirmCancel = () => {
      cancelMutation.mutate()
    }

    const fallbackProcedure = deriveProcedureForBooking(selectedBooking)

    useEffect(() => {
      if (!siteKey) return

      const existing = getTurnstileTokenWithSession()
      if (existing) {
        setTurnstileToken(existing)
        return
      }

      const scriptId = 'cf-turnstile'
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }

      const interval = setInterval(() => {
        const turnstile = (window as any)?.turnstile
        if (turnstile && turnstileRef.current) {
          try {
            turnstileRef.current.innerHTML = ''
            turnstileRef.current.setAttribute('data-language', 'pl')
            turnstile.render(turnstileRef.current, {
              sitekey: siteKey,
              language: 'pl',
              callback: (token: string) => {
                setTurnstileToken(token)
                storeTurnstileSession(token)
                setFormError((prev) => (prev && prev.includes('Turnstile') ? null : prev))
              },
            })
            clearInterval(interval)
          } catch {
            // retry on next interval
          }
        }
      }, 200)

      return () => clearInterval(interval)
    }, [siteKey])

    return (
      <Card>
        <div className="space-y-3">
          <label className="block text-sm text-muted dark:text-dark-muted">Zarządzanie rezerwacją</label>
          <button
            type="button"
            onClick={handleToggle}
            className={`btn w-full ${isOpen ? 'btn-outline' : 'btn-primary'}`}
          >
            {isOpen ? 'Zamknij panel' : 'Kliknij, aby zarządzać rezerwacją'}
          </button>
          <div
            className={`overflow-hidden transition-all duration-200 ease-out ${
              isOpen ? 'max-h-[24rem] opacity-100 mt-2' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="rounded-xl border border-border bg-white/90 p-4 dark:border-dark-border dark:bg-dark-card/90">
              <PanelRenderer
                state={state}
                form={form}
                onFormChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
                canSearch={canSearch}
                searchPending={searchMutation.isPending}
                formError={formError}
                onSearch={handleSearch}
                turnstileNode={siteKey ? <div ref={turnstileRef} className="rounded-xl" /> : undefined}
                turnstileRequired={!!siteKey && !turnstileToken}
                results={results}
                selectedBooking={selectedBooking}
                onSelectBooking={handleSelectBooking}
                onChangeProcedure={handleStartEditProcedure}
                onCancelRequest={(booking) => {
                  setSelectedBooking(booking)
                  setActionError(null)
                  setState('confirm-cancel')
                }}
                selectedProcedure={selectedProcedure}
                procedures={procedures}
                onSelectProcedure={(procedure) => {
                  setSelectedProcedure(procedure)
                  setActionError(null)
                }}
                onBackToSearch={handleBackToSearch}
                onStartNewSearch={handleStartNewSearch}
                onContactMaster={handleContactMaster}
                onEditProcedureBack={handleBackToResults}
                onEditDatetimeBack={handleBackToProcedure}
                onConfirmSameTime={handleConfirmSameTime}
                onRequestNewTime={handleRequestNewTime}
                onExtendSearch={handleExtendSearch}
                onCheckAvailability={handleCheckAvailability}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                onConfirmSlot={handleConfirmSlot}
                fallbackProcedure={fallbackProcedure}
                pendingSlot={pendingSlot}
                confirmChangeSubmitting={updateMutation.isPending}
                confirmChangeError={actionError}
                onConfirmChange={handleConfirmChange}
                onConfirmChangeBack={() => {
                  setActionError(null)
                  if (pendingSlot) {
                    setState('edit-datetime')
                  } else {
                    handleBackToProcedure()
                  }
                }}
                cancelSubmitting={cancelMutation.isPending}
                cancelError={actionError}
                onConfirmCancel={handleConfirmCancel}
                onCancelBack={() => {
                  setActionError(null)
                  handleBackToResults()
                }}
              />
            </div>
          </div>
        </div>
      </Card>
    )
  },
)

BookingManagement.displayName = 'BookingManagement'
export default BookingManagement
