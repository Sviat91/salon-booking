"use client"
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import BrandHeader from '../components/BrandHeader'
import Card from '../components/ui/Card'
import ProcedureSelect from '../components/ProcedureSelect'
import DayCalendar from '../components/DayCalendar'
import SlotsList from '../components/SlotsList'
import BookingForm from '../components/BookingForm'
import ThemeToggle from '../components/ThemeToggle'

export default function Page() {
  const [procId, setProcId] = useState<string | undefined>(undefined)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<{ startISO: string; endISO: string } | null>(null)
  
  // Флаги для контроля автоскрола - каждый этап скролит только один раз
  const [hasScrolledToCalendar, setHasScrolledToCalendar] = useState(false)
  const [hasScrolledToSlots, setHasScrolledToSlots] = useState(false)
  const [hasScrolledToBooking, setHasScrolledToBooking] = useState(false)

  // Refs для автоскролла
  const procedureRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<HTMLDivElement>(null)
  const bookingRef = useRef<HTMLDivElement>(null)
  const mobileBookingRef = useRef<HTMLDivElement>(null)

  // Функция плавного скролла - только на мобильных устройствах
  const scrollToElement = (ref: React.RefObject<HTMLDivElement>, offset = 0) => {
    if (ref.current && window.innerWidth < 1024) {
      const elementPosition = ref.current.offsetTop + offset
      // Добавляем дополнительный отступ для лучшего позиционирования
      const finalPosition = Math.max(0, elementPosition - 80) // 80px от верха для удобства
      window.scrollTo({
        top: finalPosition,
        behavior: 'smooth'
      })
    }
  }

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

  // Автоскролл при выборе времени - только один раз
  useEffect(() => {
    if (selectedSlot && !hasScrolledToBooking) {
      setTimeout(() => {
        // На мобильных используем мобильную форму, на десктопе - обычную
        const targetRef = window.innerWidth < 1024 ? mobileBookingRef : bookingRef
        scrollToElement(targetRef, -20)
        setHasScrolledToBooking(true)
      }, 600)
    }
  }, [selectedSlot])
  return (
    <main className="p-6 relative flex-1 flex flex-col justify-center">
      <ThemeToggle />
      {/* фиксированный логотип в левом верхнем углу - скрыт на мобильных */}
      <div className="absolute left-4 top-4 z-10 hidden lg:block">
        <Image
          src="/head_logo.png"
          alt="Logo Somique Beauty"
          width={242}  // +~10%
          height={97}
          className="h-auto"
        />
      </div>
      {/* основной центрированный контейнер */}
      <div className="mx-auto max-w-5xl">
        <BrandHeader />
        <div className="mt-8 space-y-6 lg:grid lg:grid-cols-[auto,384px] lg:items-start lg:justify-center lg:gap-6 lg:space-y-0">
          {/* На мобильных - услуги сверху, на десктопе - справа */}
          <div className="lg:order-2 lg:pl-2">
            <div className="space-y-4 lg:max-w-sm">
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
                  }}
                />
              </Card>
              {/* BookingForm только на десктопе */}
              {selectedSlot && (
                <Card title="Rezerwacja" className="lg:max-w-sm hidden lg:block" ref={bookingRef}>
                  <BookingForm slot={selectedSlot} procedureId={procId} />
                </Card>
              )}
            </div>
          </div>
          
          {/* На мобильных - календарь после услуг, на десктопе - слева */}
          <div className="lg:order-1 space-y-6">
            <Card className="max-w-md lg:max-w-none" ref={calendarRef}>
              <DayCalendar
                key={procId ?? 'none'}
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
                <SlotsList date={date} procedureId={procId} selected={selectedSlot} onPick={setSelectedSlot} />
              </div>
            </Card>
            
            {/* BookingForm под календарем только на мобильных */}
            {selectedSlot && (
              <Card 
                title="Rezerwacja" 
                className="lg:hidden max-w-md transform transition-all duration-500 ease-in-out animate-fade-in-up" 
                ref={mobileBookingRef}
              >
                <BookingForm slot={selectedSlot} procedureId={procId} />
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
