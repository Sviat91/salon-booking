"use client"
import { useState } from 'react'
import PhoneInput from '../ui/PhoneInput'
import { clientLog } from '@/lib/client-logger'

interface ContactMasterPanelProps {
  onBack: () => void
  onSuccess: () => void
}

export default function ContactMasterPanel({ onBack, onSuccess }: ContactMasterPanelProps) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // PhoneInput возвращает телефон с кодом (например "+48123456789")
  // Проверяем что есть минимум 9 цифр (без учета кода страны и символов)
  const phoneDigits = phone.replace(/\D/g, '')
  const canSubmit = fullName.trim().length >= 2 && 
                    phoneDigits.length >= 9 && 
                    message.trim().length >= 10
  
  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      clientLog.info('Sending contact form to master:', {
        fullName: fullName.trim(),
        phone: phone.trim(),
        hasEmail: !!email.trim(),
        messageLength: message.trim().length,
      })
      
      const response = await fetch('/api/master/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          message: message.trim(),
        }),
      })
      
      clientLog.info('Response status:', response.status)
      
      const data = await response.json()
      clientLog.info('Response data:', data)
      
      if (!response.ok) {
        const errorMsg = data.error || `Błąd serwera: ${response.status}`
        throw new Error(errorMsg)
      }
      
      // Success
      clientLog.info('Contact form sent successfully')
      onSuccess()
    } catch (err: any) {
      clientLog.error('Failed to send message to master:', err)
      setError(err.message || 'Wystąpił błąd podczas wysyłania wiadomości')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <div>
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-dark-text">
          Skontaktuj się z mistrzem
        </h3>
        <p className="text-sm text-neutral-600 dark:text-dark-muted mt-1">
          Mistrz - Olga
        </p>
      </div>
      
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}
      
      <div className="space-y-3">
        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-dark-text mb-1">
            Imię i nazwisko *
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="np. Jan Kowalski"
            disabled={isSubmitting}
            className="w-full max-w-full box-border px-3 py-2.5 rounded-lg border border-neutral-300 bg-white text-sm dark:border-dark-border dark:bg-dark-card dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-dark-text mb-1">
            Telefon *
          </label>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            placeholder="Numer telefonu z kodem kraju"
            disabled={isSubmitting}
          />
        </div>
        
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-dark-text mb-1">
            Email (opcjonalnie)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="np. jan@example.com"
            disabled={isSubmitting}
            className="w-full max-w-full box-border px-3 py-2.5 rounded-lg border border-neutral-300 bg-white text-sm dark:border-dark-border dark:bg-dark-card dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-dark-text mb-1">
            Wiadomość dla mistrza *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Opisz swoje pytanie lub problem..."
            rows={5}
            disabled={isSubmitting}
            className="w-full max-w-full box-border px-3 py-2.5 rounded-lg border border-neutral-300 bg-white text-sm dark:border-dark-border dark:bg-dark-card dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          />
          <div className="text-xs text-neutral-500 dark:text-dark-muted mt-1">
            Minimum 10 znaków
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 hover:border-neutral-400 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-border/50"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed dark:bg-accent dark:hover:bg-accent/90 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Wysyłanie...
            </>
          ) : (
            'Wyślij'
          )}
        </button>
      </div>
    </div>
  )
}
