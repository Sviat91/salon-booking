"use client"
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react'
import Card from '../ui/Card'
import { useMutation, useQuery } from '@tanstack/react-query'
import PanelRenderer from './PanelRenderer'
import { useBookingManagementState } from './state/useBookingManagementState'
import { useTurnstileSession } from './hooks/useTurnstileSession'
import {
  fetchProcedures,
  searchBookings,
  updateBookingTime,
  updateBooking,
  cancelBooking,
} from './api/bookingManagementApi'
import type { ProceduresResponse } from './api/bookingManagementApi'
import { getTurnstileTokenWithSession } from '../../lib/turnstile-client'
import type {
  BookingManagementRef,
  CalendarMode,
  SlotSelection,
  ProcedureOption,
} from './types'

interface BookingManagementProps {
  selectedDate?: Date
  selectedSlot?: SlotSelection | null
  procedureId?: string
  onProcedureChange?: (procedureId: string | undefined) => void
  onDateReset?: () => void
  onCalendarModeChange?: (mode: CalendarMode) => void
  onSlotSelected?: (slot: SlotSelection) => void
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
    // Initialize state management and turnstile
    const { state, actions } = useBookingManagementState()
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined
    const turnstileSession = useTurnstileSession(siteKey)

    // Fetch procedures
    const proceduresQuery = useQuery<ProceduresResponse>({
      queryKey: ['procedures'],
      queryFn: fetchProcedures,
      staleTime: 10 * 60 * 1000,
    })
    const procedures = proceduresQuery.data?.items ?? []

    // Imperative handle for parent component
    useImperativeHandle(ref, () => ({
      close: actions.closePanel,
    }))

    // Utility function for procedure derivation
    const deriveProcedureForBooking = useCallback(
      (booking: typeof state.selectedBooking) => {
        if (!booking) return null
        if (booking.procedureId) {
          const byId = procedures.find((p: ProcedureOption) => p.id === booking.procedureId)
          if (byId) return byId
        }
        const byName = procedures.find((p: ProcedureOption) => p.name_pl === booking.procedureName)
        return byName ?? null
      },
      [procedures],
    )

    // Calendar mode synchronization
    useEffect(() => {
      if (state.state === 'edit-datetime') {
        actions.setWasEditing(true)
        onCalendarModeChange?.('editing')
        const targetProcedure = state.selectedProcedure ?? deriveProcedureForBooking(state.selectedBooking)
        if (targetProcedure && targetProcedure.id !== procedureId) {
          onProcedureChange?.(targetProcedure.id)
        }
      } else if (state.wasEditing) {
        actions.setWasEditing(false)
        onCalendarModeChange?.('booking')
        onDateReset?.()
        actions.setPendingSlot(null)
      }
    }, [
      state.state,
      state.wasEditing,
      state.selectedBooking,
      state.selectedProcedure,
      onCalendarModeChange,
      deriveProcedureForBooking,
      procedureId,
      onProcedureChange,
      onDateReset,
      actions,
    ])

    // Form validation
    const canSearch = useMemo(() => {
      const trimmedName = state.form.fullName.trim()
      const phoneDigits = state.form.phone.replace(/\D/g, '')
      const baseValid = trimmedName.length >= 2 && phoneDigits.length >= 9
      
      if (!siteKey) return baseValid
      return baseValid && !!turnstileSession.turnstileToken
    }, [state.form.fullName, state.form.phone, siteKey, turnstileSession.turnstileToken])

    // Search mutation
    const searchMutation = useMutation<typeof state.results, MutationError, { turnstileToken?: string }>({
      mutationFn: async ({ turnstileToken: providedToken } = {}) => {
        return searchBookings(state.form, procedures, providedToken)
      },
      onMutate: () => {
        actions.startSearch()
      },
      onSuccess: (results) => {
        actions.handleSearchSuccess(results)
      },
      onError: (error) => {
        actions.handleSearchError(`Nie udało się wyszukać rezerwacji: ${error.message}`)
      },
    })

    // Update mutation
    const updateMutation = useMutation<void, MutationError, { newProcedureId?: string; newSlot?: SlotSelection }>({
      mutationFn: async (changes) => {
        if (!state.selectedBooking) {
          throw new Error('Brak wybranej rezerwacji.')
        }
        const token = getTurnstileTokenWithSession()
        await updateBooking(state.selectedBooking, changes, token || undefined)
      },
      onSuccess: () => {
        actions.setActionError(null)
        actions.setState('results')
        actions.setPendingSlot(null)
        const token = siteKey ? getTurnstileTokenWithSession() ?? turnstileSession.turnstileToken ?? undefined : undefined
        if (token) turnstileSession.setTurnstileToken(token)
        searchMutation.mutate({ turnstileToken: token ?? undefined })
      },
      onError: (error) => {
        actions.setActionError(error.message)
      },
    })

