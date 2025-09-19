"use client"
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import BrandHeader from '../components/BrandHeader'
import Card from '../components/ui/Card'
import ProcedureSelect from '../components/ProcedureSelect'
import DayCalendar from '../components/DayCalendar'
import SlotsList from '../components/SlotsList'
import BookingForm from '../components/BookingForm'

export default function Page() {
  const [procId, setProcId] = useState<string | undefined>(undefined)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<{ startISO: string; endISO: string } | null>(null)
  const [userScrolled, setUserScrolled] = useState(false)

  // Refs для автоскролла
  const procedureRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<HTMLDivElement>(null)
  const bookingRef = useRef<HTMLDivElement>(null)

  // Функция плавного скролла
  const scrollToElement = (ref: React.RefObject<HTMLDivElement>, offset = 0) => {
    if (ref.current && window.innerWidth < 1024 && !userScrolled) { // только на мобильных и если пользователь не скроллил
      const elementPosition = ref.current.offsetTop + offset
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      })
    }
  }

  // Отслеживание пользовательского скролла
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout
    
    const handleScroll = () => {
      setUserScrolled(true)
      clearTimeout(scrollTimeout)
      // Сбрасываем флаг через 3 секунды бездействия
      scrollTimeout = setTimeout(() => {
        setUserScrolled(false)
      }, 3000)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  // Автоскролл при выборе услуги
  useEffect(() => {
    if (procId) {
      setTimeout(() => scrollToElement(calendarRef, -20), 300)
    }
  }, [procId, userScrolled])

  // Автоскролл при выборе даты  
  useEffect(() => {
    if (date) {
      setTimeout(() => scrollToElement(slotsRef, -20), 300)
    }
  }, [date, userScrolled])

  // Автоскролл при выборе времени
  useEffect(() => {
    if (selectedSlot) {
      setTimeout(() => scrollToElement(bookingRef, -20), 300)
    }
  }, [selectedSlot, userScrolled])
  return (
    <main className="min-h-screen p-6 relative">
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
                  }}
                />
              </Card>
              {selectedSlot && (
                <Card title="Rezerwacja" className="lg:max-w-sm" ref={bookingRef}>
                  <BookingForm slot={selectedSlot} procedureId={procId} />
                </Card>
              )}
              {/*
              <Card title="Contact">
                <div className="grid grid-cols-2 gap-3">
                  <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Name" />
                  <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Phone" />
                </div>
                <button className="btn btn-primary mt-4">Submit</button>
              </Card>
              */}
            </div>
          </div>
          
          {/* На мобильных - календарь после услуг, на десктопе - слева */}
          <Card className="lg:order-1 max-w-md lg:max-w-none" ref={calendarRef}>
            <DayCalendar
              key={procId ?? 'none'}
              procedureId={procId}
              onChange={(d) => {
                setDate(d)
                setSelectedSlot(null)
              }}
            />
            <div ref={slotsRef}>
              <SlotsList date={date} procedureId={procId} selected={selectedSlot} onPick={setSelectedSlot} />
            </div>
          </Card>
        </div>
      </div>
    </main>
  )
}
