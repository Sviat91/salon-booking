"use client"
import type { Metadata } from 'next'
import BackButton from '../../components/BackButton'
import ConsentWithdrawalModal from '../../components/ConsentWithdrawalModal'
import { useState } from 'react'

export default function SupportPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isConsentModalOpen, setConsentModalOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // TODO: Implement actual form submission
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setSubmitted(true)
    setIsSubmitting(false)
    setFormData({ name: '', email: '', subject: '', message: '' })
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FFF6E9] to-[#FDE5C3] dark:from-[#9c6849] dark:to-[#7A4F35] transition-all duration-300">
      <BackButton />
      <div className="container mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text dark:text-dark-text mb-3">
            Centrum Pomocy
          </h1>
          <p className="text-neutral-600 dark:text-dark-muted max-w-2xl mx-auto">
            Potrzebujesz pomocy? Jesteśmy tutaj, aby odpowiedzieć na Twoje pytania i rozwiązać problemy.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-border dark:border-dark-border p-8">
              <h2 className="text-2xl font-semibold text-text dark:text-dark-text mb-6">
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
                    onClick={() => setSubmitted(false)}
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
                      rows={6}
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      className="w-full rounded-xl border border-border bg-white/80 px-4 py-3 dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      placeholder="Opisz szczegółowo swój problem lub pytanie..."
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`btn btn-primary w-full py-3 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? 'Wysyłanie...' : 'Wyślij wiadomość'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Contact Info */}
            <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-border dark:border-dark-border p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">
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
                      Herbu Janina 3a/40<br />
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
            <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-border dark:border-dark-border p-6">
              <h3 className="text-lg font-semibold text-text dark:text-dark-text mb-4">
                Szybkie akcje
              </h3>
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    // TODO: Implement data deletion request
                    alert('Funkcja usuwania danych - wkrótce dostępna')
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border dark:border-dark-border hover:bg-primary/5 dark:hover:bg-accent/5 transition-colors"
                >
                  <div className="font-medium text-text dark:text-dark-text text-sm">Usuń moje dane</div>
                  <div className="text-xs text-neutral-600 dark:text-dark-muted">Zgodnie z GDPR</div>
                </button>
                
                <button 
                  onClick={() => {
                    // TODO: Implement data export
                    alert('Funkcja eksportu danych - wkrótce dostępna')
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border dark:border-dark-border hover:bg-primary/5 dark:hover:bg-accent/5 transition-colors"
                >
                  <div className="font-medium text-text dark:text-dark-text text-sm">Pobierz moje dane</div>
                  <div className="text-xs text-neutral-600 dark:text-dark-muted">Eksport danych osobowych</div>
                </button>
                
                <button 
                  onClick={() => setConsentModalOpen(true)}
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
      <ConsentWithdrawalModal isOpen={isConsentModalOpen} onClose={() => setConsentModalOpen(false)} />
    </main>
  )
}