    // Простая мутация для изменения времени - чистая архитектура
    const updateTimeMutation = useMutation<void, MutationError, void>({
      mutationFn: async () => {
        if (!state.timeChangeSession?.newSlot) {
          throw new Error('Brak wybranego nowego terminu.')
        }
        
        console.log('🚀 Starting simple time update for:', state.timeChangeSession.originalBooking.eventId)
        const token = getTurnstileTokenWithSession()
        
        await updateBookingTime(
          state.timeChangeSession.originalBooking,
          state.timeChangeSession.newSlot,
          token || undefined
        )
      },
      onSuccess: () => {
        console.log('🎉 Time change successful - showing success state')
        actions.setActionError(null)
        actions.setState('time-change-success')
        
        // Обновляем список резерваций в фоне
        const token = siteKey ? getTurnstileTokenWithSession() ?? turnstileSession.turnstileToken ?? undefined : undefined
        if (token) turnstileSession.setTurnstileToken(token)
        searchMutation.mutate({ turnstileToken: token ?? undefined })
      },
      onError: (error) => {
        console.error('❌ Time change failed:', error.message)
        actions.setActionError(error.message)
        actions.setState('time-change-error')
      },
    })

    // Cancel mutation
    const cancelMutation = useMutation<void, MutationError, void>({
      mutationFn: async () => {
        if (!state.selectedBooking) {
          throw new Error('Brak wybranej rezerwacji.')
        }
        await cancelBooking(state.selectedBooking)
      },
      onSuccess: () => {
        actions.setActionError(null)
        actions.setState('results')
        actions.selectBooking(null)
        const token = siteKey ? getTurnstileTokenWithSession() ?? turnstileSession.turnstileToken ?? undefined : undefined
        if (token) turnstileSession.setTurnstileToken(token)
        searchMutation.mutate({ turnstileToken: token ?? undefined })
      },
      onError: (error) => {
        actions.setActionError(error.message)
      },
    })

    // Event handlers
    const handleSearch = useCallback(() => {
      if (!canSearch) {
        if (!siteKey) {
          actions.setFormError('Podaj imię, nazwisko i numer telefonu (min. 9 cyfr).')
        } else if (!turnstileSession.turnstileToken) {
          actions.setFormError('Potwierdź weryfikację Turnstile i spróbuj ponownie.')
        } else {
          actions.setFormError('Podaj imię, nazwisko i numer telefonu (min. 9 cyfr).')
        }
        return
      }
      const token = siteKey ? getTurnstileTokenWithSession() ?? turnstileSession.turnstileToken : undefined
      if (siteKey && !token) {
        actions.setFormError('Potwierdź weryfikację Turnstile i spróbuj ponownie.')
        return
      }
      if (token) {
        turnstileSession.setTurnstileToken(token)
      }
      searchMutation.mutate({ turnstileToken: token ?? undefined })
    }, [canSearch, searchMutation, siteKey, turnstileSession, actions])

    const handleToggle = () => {
      if (state.isOpen) {
        actions.closePanel()
      } else {
        actions.togglePanel()
        if (siteKey) {
          const token = getTurnstileTokenWithSession()
          if (token) {
            turnstileSession.setTurnstileToken(token)
            actions.setFormError(null)
          }
        }
      }
    }

    const handleSelectBooking = (booking: typeof state.selectedBooking) => {
      actions.selectBooking(booking)
    }

    const handleChangeBooking = (booking: typeof state.selectedBooking) => {
      if (!booking) return
      actions.selectBooking(booking)
      actions.setState('edit-selection')
    }

    // Заглушка для изменения процедуры (будет реализовано позже)
    // const handleSelectChangeProcedure = () => { ... }

    // Новая простая логика изменения времени - кешируем и запускаем календарь
    const handleSelectChangeTime = () => {
      console.log('⏰ Starting time change for booking:', state.selectedBooking?.eventId)
      if (!state.selectedBooking) return
      
      // Создаем сессию изменения времени
      const procedure = deriveProcedureForBooking(state.selectedBooking)
      if (!procedure) {
        console.error('❌ Cannot derive procedure for booking')
        return
      }
      const session = {
        originalBooking: state.selectedBooking,
        selectedProcedure: procedure,
        newSlot: null,
      }
      
      console.log('💾 Creating time change session:', session.originalBooking.procedureName)
      actions.startTimeChange(session)
    }

    const handleEditSelectionBack = () => {
      actions.setState('results')
      actions.setActionError(null)
    }

    // Заглушка - эта функция больше не используется
    // const handleConfirmSameTime = () => { ... }

    const handleRequestNewTime = () => {
      actions.setState('edit-datetime')
      actions.setPendingSlot(null)
    }

    const handleCheckAvailability = () => {
      actions.setState('edit-datetime')
      actions.setPendingSlot(null)
    }

    // Новая простая логика подтверждения слота
    const handleConfirmSlot = () => {
      console.log('🎯 Confirming slot for time change:', selectedSlot)
      if (!selectedSlot || !state.timeChangeSession) {
        console.error('❌ No selectedSlot or timeChangeSession available!')
        return
      }
      
      // Сохраняем выбранный слот в сессию
      console.log('💾 Saving slot to time change session')
      actions.setTimeChangeSlot(selectedSlot)
      
      if (onSlotSelected) {
        onSlotSelected(selectedSlot)
      }
    }

