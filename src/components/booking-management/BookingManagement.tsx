"use client"
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
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
import { getTurnstileTokenWithSession } from '../../lib/turnstile-client'

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

    const proceduresQuery = useQuery<ProceduresResponse>({
      queryKey: ['procedures'],
      queryFn: () => fetch('/api/procedures').then((res) => res.json() as Promise<ProceduresResponse>),
      staleTime: 10 * 60 * 1000,
    })
    const procedures = proceduresQuery.data?.items ?? []

    useImperativeHandle(ref, () => ({
      close: () => setIsOpen(false),
    }))

    const splitFullName = useCallback((fullName: string) => {
      const trimmed = fullName.trim()
      if (!trimmed) {
        return { firstName: '', lastName: '' }
      }
      const parts = trimmed.split(/\s+/)
      if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' }
      }
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
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
      const { firstName, lastName } = splitFullName(form.fullName)
      const phoneDigits = form.phone.replace(/\D/g, '')
      return firstName.length >= 2 && lastName.length >= 2 && phoneDigits.length >= 9
    }, [form.fullName, form.phone, splitFullName])

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

    const searchMutation = useMutation<SearchResponseApi, MutationError, void>({
      mutationFn: async () => {
        const { firstName, lastName } = splitFullName(form.fullName)
        const payload = {
          firstName,
          lastName,
          phone: form.phone,
          email: form.email || undefined,
          turnstileToken: getTurnstileTokenWithSession() ?? undefined,
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
        setFormError(error.message)
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
        searchMutation.mutate()
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
        searchMutation.mutate()
      },
      onError: (error) => {
        setActionError(error.message)
      },
    })

    const handleSearch = useCallback(() => {
      if (!canSearch) {
        setFormError('Podaj imię, nazwisko i numer telefonu (min. 9 cyfr).')
        return
      }
      searchMutation.mutate()
    }, [canSearch, searchMutation])

    const handleToggle = () => {
      if (isOpen) {
        setIsOpen(false)
      } else {
        setIsOpen(true)
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
    }

    const handleBackToResults = () => {
      setState(results.length === 0 ? 'not-found' : 'results')
      setActionError(null)
      setPendingSlot(null)
    }

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
                onEditProcedureBack={handleBackToResults}
                onEditDatetimeBack={handleBackToProcedure}
                onConfirmSameTime={handleConfirmSameTime}
                onRequestNewTime={handleRequestNewTime}
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
