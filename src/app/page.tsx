"use client"
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import BrandHeader from '../components/BrandHeader'
import Card from '../components/ui/Card'
import ProcedureSelect from '../components/ProcedureSelect'
import DayCalendar from '../components/DayCalendar'
import SlotsList from '../components/SlotsList'
import BookingForm from '../components/BookingForm'
import BookingSuccessPanel from '../components/BookingSuccessPanel'
import BookingManagement, { BookingManagementRef } from '../components/booking-management'
import ThemeToggle from '../components/ThemeToggle'

export default function Page() {
  const queryClient = useQueryClient()
  const [procId, setProcId] = useState<string | undefined>(undefined)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<{ startISO: string; endISO: string } | null>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const [calendarMode, setCalendarMode] = useState<'booking' | 'editing'>('booking')
  
  // Флаг для показа success сообщения
  const [showBookingSuccess, setShowBookingSuccess] = useState(false)
  const [successBookingData, setSuccessBookingData] = useState<{ slot: { startISO: string; endISO: string }; procedureId?: string } | null>(null)

  // Флаги для контроля автоскрола - каждый этап скролит только один раз
  const [hasScrolledToCalendar, setHasScrolledToCalendar] = useState(false)
  const [hasScrolledToSlots, setHasScrolledToSlots] = useState(false)
  const [hasScrolledToBooking, setHasScrolledToBooking] = useState(false)
  const [hasScrolledToManagement, setHasScrolledToManagement] = useState(false)
  
  // Флаг для отслеживания открытия панели управления
  const [isManagementOpen, setIsManagementOpen] = useState(false)

  // Refs для автоскролла
  const procedureRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<HTMLDivElement>(null)
  const bookingRef = useRef<HTMLDivElement>(null)
  const mobileBookingRef = useRef<HTMLDivElement>(null)
  const bookingManagementRef = useRef<BookingManagementRef>(null)
  const bookingManagementCardRef = useRef<HTMLDivElement>(null)

  // Функция плавного скролла - только на мобильных устройствах
  const scrollToElement = (ref: React.RefObject<HTMLDivElement>, offset = 0) => {
    if (ref.current && window.innerWidth < 1024 && !userScrolled) {
      const elementPosition = ref.current.offsetTop + offset
      const finalPosition = Math.max(0, elementPosition - 80)
      window.scrollTo({
        top: finalPosition,
        behavior: 'smooth'
      })
    }
  }

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    const handleScroll = () => {
      if (!userScrolled) setUserScrolled(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setUserScrolled(false)
      }, 3000)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (timer) clearTimeout(timer)
    }
  }, [userScrolled])

  // Автоскролл при выборе услуги - только один раз
  useEffect(() => {
    if (procId && !hasScrolledToCalendar) {
      setTimeout(() => {
        scrollToElement(calendarRef, -20)
        setHasScrolledToCalendar(true)
      }, 300)
    }
  }, [procId])

  // Автоскролл при выборе даты - только один раз
  useEffect(() => {
    if (date && !hasScrolledToSlots) {
      setTimeout(() => {
        scrollToElement(slotsRef, -20)
        setHasScrolledToSlots(true)
      }, 400)
    }
  }, [date])

  // Автоскролл при выборе времени - только один раз и только в режиме обычного бронирования
  useEffect(() => {
    if (calendarMode === 'booking' && selectedSlot && !hasScrolledToBooking) {
      setTimeout(() => {
        const targetRef = window.innerWidth < 1024 ? mobileBookingRef : bookingRef
        scrollToElement(targetRef, -20)
        setHasScrolledToBooking(true)
      }, 600)
    }
  }, [selectedSlot, calendarMode, hasScrolledToBooking])
  
  // Автоскролл при открытии панели управления - только один раз и только на мобильных
  useEffect(() => {
    if (isManagementOpen && !hasScrolledToManagement) {
      setTimeout(() => {
        scrollToElement(bookingManagementCardRef, -20)
        setHasScrolledToManagement(true)
      }, 300)
    } else if (!isManagementOpen) {
      // Сбрасываем флаг когда панель закрывается
      setHasScrolledToManagement(false)
    }
  }, [isManagementOpen, hasScrolledToManagement])
  const closeBookingManagement = () => {
    bookingManagementRef.current?.close()
  }

  // Универсальная функция для сброса всего календаря к начальному состоянию
  const resetToInitialState = () => {
    setProcId(undefined)
    setDate(undefined)
    setSelectedSlot(null)
    setHasScrolledToCalendar(false)
    setHasScrolledToSlots(false)
    setHasScrolledToBooking(false)
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
  }
  
  // Обработчик успешного бронирования
  const handleBookingSuccess = () => {
    // Сохраняем данные для success сообщения
    setSuccessBookingData({ slot: selectedSlot!, procedureId: procId })
    setShowBookingSuccess(true)
    // Сбрасываем календарь и процедуру
    resetToInitialState()
  }

  return (
    <main className="p-6 relative flex-1 flex flex-col justify-center w-full max-w-full box-border overflow-x-hidden">
      <ThemeToggle />

      <div className="absolute left-4 top-4 z-10 hidden lg:block" onClick={closeBookingManagement}>
        {/* Светлая тема */}
        <Image
          src="/head_logo.png"
          alt="Logo Somique Beauty"
          width={242}  // +~10%
          height={97}
          className="h-auto cursor-pointer dark:hidden"
        />
        {/* Темная тема */}
        <Image
          src="/head_logo_night.png"
          alt="Logo Somique Beauty"
          width={242}  // +~10%
          height={97}
          className="h-auto cursor-pointer hidden dark:block"
        />
      </div>
      {/* основной центрированный контейнер */}
      <div className="mx-auto max-w-5xl">
        <BrandHeader onLogoClick={closeBookingManagement} />
        <div className="mt-8 space-y-6 lg:grid lg:grid-cols-[1fr,auto] lg:items-start lg:justify-center lg:gap-6 lg:space-y-0">
          {/* На мобильных - услуги сверху, на десктопе - справа */}
          <div className="lg:order-2">
            <div className="space-y-4 w-full max-w-sm">
              <Card title="Usługa" className="lg:max-w-sm" ref={procedureRef}>
                <ProcedureSelect
                  onChange={(p) => {
                    setProcId(p?.id)
                    setDate(undefined)
                    setSelectedSlot(null)
                    // Сбрасываем флаги автоскрола для новой услуги
                    setHasScrolledToCalendar(false)
                    setHasScrolledToSlots(false)
                    setHasScrolledToBooking(false)
                    setCalendarMode('booking')
                    bookingManagementRef.current?.close()
                    queryClient.invalidateQueries({ queryKey: ['day-slots'] })
                  }}
                />
              </Card>
              <div ref={bookingManagementCardRef}>
                <BookingManagement
                  ref={bookingManagementRef}
                  selectedDate={date}
                  selectedSlot={selectedSlot}
                  procedureId={procId}
                  onPanelOpenChange={setIsManagementOpen}
                  onProcedureChange={(newProcId) => {
                    setProcId(newProcId)
                    setDate(undefined)
                    setSelectedSlot(null)
                    queryClient.invalidateQueries({ queryKey: ['day-slots'] })
                  }}
                  onDateReset={() => {
                    setDate(undefined)
                    setSelectedSlot(null)
                  }}
                  onCalendarModeChange={(mode) => {
                    setCalendarMode(mode)
                    setHasScrolledToBooking(false)
                  }}
                  onSlotSelected={(slot) => setSelectedSlot(slot)}
                />
              </div>
              {/* BookingForm только на десктопе */}
              {calendarMode === 'booking' && selectedSlot && !showBookingSuccess && (
                <Card title="Rezerwacja" className="lg:max-w-sm hidden lg:block" ref={bookingRef}>
                  <BookingForm 
                    slot={selectedSlot} 
                    procedureId={procId}
                    onSuccess={handleBookingSuccess}
                  />
                </Card>
              )}
              
              {/* Success панель только на десктопе */}
              {showBookingSuccess && successBookingData && (
                <Card title="Rezerwacja" className="lg:max-w-sm hidden lg:block" ref={bookingRef}>
                  <BookingSuccessPanel
                    slot={successBookingData.slot}
                    procedureId={successBookingData.procedureId}
                    onClose={() => {
                      setShowBookingSuccess(false)
                      setSuccessBookingData(null)
                    }}
                  />
                </Card>
              )}
            </div>
          </div>
          
          {/* На мобильных - календарь после услуг, на десктопе - слева */}
          <div className="lg:order-1 space-y-6">
            <Card className="max-w-md mx-auto" ref={calendarRef}>
              <DayCalendar
                key={`calendar-${procId ?? 'none'}`}
                procedureId={procId}
                onChange={(d) => {
                  setDate(d)
                  setSelectedSlot(null)
                  // Сбрасываем флаги для новой даты
                  setHasScrolledToSlots(false)
                  setHasScrolledToBooking(false)
                }}
              />
              <div ref={slotsRef}>
                <SlotsList
                  key={`slots-${procId ?? 'none'}-${date?.toISOString() ?? 'no-date'}`}
                  date={date}
                  procedureId={procId}
                  selected={selectedSlot}
                  onPick={(slot) => {
                    setSelectedSlot(slot)
                  }}
                />
              </div>
            </Card>
            
            {/* BookingForm под календарем только на мобильных */}
            {calendarMode === 'booking' && selectedSlot && !showBookingSuccess && (
              <Card 
                title="Rezerwacja" 
                className="lg:hidden max-w-md transform transition-all duration-500 ease-in-out animate-fade-in-up" 
                ref={mobileBookingRef}
              >
                <BookingForm 
                  slot={selectedSlot} 
                  procedureId={procId}
                  onSuccess={handleBookingSuccess}
                />
              </Card>
            )}
            
            {/* Success панель только на мобильных */}
            {showBookingSuccess && successBookingData && (
              <Card 
                title="Rezerwacja" 
                className="lg:hidden max-w-md transform transition-all duration-500 ease-in-out animate-fade-in-up" 
                ref={mobileBookingRef}
              >
                <BookingSuccessPanel
                  slot={successBookingData.slot}
                  procedureId={successBookingData.procedureId}
                  onClose={() => {
                    setShowBookingSuccess(false)
                    setSuccessBookingData(null)
                  }}
                />
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