    const handleBackToResults = () => {
      actions.setState('results')
      actions.clearTimeChange() // Очищаем сессию при возврате
    }

    const handleRetryTimeChange = () => {
      // Возвращаемся к выбору времени для повторной попытки
      if (state.timeChangeSession) {
        actions.setState('edit-datetime')
      } else {
        actions.setState('results')
      }
    }

    const handleBackToSearch = () => {
      actions.setState('search')
      actions.setActionError(null)
      actions.selectProcedure(null)
      actions.setPendingSlot(null)
      actions.resetForm()
    }

    const handleContactMaster = useCallback(() => {
      console.log('Contact master')
    }, [])

    const handleStartNewSearch = useCallback(() => {
      actions.resetForm()
      actions.setState('search')
    }, [actions])

    const handleExtendSearch = useCallback(() => {
      console.log('Extended search requested')
    }, [])

    // Заглушка - эта функция больше не используется
    // const handleBackToProcedure = () => { ... }

    // Возврат к выбору типа изменения - очищаем сессию времени
    const handleBackToEditSelection = () => {
      console.log('🔙 Going back to edit selection - clearing time change session')
      actions.clearTimeChange()
      actions.setState('edit-selection')
      actions.setActionError(null)
    }

    const handleConfirmChange = () => {
      if (!state.selectedBooking) return
      if (state.pendingSlot) {
        updateMutation.mutate({ newProcedureId: state.selectedProcedure?.id, newSlot: state.pendingSlot })
      } else if (state.selectedProcedure?.id) {
        updateMutation.mutate({ newProcedureId: state.selectedProcedure.id })
      } else {
        actions.setActionError('Wybierz procedurę lub termin do zmiany.')
      }
    }

    // Простое подтверждение изменения времени
    const handleConfirmTimeChange = () => {
      console.log('🔄 Confirming time change from session:', state.timeChangeSession?.originalBooking.eventId)
      if (!state.timeChangeSession?.newSlot) {
        console.error('❌ No new slot in time change session!')
        return
      }
      console.log('📤 Executing time change...')
      updateTimeMutation.mutate()
    }

    const handleConfirmTimeChangeBack = () => {
      // Возвращаемся к календарю изменения времени
      actions.setState('edit-datetime')
      actions.setActionError(null)
    }

    const handleConfirmCancel = () => {
      cancelMutation.mutate()
    }

    const fallbackProcedure = deriveProcedureForBooking(state.selectedBooking)

    return (
      <Card>
        <div className="space-y-3">
          <label className="block text-sm text-muted dark:text-dark-muted">Zarządzanie rezerwacją</label>
          <button
            type="button"
            onClick={handleToggle}
            className={`btn w-full ${state.isOpen ? 'btn-outline' : 'btn-primary'}`}
          >
            {state.isOpen ? 'Zamknij panel' : 'Kliknij, aby zarządzać rezerwacją'}
          </button>
          <div
            className={`transition-all duration-200 ease-out ${
              state.isOpen ? 'max-h-[24rem] opacity-100 mt-2' : 'max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            <div className={`rounded-xl border border-border bg-white/90 p-4 dark:border-dark-border dark:bg-dark-card/90 ${state.isOpen ? 'max-h-[22rem] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent' : ''}`}>
              <PanelRenderer
                state={state.state}
                form={state.form}
                onFormChange={(next) => actions.updateForm(next)}
                canSearch={canSearch}
                searchPending={searchMutation.isPending}
                formError={state.formError}
                onSearch={handleSearch}
                turnstileNode={turnstileSession.turnstileNode ? <div {...turnstileSession.turnstileNode} /> : undefined}
                turnstileRequired={turnstileSession.turnstileRequired}
                results={state.results}
                selectedBooking={state.selectedBooking}
                onSelectBooking={handleSelectBooking}
                onChangeBooking={handleChangeBooking}
                onCancelRequest={(booking) => {
                  actions.selectBooking(booking)
                  actions.setActionError(null)
                  actions.setState('confirm-cancel')
                }}
                onBackToSearch={handleBackToSearch}
                onStartNewSearch={handleStartNewSearch}
                onContactMaster={handleContactMaster}
                onEditSelectionBack={handleEditSelectionBack}
                onSelectChangeTime={handleSelectChangeTime}
                onEditDatetimeBack={handleBackToEditSelection}
                onExtendSearch={handleExtendSearch}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                onConfirmSlot={handleConfirmSlot}
                fallbackProcedure={fallbackProcedure}
                pendingSlot={state.pendingSlot}
                timeChangeSession={state.timeChangeSession}
                confirmTimeChangeSubmitting={updateTimeMutation.isPending}
                confirmTimeChangeError={state.actionError}
                onConfirmTimeChange={handleConfirmTimeChange}
                onConfirmTimeChangeBack={handleConfirmTimeChangeBack}
                cancelSubmitting={cancelMutation.isPending}
                cancelError={state.actionError}
                onConfirmCancel={handleConfirmCancel}
                onCancelBack={() => {
                  actions.setActionError(null)
                  handleBackToResults()
                }}
                onBackToResults={handleBackToResults}
                onRetryTimeChange={handleRetryTimeChange}
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
