"use client"
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Language, 
  DEFAULT_LANGUAGE, 
  isValidLanguage,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
} from '@/lib/i18n'
import { clientLog } from '@/lib/client-logger'

const STORAGE_KEY = 'selected-language'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  languageName: string
  supportedLanguages: readonly Language[]
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function getStoredLanguage(): Language | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isValidLanguage(stored)) {
      return stored
    }
  } catch (error) {
    clientLog.warn('Failed to read language from localStorage:', error)
  }
  
  return null
}

function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch (error) {
    clientLog.warn('Failed to save language to localStorage:', error)
  }
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation()
  
  const [language, setLanguageState] = useState<Language>(() => {
    return getStoredLanguage() ?? DEFAULT_LANGUAGE
  })

  // Sync i18n with initial language on mount
  useEffect(() => {
    const storedLang = getStoredLanguage()
    if (storedLang && storedLang !== i18n.language) {
      i18n.changeLanguage(storedLang)
      setLanguageState(storedLang)
    }
  }, [i18n])

  const setLanguage = useCallback((lang: Language) => {
    if (!isValidLanguage(lang)) {
      clientLog.error('Invalid language:', lang)
      return
    }

    if (lang === language) {
      return
    }

    clientLog.info('Changing language to:', lang)
    
    // Update i18next
    i18n.changeLanguage(lang)
    
    // Update state
    setLanguageState(lang)
    
    // Save to localStorage
    setStoredLanguage(lang)
    
    clientLog.info('Language changed successfully to:', lang)
  }, [language, i18n])

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && isValidLanguage(e.newValue)) {
        const newLang = e.newValue as Language
        i18n.changeLanguage(newLang)
        setLanguageState(newLang)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [i18n])

  const value: LanguageContextType = {
    language,
    setLanguage,
    languageName: LANGUAGE_NAMES[language],
    supportedLanguages: SUPPORTED_LANGUAGES,
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export function useCurrentLanguage(): Language {
  const { language } = useLanguage()
  return language
}
