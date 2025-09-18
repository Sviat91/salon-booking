"use client"
import Image from 'next/image'
import Card from '../components/ui/Card'
import ProcedureSelect from '../components/ProcedureSelect'
import DayCalendar from '../components/DayCalendar'
import SlotsList from '../components/SlotsList'
import BookingForm from '../components/BookingForm'
import { useState } from 'react'

export default function Page() {
  const [procId, setProcId] = useState<string | undefined>(undefined)
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [selectedSlot, setSelectedSlot] = useState<{ startISO: string; endISO: string } | null>(null)
  return (
    <main className="min-h-screen px-6 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="mt-4 ml-4 w-52">
          <Image src="/head_logo.png" alt="Facemassage" width={400} height={160} priority className="h-auto w-full" />
        </div>
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-4xl font-semibold tracking-tight text-center">Book Your Session</h1>
          <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
            <div className="flex w-full max-w-2xl flex-col gap-4 md:w-auto md:flex-shrink-0">
              <Card title="Time">
                <DayCalendar procedureId={procId} onChange={(d) => { setDate(d); setSelectedSlot(null) }} />
                <div className="mt-4">
                  <SlotsList date={date} procedureId={procId} selected={selectedSlot} onPick={setSelectedSlot} />
                </div>
              </Card>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-4 md:w-auto md:flex-shrink-0">
              <Card title="Service">
                <ProcedureSelect onChange={(p) => setProcId(p?.id)} />
              </Card>
              <Card title="Contact">
                <div className="grid grid-cols-2 gap-3">
                  <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Name" />
                  <input className="rounded-xl border border-border bg-white/80 px-3 py-2" placeholder="Phone" />
                </div>
                <button className="btn btn-primary mt-4">Submit</button>
              </Card>
              {selectedSlot && (
                <Card title="Booking">
                  <BookingForm slot={selectedSlot} procedureId={procId} />
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
