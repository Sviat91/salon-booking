"use client"
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()
  
  return (
    <footer className="py-3">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <div className="text-sm text-neutral-500 dark:text-dark-muted">
            <Link 
              href="/privacy" 
              className="hover:text-primary dark:hover:text-accent transition-colors"
            >
              {t('footer.privacy')}
            </Link>
            <span className="mx-2">•</span>
            <Link 
              href="/terms" 
              className="hover:text-primary dark:hover:text-accent transition-colors"
            >
              {t('footer.terms')}
            </Link>
            <span className="mx-2">•</span>
            <Link 
              href="/support" 
              className="hover:text-primary dark:hover:text-accent transition-colors"
            >
              {t('support.title')}
            </Link>
            <span className="mx-4">|</span>
            <span>{t('footer.copyright', '© 2025 Somique Beauty. Wszystkie prawa zastrzeżone.')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
