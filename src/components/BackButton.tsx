"use client"
import Link from 'next/link'

export default function BackButton() {
  return (
    <div className="fixed top-6 left-6 z-50">
      <Link 
        href="/" 
        className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-border dark:border-dark-border text-text dark:text-dark-text hover:bg-white dark:hover:bg-dark-card transition-all duration-200 shadow-lg text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Powrót
      </Link>
    </div>
  )
}
