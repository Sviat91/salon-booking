"use client"
import Image from 'next/image'
import { useState } from 'react'
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
  return (
    <main className="min-h-screen p-6 relative">
      {/* фиксированный логотип в левом верхнем углу */}
      <div className="absolute left-4 top-4 z-10">
        <Image
          src="/head_logo.png"
          alt="Somique beauty logo"
          width={242}  // +~10%
          height={97}
          className="h-auto"
        />
      </div>
      {/* основной центрированный контейнер */}
      <div className="mx-auto max-w-5xl">
        <BrandHeader />
        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,_1fr)]">
          <Card className="max-w-md lg:max-w-none">
            <DayCalendar
              key={procId ?? 'none'}
              procedureId={procId}
              onChange={(d) => {
                setDate(d)
                setSelectedSlot(null)
              }}
            />
            <SlotsList date={date} procedureId={procId} selected={selectedSlot} onPick={setSelectedSlot} />
          </Card>
          <div className="lg:pl-2">
            <div className="space-y-4 lg:max-w-sm">
              <Card title="Service" className="lg:max-w-sm">
                <ProcedureSelect
                  onChange={(p) => {
                    setProcId(p?.id)
                    setDate(undefined)
                    setSelectedSlot(null)
                  }}
                />
              </Card>
              {selectedSlot && (
                <Card title="Booking" className="lg:max-w-sm">
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
        </div>
      </div>
    </main>
  )
}
