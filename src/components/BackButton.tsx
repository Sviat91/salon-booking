"use client"
import Link from 'next/link'

export default function BackButton() {
  return (
    <div className="fixed top-6 right-6 z-50">
      <Link 
        href="/" 
        className="btn btn-primary inline-flex items-center gap-2 shadow-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Powrót do strony głównej
      </Link>
    </div>
  )
}
