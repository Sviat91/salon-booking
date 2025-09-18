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
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl">
        <div className="ml-6 mt-6 w-40 sm:w-48">
          <Image src="/head_logo.png" alt="Facemassage" priority sizes="(max-width: 640px) 160px, 192px" width={192} height={80} className="h-auto w-full" />
        </div>
        <BrandHeader />
        <div className="mt-8 grid gap-6 lg:grid-cols-[340px_minmax(0,_1fr)]">
          <Card className="max-w-md lg:max-w-none">
            <DayCalendar
              procedureId={procId}
              onChange={(d) => {
                setDate(d)
                setSelectedSlot(null)
              }}
            />
            <div className="mt-4">
              <SlotsList date={date} procedureId={procId} selected={selectedSlot} onPick={setSelectedSlot} />
            </div>
          </Card>
          <div className="flex flex-col items-start gap-4">
            <Card title="Service" className="w-full max-w-sm">
              <ProcedureSelect onChange={(p) => setProcId(p?.id)} />
            </Card>
            {/* <Card title="Contact">
              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Name" />
                <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Phone" />
              </div>
              <button className="btn btn-primary mt-4">Submit</button>
            </Card> */}
            {selectedSlot && (
              <Card title="Booking" className="w-full max-w-sm">
                <BookingForm slot={selectedSlot} procedureId={procId} />
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
