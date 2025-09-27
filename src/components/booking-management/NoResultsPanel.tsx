"use client"

interface NoResultsPanelProps {
  onBack: () => void
}

export default function NoResultsPanel({ onBack }: NoResultsPanelProps) {
  return (
    <div className="space-y-4">
      <div className="text-center py-8 text-neutral-500 dark:text-dark-muted text-sm">
        Nie znaleziono rezerwacji dla podanych danych.
      </div>
      <button type="button" onClick={onBack} className="btn btn-primary w-full">
        Powrót do wyszukiwania
      </button>
    </div>
  )
}
