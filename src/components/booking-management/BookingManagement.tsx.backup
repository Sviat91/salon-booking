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
  updateBookingProcedure,
  cancelBooking,
  checkProcedureExtension,
} from './api/bookingManagementApi'
import type { ProceduresResponse } from './api/bookingManagementApi'
import type {
  BookingManagementRef,
  CalendarMode,
  SlotSelection,
  ProcedureOption,
} from './types'
import { clientLog } from '@/lib/client-logger'

interface BookingManagementProps {
  selectedDate?: Date
  selectedSlot?: SlotSelection | null
  procedureId?: string
  onProcedureChange?: (procedureId: string | undefined) => void
  onDateReset?: () => void
  onCalendarModeChange?: (mode: CalendarMode) => void
  onSlotSelected?: (slot: SlotSelection) => void
  onPanelOpenChange?: (isOpen: boolean) => void
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
      onPanelOpenChange,
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
      if (state.state === 'edit-datetime' || state.state === 'direct-time-change') {
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

    // Ensure Turnstile widget is rendered whenever the panel opens
    useEffect(() => {
      if (state.isOpen && siteKey) {
        turnstileSession.ensureWidget()
      }
    }, [state.isOpen, siteKey, turnstileSession.ensureWidget])

    // Form validation
    const canSearch = useMemo(() => {
      const trimmedName = state.form.fullName.trim()
      const phoneDigits = state.form.phone.replace(/\D/g, '')
      const baseValid = trimmedName.length >= 2 && phoneDigits.length >= 9
      
      if (!siteKey) return baseValid
      return baseValid && !!turnstileSession.turnstileToken
    }, [state.form.fullName, state.form.phone, siteKey, turnstileSession.turnstileToken])

    // Search mutation
    const searchMutation = useMutation<typeof state.results, MutationError, { turnstileToken?: string; dateRange?: { start: string; end: string } }>({
      mutationFn: async ({ turnstileToken: providedToken, dateRange } = {}) => {
        return searchBookings(state.form, procedures, providedToken, dateRange)
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

    // Мутация для изменения процедуры (M1 Step 2) - простая без валидации
    const updateProcedureMutation = useMutation<void, MutationError, void>({
      mutationFn: async () => {
        if (!state.selectedBooking) {
          throw new Error('Brak wybranej rezerwacji.')
        }
        if (!state.selectedProcedure) {
          throw new Error('Wybierz procedurę.')
        }
        clientLog.info('🔄 Updating procedure:', state.selectedProcedure.name_pl)
        // NO TURNSTILE - user already verified during search (like updateBookingTime)
        await updateBookingProcedure(state.selectedBooking, state.selectedProcedure.id)
      },
      onSuccess: () => {
        clientLog.info('✅ Procedure updated successfully')
        actions.setActionError(null)
        actions.clearExtensionCheck() // Очищаем проверку после успешного сохранения
        
        // Сбрасываем календарь к начальному состоянию
        resetCalendarState()
        
        actions.setState('procedure-change-success')
      },
      onError: (error) => {
        clientLog.error('❌ Procedure update failed:', error.message)
        actions.setActionError(error.message)
        
        // Сбрасываем календарь при ошибке тоже
        resetCalendarState()
        
        actions.setState('procedure-change-error')
      },
    })

    // Update mutation (для комбинированных изменений - процедура + время)
    const updateMutation = useMutation<
      { startTime?: string; endTime?: string; procedure?: string }, 
      MutationError, 
      { newProcedureId?: string; newSlot?: SlotSelection }
    >({
      mutationFn: async (changes) => {
        if (!state.selectedBooking) {
          throw new Error('Brak wybranej rezerwacji.')
        }
        const token = turnstileSession.turnstileToken ?? undefined
        return await updateBooking(state.selectedBooking, changes, token)
      },
      onSuccess: (data) => {
        clientLog.info('✅ Combined procedure+time update successful', data)
        actions.setActionError(null)
        actions.clearExtensionCheck()
        
        // Update booking time in state if it changed
        if (data.startTime && data.endTime && state.selectedBooking) {
          clientLog.info('🔄 Updating booking time in state:', {
            old: { start: state.selectedBooking.startTime, end: state.selectedBooking.endTime },
            new: { start: data.startTime, end: data.endTime }
          })
          actions.updateBookingTime({
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime)
          })
        }
        
        // Сбрасываем календарь к начальному состоянию
        resetCalendarState()
        
        // Показываем панель успеха изменения процедуры (не просто results)
        actions.setState('procedure-change-success')
      },
      onError: (error) => {
        clientLog.error('❌ Combined update failed:', error.message)
        actions.setActionError(error.message)
        
        // Сбрасываем календарь при ошибке тоже
        resetCalendarState()
        
        actions.setState('procedure-change-error')
      },
    })

    // Универсальная функция для сброса состояния календаря
    const resetCalendarState = useCallback(() => {
      clientLog.info('🔄 Resetting calendar state to initial (no procedure, no date, no slot)')
      actions.setPendingSlot(null)
      onDateReset?.() // Сбрасываем выбранную дату
      onCalendarModeChange?.('booking') // Возвращаем в режим бронирования
      onProcedureChange?.(undefined) // Сбрасываем процедуру - календарь станет неактивным
    }, [onDateReset, onCalendarModeChange, onProcedureChange, actions])

    // Простая мутация для изменения времени - чистая архитектура
    // NO TURNSTILE - user already verified during search
    const updateTimeMutation = useMutation<void, MutationError, void>({
      mutationFn: async () => {
        if (!state.timeChangeSession?.newSlot) {
          throw new Error('Brak wybranego nowego terminu.')
        }
        
        clientLog.info('🚀 Starting simple time update (no Turnstile):', state.timeChangeSession.originalBooking.eventId)
        
        await updateBookingTime(
          state.timeChangeSession.originalBooking,
          state.timeChangeSession.newSlot
        )
      },
      onSuccess: () => {
        clientLog.info('🎉 Time change successful - showing success state')
        actions.setActionError(null)
        
        // Сбрасываем состояние календаря и показываем панель успеха
        resetCalendarState()
        actions.setState('time-change-success')
        
        clientLog.info('✅ State changed to time-change-success')
        
        // НЕ обновляем поиск сразу - пусть пользователь увидит success панель
        // Обновим когда он нажмет "Powrót do wyników"
      },
      onError: (error) => {
        clientLog.error('❌ Time change failed:', error.message)
        actions.setActionError(error.message)
        
        // Сбрасываем состояние календаря при ошибке тоже
        resetCalendarState()
        actions.setState('time-change-error')
        
        clientLog.info('❌ State changed to time-change-error')
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
        // Pokaż zielонą панель успеха anulowania; не обновляем список сразу
        actions.setState('cancel-success')
      },
      onError: (error) => {
        // Переходим на красную панель ошибки с понятным сообщением
        actions.setActionError(error.message)
        actions.setState('cancel-error')
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
      const token = siteKey ? turnstileSession.turnstileToken ?? undefined : undefined
      if (siteKey && !token) {
        actions.setFormError('Potwierdź weryfikację Turnstile i spróbuj ponownie.')
        return
      }
      if (token) {
        turnstileSession.setTurnstileToken(token)
      }
      searchMutation.mutate({ turnstileToken: token })
    }, [canSearch, searchMutation, siteKey, turnstileSession, actions])

    const handleToggle = () => {
      if (state.isOpen) {
        // При закрытии панели - сбрасываем календарь если была активна сессия изменения времени
        if (state.timeChangeSession || state.wasEditing) {
          clientLog.info('🔙 Closing BookingManagement panel - resetting calendar state')
          resetCalendarState()
        }
        // Полностью удаляем Turnstile при закрытии панели, чтобы корректно пересоздать при следующем открытии
        if (siteKey) {
          turnstileSession.removeWidget()
        }
        actions.closePanel()
        onPanelOpenChange?.(false)
      } else {
        actions.togglePanel()
        // Гарантируем рендер Turnstile при открытии панели
        if (siteKey) {
          turnstileSession.ensureWidget()
        }
        if (siteKey && turnstileSession.turnstileToken) {
          actions.setFormError(null)
        }
        onPanelOpenChange?.(true)
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

    // M1: Изменение процедуры - базовые хендлеры (навигация и выбор)
    const handleSelectChangeProcedure = () => {
      clientLog.info('💆‍♀️ Starting procedure change flow')
      actions.setActionError(null)
      actions.selectProcedure(null)
      actions.clearExtensionCheck() // Очищаем предыдущую проверку
      actions.setState('edit-procedure')
    }

    const handleSelectProcedure = (proc: ProcedureOption | null) => {
      clientLog.info('🧭 Procedure selected:', proc?.name_pl)
      actions.selectProcedure(proc)
    }

    // M1 Step 2: Подтверждение изменения процедуры на тот же час - сразу выполняем
    const handleConfirmSameTime = () => {
      clientLog.info('✅ Confirming procedure change on same time - executing immediately')
      clientLog.info('📋 Selected procedure:', state.selectedProcedure)
      clientLog.info('📋 Selected booking:', state.selectedBooking)
      if (!state.selectedProcedure) {
        clientLog.warn('⚠️ No procedure selected!')
        actions.setActionError('Wybierz procedurę')
        return
      }
      if (!state.selectedBooking) {
        clientLog.error('❌ No selected booking!')
        return
      }
      actions.setActionError(null)
      clientLog.info('🚀 Executing procedure change immediately')
      // Сразу вызываем мутацию без промежуточного состояния
      updateProcedureMutation.mutate()
    }

    // Новая простая логика изменения времени - сразу показываем direct-time-change панель
    const handleSelectChangeTime = () => {
      clientLog.info('⏰ Starting direct time change for booking:', state.selectedBooking?.eventId)
      if (!state.selectedBooking) return
      
      // Создаем сессию изменения времени
      const procedure = deriveProcedureForBooking(state.selectedBooking)
      if (!procedure) {
        clientLog.error('❌ Cannot derive procedure for booking')
        return
      }
      const session = {
        originalBooking: state.selectedBooking,
        selectedProcedure: procedure,
        newSlot: null,
      }
      
      // Активируем Turnstile для изменения времени
      if (siteKey && turnstileSession.turnstileToken) {
        actions.setActionError(null)
      }
      
      clientLog.info('💾 Creating time change session and going direct to comparison:', session.originalBooking.procedureName)
      actions.startTimeChange(session)
      actions.setState('direct-time-change')
    }

    const handleEditSelectionBack = () => {
      actions.clearExtensionCheck() // Очищаем проверку при возврате
      actions.setState('results')
      actions.setActionError(null)
    }

    // Заглушка - эта функция больше не используется
    // const handleConfirmSameTime = () => { ... }

    const handleRequestNewTime = () => {
      clientLog.info('📅 Requesting new time for procedure change:', state.selectedProcedure?.name_pl)
      if (!state.selectedBooking || !state.selectedProcedure) {
        clientLog.error('❌ No booking or procedure selected!')
        return
      }
      
      // Очищаем проверку доступности если была
      actions.clearExtensionCheck()
      
      // Создаем сессию изменения времени с НОВОЙ процедурой
      // Это позволит показать direct-time-change панель с правильными данными
      const session = {
        originalBooking: state.selectedBooking,
        selectedProcedure: state.selectedProcedure, // НОВАЯ процедура!
        newSlot: null,
      }
      
      clientLog.info('💾 Creating time change session for procedure change:', {
        oldProcedure: state.selectedBooking.procedureName,
        newProcedure: state.selectedProcedure.name_pl,
      })
      
      actions.startTimeChange(session)
      actions.setState('direct-time-change')
    }

    // Обновленная логика проверки доступности для длинных процедур
    const handleCheckAvailability = async () => {
      if (!state.selectedBooking || !state.selectedProcedure) {
        clientLog.error('❌ No booking or procedure selected!')
        return
      }
      
      clientLog.info('🔍 Checking extension availability for:', state.selectedProcedure.name_pl)
      
      // Устанавливаем статус проверки
      actions.setExtensionCheckStatus('checking')
      actions.setActionError(null)
      
      try {
        clientLog.info('🔍 Calling checkProcedureExtension (no Turnstile):', {
          eventId: state.selectedBooking.eventId,
          procedureId: state.selectedProcedure.id,
          currentStart: state.selectedBooking.startTime.toISOString(),
          currentEnd: state.selectedBooking.endTime.toISOString(),
        })
        
        const response = await checkProcedureExtension(
          state.selectedBooking,
          state.selectedProcedure.id
        )
        
        clientLog.info('✅ Extension check result:', response.result.status, response.result)
        
        // Сохраняем результат проверки
        actions.setExtensionCheckResult(response.result)
        
      } catch (error) {
        clientLog.error('❌ Extension check failed:', error)
        actions.setActionError(error instanceof Error ? error.message : 'Nie udało się sprawdzić dostępności')
        actions.setExtensionCheckStatus(null)
      }
    }
    
    // Выбор альтернативного слота из списка
    const handleSelectAlternativeSlot = (slot: SlotSelection) => {
      clientLog.info('📍 Selected alternative slot:', slot)
      actions.selectAlternativeSlot(slot)
    }
    
    // Подтверждение альтернативного слота (сдвиг назад или выбранный из списка)
    const handleConfirmAlternativeSlot = () => {
      if (!state.selectedBooking || !state.selectedProcedure) {
        clientLog.error('❌ No booking or procedure selected!')
        return
      }
      
      // Используем выбранный альтернативный слот или предложенный системой
      const slotToUse = state.selectedAlternativeSlot || 
        (state.extensionCheckResult?.suggestedStartISO && state.extensionCheckResult?.suggestedEndISO
          ? {
              startISO: state.extensionCheckResult.suggestedStartISO,
              endISO: state.extensionCheckResult.suggestedEndISO,
            }
          : null)
      
      if (!slotToUse) {
        clientLog.error('❌ No alternative slot available!')
        return
      }
      
      clientLog.info('✅ Confirming alternative slot:', slotToUse)
      
      // Используем updateMutation для комбинированного изменения (процедура + время)
      updateMutation.mutate({
        newProcedureId: state.selectedProcedure.id,
        newSlot: slotToUse,
      })
    }

    // Новая простая логика подтверждения слота
    const handleConfirmSlot = () => {
      clientLog.info('🎯 Confirming slot for time change:', selectedSlot)
      if (!selectedSlot || !state.timeChangeSession) {
        clientLog.error('❌ No selectedSlot or timeChangeSession available!')
        return
      }
      
      // Сохраняем выбранный слот в сессию
      clientLog.info('💾 Saving slot to time change session')
      actions.setTimeChangeSlot(selectedSlot)
      
      if (onSlotSelected) {
        onSlotSelected(selectedSlot)
      }
    }

    const handleBackToResults = () => {      
      actions.clearTimeChange() // Очищаем сессию при возврате
      actions.selectProcedure(null) // Очищаем выбранную процедуру
      actions.setState('results')
      
      // Сбрасываем Turnstile для чистого старта
      if (siteKey) {
        turnstileSession.resetWidget()
      }
      
      // Обновляем поиск при возврате к результатам
      clientLog.info('🔄 Refreshing search after successful change')
      const token = siteKey ? (turnstileSession.turnstileToken ?? undefined) : undefined
      if (token) turnstileSession.setTurnstileToken(token)
      searchMutation.mutate({ turnstileToken: token })
    }

    const handleRetryTimeChange = () => {
      // Возвращаемся к выбору времени для повторной попытки и сбрасываем календарь
      clientLog.info('🔄 User retrying time change after error - resetting calendar')
      resetCalendarState()
      if (state.timeChangeSession) {
        actions.setState('edit-datetime')
      } else {
        actions.setState('results')
      }
    }

    const handleRetryCancel = () => {
      // Вернуться к подтверждению отмены, чтобы попробовать снова
      actions.setActionError(null)
      actions.setState('confirm-cancel')
    }

    const handleBackToSearch = () => {
      actions.setState('search')
      actions.setActionError(null)
      actions.selectProcedure(null)
      actions.setPendingSlot(null)
      actions.resetForm()
    }

    const handleContactMaster = useCallback(() => {
      clientLog.info('Opening contact master panel')
      actions.setState('contact-master')
    }, [actions])
    
    const handleContactMasterSuccess = useCallback(() => {
      clientLog.info('Contact master success')
      actions.setState('contact-master-success')
    }, [actions])
    
    const handleContactMasterBack = useCallback(() => {
      clientLog.info('Going back from contact master')
      actions.setState('not-found')
    }, [actions])
    
    const handleContactMasterClose = useCallback(() => {
      clientLog.info('Closing contact master success')
      actions.setState('search')
      actions.resetForm()
    }, [actions])

    const handleStartNewSearch = useCallback(() => {
      actions.resetForm()
      actions.setState('search')
    }, [actions])

    const handleExtendSearch = useCallback(() => {
      clientLog.info('Opening extended search panel')
      actions.setState('extended-search')
    }, [actions])
    
    const handleExtendedSearchSubmit = useCallback((
      fullName: string, 
      phone: string, 
      email: string, 
      startDate: string, 
      endDate: string
    ) => {
      clientLog.info('Extended search submitted:', { fullName, phone, email, startDate, endDate })
      
      // Обновляем форму с новыми данными
      actions.updateForm({ fullName, phone, email })
      
      // Выполняем поиск с расширенным диапазоном дат
      actions.setState('loading')
      
      const token = turnstileSession.turnstileToken ?? undefined
      searchMutation.mutate({
        turnstileToken: token,
        dateRange: { start: startDate, end: endDate }
      })
    }, [actions, searchMutation, turnstileSession])
    
    const handleExtendedSearchBack = useCallback(() => {
      clientLog.info('Going back from extended search')
      actions.setState('not-found')
    }, [actions])

    // Заглушка - эта функция больше не используется
    // const handleBackToProcedure = () => { ... }

    // Возврат к выбору типа изменения - очищаем сессию времени и сбрасываем календарь
    const handleBackToEditSelection = () => {
      clientLog.info('🔙 Going back to edit selection - clearing time change session and resetting calendar')
      resetCalendarState()
      actions.clearTimeChange()
      actions.setState('edit-selection')
      actions.setActionError(null)
    }

    // Удалены handleConfirmChange и handleConfirmChangeBack - больше не нужны
    // Изменение процедуры теперь выполняется сразу из handleConfirmSameTime

    // Подтверждение изменения времени (возможно с изменением процедуры)
    const handleConfirmTimeChange = () => {
      clientLog.info('🔄 Confirming time change from session:', state.timeChangeSession?.originalBooking.eventId)
      
      if (!state.timeChangeSession) {
        clientLog.error('❌ No time change session!')
        return
      }
      
      // Если есть selectedSlot, но нет newSlot в сессии - сохраняем
      if (selectedSlot && !state.timeChangeSession.newSlot) {
        clientLog.info('💾 First saving selectedSlot to session:', selectedSlot)
        actions.setTimeChangeSlot(selectedSlot)
        if (onSlotSelected) {
          onSlotSelected(selectedSlot)
        }
      }
      
      // Проверяем что есть слот для изменения  
      const slotToUse = state.timeChangeSession.newSlot || selectedSlot
      if (!slotToUse) {
        clientLog.error('❌ No slot available for time change!')
        return
      }
      
      // Проверяем, меняется ли процедура
      const isProcedureChange = state.timeChangeSession.selectedProcedure.name_pl !== state.timeChangeSession.originalBooking.procedureName
      
      if (isProcedureChange) {
        // Комбинированное изменение: процедура + время
        clientLog.info('📤 Executing combined procedure+time change...')
        updateMutation.mutate({
          newProcedureId: state.timeChangeSession.selectedProcedure.id,
          newSlot: slotToUse,
        })
      } else {
        // Только изменение времени
        clientLog.info('📤 Executing time change only...')
        updateTimeMutation.mutate()
      }
    }

    const handleConfirmTimeChangeBack = () => {
      // Проверяем, это была смена процедуры или просто время
      const isProcedureChange = state.timeChangeSession && 
        state.timeChangeSession.selectedProcedure.name_pl !== state.timeChangeSession.originalBooking.procedureName
      
      clientLog.info('🔙 User canceled time change - resetting calendar', {
        isProcedureChange,
        goingTo: isProcedureChange ? 'edit-procedure' : 'edit-selection'
      })
      
      resetCalendarState()
      
      if (isProcedureChange) {
        // При возврате к смене процедуры - сохраняем selectedProcedure, но очищаем session
        actions.clearTimeChange()
        actions.setState('edit-procedure')
      } else {
        // При возврате от простой смены времени - очищаем всё
        if (siteKey) {
          turnstileSession.resetWidget()
        }
        actions.setState('edit-selection')
      }
      
      actions.setActionError(null)
    }

    const handleConfirmCancel = () => {
      cancelMutation.mutate()
    }

    const fallbackProcedure = deriveProcedureForBooking(state.selectedBooking)

    return (
      <Card>
        <div className="space-y-3">
          {!state.isOpen ? (
            // Закрытое состояние - обычная кнопка
            <>
              <label className="block text-sm text-muted dark:text-dark-muted">Zarządzanie rezerwacją</label>
              <button
                type="button"
                onClick={handleToggle}
                className="btn btn-primary w-full"
              >
                Kliknij, aby zarządzać rezerwacją
              </button>
            </>
          ) : (
            // Открытое состояние - заголовок и кнопка закрытия в одной строке
            <div className="flex items-center justify-between">
              <label className="text-sm text-muted dark:text-dark-muted">Zarządzanie rezerwacją</label>
              <button
                type="button"
                onClick={handleToggle}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                Zamknij panel
              </button>
            </div>
          )}
          <div
            className={`transition-all duration-200 ease-out w-full max-w-full ${
              state.isOpen ? 'opacity-100 mt-2' : 'max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            <div className={`rounded-xl border border-border bg-white/90 p-4 dark:border-dark-border dark:bg-dark-card/90 w-full max-w-full box-border overflow-x-hidden ${state.isOpen ? 'max-h-[35rem] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent' : ''}`}>
              <PanelRenderer
                state={state.state}
                form={state.form}
                onFormChange={(next) => actions.updateForm(next)}
                canSearch={canSearch}
                searchPending={searchMutation.isPending}
                formError={state.formError}
                onSearch={handleSearch}
                turnstileNode={turnstileSession.turnstileRef ? <div ref={turnstileSession.turnstileRef} className="rounded-xl"></div> : undefined}
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
                onChangeProcedure={handleSelectChangeProcedure}
                onEditDatetimeBack={handleBackToEditSelection}
                onExtendSearch={handleExtendSearch}
                onExtendedSearchSubmit={handleExtendedSearchSubmit}
                onExtendedSearchBack={handleExtendedSearchBack}
                onContactMasterSuccess={handleContactMasterSuccess}
                onContactMasterBack={handleContactMasterBack}
                onContactMasterClose={handleContactMasterClose}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                onConfirmSlot={handleConfirmSlot}
                fallbackProcedure={fallbackProcedure}
                pendingSlot={state.pendingSlot}
                timeChangeSession={state.timeChangeSession}
                confirmTimeChangeSubmitting={updateTimeMutation.isPending || updateMutation.isPending}
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
                onRetryCancel={handleRetryCancel}
                procedures={procedures}
                selectedProcedure={state.selectedProcedure}
                onSelectProcedure={handleSelectProcedure}
                onConfirmSameTime={handleConfirmSameTime}
                onRequestNewTime={handleRequestNewTime}
                onCheckAvailability={handleCheckAvailability}
                procedureChangeError={state.actionError}
                procedureChangeSubmitting={updateProcedureMutation.isPending || updateMutation.isPending}
                extensionCheckStatus={state.extensionCheckStatus}
                extensionCheckResult={state.extensionCheckResult}
                selectedAlternativeSlot={state.selectedAlternativeSlot}
                onSelectAlternativeSlot={handleSelectAlternativeSlot}
                onConfirmAlternativeSlot={handleConfirmAlternativeSlot}
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
