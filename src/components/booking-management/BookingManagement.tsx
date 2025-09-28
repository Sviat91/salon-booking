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
        const normalizedPhone = form.phone.replace(/\D/g, '')
        const normalizedName = form.fullName.trim().toLowerCase()
        const shouldMock =
          normalizedName.includes('test') ||
          normalizedPhone.includes('123')

        if (shouldMock) {
          const now = new Date()
          const makeSlot = (
            id: string,
            addHours: number,
            durationMin: number,
            overrides?: { canModify?: boolean; price?: number; procedureName?: string }
          ) => {
            const start = new Date(now.getTime() + addHours * 60 * 60 * 1000)
            const end = new Date(start.getTime() + durationMin * 60 * 1000)
            return {
              eventId: id,
              firstName,
              lastName,
              phone: form.phone,
              email: form.email || undefined,
              procedureName: overrides?.procedureName ?? 'Masaż relaksacyjny twarzy',
              startTime: start.toISOString(),
              endTime: end.toISOString(),
              price: overrides?.price ?? 150,
              canModify: overrides?.canModify ?? true,
              canCancel: overrides?.canModify ?? true,
            }
          }

          return {
            results: [
              makeSlot('mock-1', 48, 75),
              makeSlot('mock-2', 120, 90, { price: 180, procedureName: 'Masaż Kobido' }),
              makeSlot('mock-3', 12, 60, { canModify: false, procedureName: 'Masaż lifting twarzy' }),
            ],
          }
        }

        const payload = {
          firstName,
          lastName,
          phone: form.phone,
          email: form.email || undefined,
          turnstileToken: providedToken ?? undefined,
        }
        const response = await fetch('/api/bookings/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          let detail = 'Nie udało się wyszukać rezerwacji.'
          try {
            const body = (await response.json()) as { error?: string }
            if (body?.error) {
              detail = body.error
            }
          } catch {
            // swallow
          }
          throw { message: detail }
        }
        return (await response.json()) as SearchResponseApi
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
          setState('not-found')
        } else {
          setState('results')
        }
        setIsOpen(true)
      },
      onError: (error) => {
        console.error('Booking search failed', error)
        setFormError('Nie udało się wyszukać rezerwacji. Spróbuj ponownie.')
        setState('search')
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
        const token = getTurnstileTokenWithSession() ?? undefined
        const body = {
          turnstileToken: token,
          firstName: selectedBooking.firstName,
          lastName: selectedBooking.lastName,
          phone: selectedBooking.phone,
          email: selectedBooking.email || '',
        }
        const response = await fetch(`/api/bookings/${selectedBooking.eventId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!response.ok) {
          let detail = 'Nie udało się anulować rezerwacji.'
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
