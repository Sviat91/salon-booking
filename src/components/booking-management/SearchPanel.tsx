"use client"
import PhoneInput from '../ui/PhoneInput'
import type { SearchFormData } from './types'

interface SearchPanelProps {
  form: SearchFormData
  onFormChange: (next: Partial<SearchFormData>) => void
  canSearch: boolean
  isLoading: boolean
  errorMessage?: string | null
  onSearch: () => void
  onExtendedSearch?: () => void
}

export default function SearchPanel({
  form,
  onFormChange,
  canSearch,
  isLoading,
  errorMessage,
  onSearch,
  onExtendedSearch,
}: SearchPanelProps) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-neutral-600 dark:text-dark-muted">
        Wprowadź swoje dane, aby znaleźć rezerwację:
      </div>

      <div className="space-y-3">
        <input
          className="w-full rounded-xl border border-border bg-white/80 px-3 py-2 dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
          placeholder="Imię i nazwisko"
          value={form.fullName}
          onChange={(event) => onFormChange({ fullName: event.target.value })}
          autoComplete="name"
        />

        <PhoneInput
          value={form.phone}
          onChange={(value) => onFormChange({ phone: value })}
          placeholder="Telefon"
          error={errorMessage && errorMessage.includes('telefon') ? errorMessage : undefined}
        />

        <input
          className="w-full rounded-xl border border-border bg-white/80 px-3 py-2 dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text dark:placeholder-dark-muted"
          placeholder="E-mail (opcjonalnie)"
          type="email"
          value={form.email}
          onChange={(event) => onFormChange({ email: event.target.value })}
          autoComplete="email"
        />
      </div>

      {errorMessage && !errorMessage.includes('telefon') ? (
        <div className="text-sm text-red-600 dark:text-red-400">{errorMessage}</div>
      ) : null}

      <button
        type="button"
        disabled={!canSearch || isLoading}
        onClick={onSearch}
        className={`btn btn-primary w-full ${!canSearch || isLoading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {isLoading ? 'Szukanie…' : 'Szukaj rezerwacji'}
      </button>

      <div className="text-center">
        <button
          type="button"
          className="text-sm text-accent hover:text-accent/80 dark:text-dark-accent dark:hover:text-dark-accent/80"
          onClick={onExtendedSearch}
        >
          Nie możesz znaleźć? Rozszerz zakres dat
        </button>
      </div>
    </div>
  )
}
