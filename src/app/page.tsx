import BrandHeader from '../components/BrandHeader'
import Card from '../components/ui/Card'
import ProcedureSelect from '../components/ProcedureSelect'
import DayCalendar from '../components/DayCalendar'
"use client"
import { useState } from 'react'

export default function Page() {
  const [procId, setProcId] = useState<string | undefined>(undefined)
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl">
        <BrandHeader />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7">
            <Card title="Time">
              <DayCalendar procedureId={procId} />
            </Card>
          </div>
          <div className="col-span-5">
            <div className="space-y-4">
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
            </div>
          </div>
        </div>
        <div className="mt-6 text-center">
          <a className="btn btn-outline" href="/api/health">API health</a>
        </div>
      </div>
    </main>
  )
}
