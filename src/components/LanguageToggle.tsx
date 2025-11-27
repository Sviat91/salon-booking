"use client"
import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { LANGUAGE_NAMES, DEFAULT_LANGUAGE, type Language } from '@/lib/i18n'

// Display codes for UI (different from internal ISO codes)
const LANGUAGE_DISPLAY_CODES: Record<Language, string> = {
  pl: 'PL',
  uk: 'UA', // Ukraine uses UA, not UK
  en: 'EN',
}

export default function LanguageToggle() {
  const { language, setLanguage, supportedLanguages } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Prevent hydration mismatch - only show actual language after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const displayLanguage = mounted ? language : DEFAULT_LANGUAGE
  const displayCode = LANGUAGE_DISPLAY_CODES[displayLanguage]

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:opacity-80 transition-opacity duration-300 flex items-center gap-1"
        aria-label={LANGUAGE_NAMES[displayLanguage]}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-sm font-medium text-text dark:text-dark-text">
          {displayCode}
        </span>
        <svg
          className={`w-3 h-3 text-muted dark:text-dark-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-1 bg-white dark:bg-dark-card border border-border dark:border-dark-border rounded-xl shadow-lg py-1 min-w-[120px] z-50"
          role="listbox"
          aria-label="Select language"
        >
          {supportedLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguageSelect(lang)}
              className={`w-full px-3 py-2 flex items-center justify-between hover:bg-primary/30 dark:hover:bg-dark-border/50 transition-colors ${
                lang === language ? 'bg-primary/20 dark:bg-dark-border/30' : ''
              }`}
              role="option"
              aria-selected={lang === language}
            >
              <span className="text-sm text-text dark:text-dark-text">
                {LANGUAGE_NAMES[lang]}
              </span>
              {lang === language && (
                <svg
                  className="w-4 h-4 text-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
