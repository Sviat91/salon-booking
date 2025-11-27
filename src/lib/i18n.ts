import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import pl from '@/locales/pl.json'
import uk from '@/locales/uk.json'
import en from '@/locales/en.json'

export const SUPPORTED_LANGUAGES = ['pl', 'uk', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'pl'

export const LANGUAGE_NAMES: Record<Language, string> = {
  pl: 'Polski',
  uk: 'Українська',
  en: 'English',
}

export function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language)
}

const resources = {
  pl: { translation: pl },
  uk: { translation: uk },
  en: { translation: en },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })

export default i18n
