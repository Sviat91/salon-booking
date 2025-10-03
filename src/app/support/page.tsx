"use client"
import type { Metadata } from 'next'
import BackButton from '../../components/BackButton'
import ThemeToggle from '../../components/ThemeToggle'
import ConsentWithdrawalModal from '../../components/ConsentWithdrawalModal'
import DataErasureModal from '../../components/DataErasureModal'
import DataExportModal from '../../components/DataExportModal'
import { useState, useRef, useEffect } from 'react'
import { clientLog } from '@/lib/client-logger'

export default function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isConsentModalOpen, setConsentModalOpen] = useState(false)
  const [isErasureModalOpen, setErasureModalOpen] = useState(false)
  const [isExportModalOpen, setExportModalOpen] = useState(false)
  
  // Turnstile
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  // Load Turnstile
  useEffect(() => {
    if (!siteKey) return
    const scriptId = 'cf-turnstile'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const interval = setInterval(() => {
      const turnstile = (window as any)?.turnstile
      if (turnstile && turnstileRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            language: 'pl',
            callback: (token: string) => setTurnstileToken(token),
          })
          clearInterval(interval)
        } catch (error) {
          clientLog.warn('Turnstile render failed:', error)
        }
      }
    }, 200)

    return () => {
      clearInterval(interval)
      if (turnstileRef.current && widgetIdRef.current) {
        const turnstile = (window as any)?.turnstile
        if (turnstile) {
          try {
            turnstile.remove(widgetIdRef.current)
          } catch (error) {
            clientLog.warn('Turnstile cleanup failed:', error)
          }
        }
      }
      widgetIdRef.current = null
    }
  }, [siteKey])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)
    
    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({...formData, turnstileToken}),
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitted(true)
        setFormData({ name: '', email: '', subject: '', message: '' })
      } else {
        // Handle API errors
        if (result.field) {
          setSubmitError(`${result.field}: ${result.error}`)
        } else {
          setSubmitError(result.error || 'Wystąpił błąd podczas wysyłania wiadomości')
        }
      }
    } catch (error) {
      clientLog.error('Contact form submission failed:', error)
      setSubmitError('Wystąpił błąd połączenia. Sprawdź połączenie internetowe i spróbuj ponownie.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleOpenConsentModal = () => {
    setErasureModalOpen(false)
    setExportModalOpen(false)
    setConsentModalOpen(true)
  }

  const handleOpenErasureModal = () => {
    setConsentModalOpen(false)
    setExportModalOpen(false)
    setErasureModalOpen(true)
  }

  const handleOpenExportModal = () => {
    setConsentModalOpen(false)
    setErasureModalOpen(false)
    setExportModalOpen(true)
  }

  const handleCloseAllModals = () => {
    setConsentModalOpen(false)
    setErasureModalOpen(false)
    setExportModalOpen(false)
  }

  return (
    <main className="min-h-screen relative">
      <BackButton />
      <ThemeToggle />
      <div className="container mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-3">
            Centrum Pomocy
          </h1>
          <p className="text-neutral-600 dark:text-dark-muted max-w-2xl mx-auto">
            Potrzebujesz pomocy? Jesteśmy tutaj, aby odpowiedzieć na Twoje pytania i rozwiązać problemy.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-border dark:border-dark-border p-6">
              <h2 className="text-xl font-semibold text-text dark:text-dark-text mb-4">
                Skontaktuj się z nami
              </h2>
              
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-text dark:text-dark-text mb-2">Wiadomość wysłana!</h3>
                  <p className="text-neutral-600 dark:text-dark-muted mb-6">
                    Dziękujemy za kontakt. Odpowiemy na Twoją wiadomość w ciągu 72 godzin.
                  </p>
                  <button 
                    onClick={() => {
                      setSubmitted(false)
                      setSubmitError(null)
                    }}
                    className="btn btn-primary"
                  >
                    Wyślij kolejną wiadomość
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                        Imię i nazwisko *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full rounded-xl border border-border bg-white/80 px-4 py-3 dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Wprowadź swoje imię i nazwisko"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                        E-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full rounded-xl border border-border bg-white/80 px-4 py-3 dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="twoj.email@example.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                      Temat *
                    </label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      className="w-full rounded-xl border border-border bg-white/80 px-4 py-3 dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Wybierz temat</option>
                      <option value="booking">Problemy z rezerwacją</option>
                      <option value="cancellation">Anulowanie/zmiana wizyty</option>
                      <option value="payment">Płatności i faktury</option>
                      <option value="technical">Problemy techniczne ze stroną</option>
                      <option value="privacy">Ochrona danych osobowych</option>
                      <option value="other">Inne pytanie</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text dark:text-dark-text mb-2">
                      Wiadomość *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      className="w-full rounded-xl border border-border bg-white/80 px-4 py-3 dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      placeholder="Opisz szczegółowo swój problem lub pytanie..."
                    />
                  </div>
                  
                  {submitError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-200">
                      <p className="font-medium">Błąd wysyłania</p>
                      <p>{submitError}</p>
                    </div>
                  )}

                  {/* Turnstile */}
                  {siteKey && (
                    <div className="flex justify-center">
                      <div ref={turnstileRef} className="rounded-xl"></div>
                    </div>
                  )}

                  {siteKey && !turnstileToken && (
                    <div className="text-xs text-neutral-500 dark:text-dark-muted text-center">
                      Potwierdź weryfikację Turnstile, aby kontynuować.
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isSubmitting || !!(siteKey && !turnstileToken)}
                    className={`btn btn-primary w-full py-3 ${isSubmitting || (siteKey && !turnstileToken) ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? 'Wysyłanie...' : 'Wyślij wiadomość'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-border dark:border-dark-border p-5">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-3">
                Informacje kontaktowe
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 dark:bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary dark:text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-text dark:text-dark-text">Adres</h4>
                    <p className="text-sm text-neutral-600 dark:text-dark-muted">
                      Sarmacka 4B/ lokal 106<br />
                      02-972 Warszawa
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 dark:bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary dark:text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-text dark:text-dark-text">Czas odpowiedzi</h4>
                    <p className="text-sm text-neutral-600 dark:text-dark-muted">
                      Zwykle w ciągu 72 godzin<br />
                      w dni robocze
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-border dark:border-dark-border p-5">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-3">
                Szybkie akcje
              </h3>
              <div className="space-y-3">
                <button 
                  onClick={handleOpenErasureModal}
                  className="w-full text-left p-3 rounded-lg border border-border dark:border-dark-border hover:bg-primary/5 dark:hover:bg-accent/5 transition-colors"
                >
                  <div className="font-medium text-text dark:text-dark-text text-sm">Usuń moje dane</div>
                  <div className="text-xs text-neutral-600 dark:text-dark-muted">Zgodnie z GDPR</div>
                </button>
                
                <button 
                  onClick={handleOpenExportModal}
                  className="w-full text-left p-3 rounded-lg border border-border dark:border-dark-border hover:bg-primary/5 dark:hover:bg-accent/5 transition-colors"
                >
                  <div className="font-medium text-text dark:text-dark-text text-sm">Pobierz moje dane</div>
                  <div className="text-xs text-neutral-600 dark:text-dark-muted">Eksport danych osobowych</div>
                </button>
                
                <button 
                  onClick={handleOpenConsentModal}
                  className="w-full text-left p-3 rounded-lg border border-border dark:border-dark-border hover:bg-primary/5 dark:hover:bg-accent/5 transition-colors"
                >
                  <div className="font-medium text-text dark:text-dark-text text-sm">Wycofaj zgody</div>
                  <div className="text-xs text-neutral-600 dark:text-dark-muted">Zarządzanie zgodami</div>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
      <ConsentWithdrawalModal isOpen={isConsentModalOpen} onClose={handleCloseAllModals} />
      <DataErasureModal isOpen={isErasureModalOpen} onClose={handleCloseAllModals} />
      <DataExportModal isOpen={isExportModalOpen} onClose={handleCloseAllModals} />
    </main>
  )
}
