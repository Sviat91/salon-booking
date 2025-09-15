"use client"
import Image from 'next/image'

export default function BrandHeader() {
  return (
    <header className="flex flex-col items-center gap-3 py-6">
      <div className="h-20 w-20 rounded-full overflow-hidden ring-2 ring-accent/70 shadow-sm bg-white">
        <Image src="/logo.png" alt="logo" width={80} height={80} className="h-20 w-20 object-cover" />
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">Book Your Session</h1>
    </header>
  )
}
