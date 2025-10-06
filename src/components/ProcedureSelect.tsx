"use client"
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, useMemo, MouseEvent } from 'react'
import { useSelectedMasterId } from '@/contexts/MasterContext'

type Procedure = { id: string; name_pl: string; duration_min: number; price_pln?: number | string }

export default function ProcedureSelect({ valueId, onChange }: { valueId?: string; onChange?: (p: Procedure | null) => void }) {
  const masterId = useSelectedMasterId()
  const { data, isLoading } = useQuery({
    queryKey: ['procedures', masterId],
    queryFn: () => fetch(`/api/procedures?masterId=${masterId}`).then(r => r.json()),
    staleTime: 60 * 60 * 1000, // 1 hour - procedures rarely change
  })
  
  // Memoize items array to prevent unnecessary re-renders
  const items = useMemo<Procedure[]>(() => data?.items || [], [data?.items])
  
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Procedure | null>(null)

  useEffect(() => {
    setSelected(prev => {
      if (!valueId) {
        return prev ? null : prev
      }
      const match = items.find(p => p.id === valueId) ?? null
      if (!match) {
        return prev ? null : prev
      }
      return prev?.id === match.id ? prev : match
    })
  }, [valueId, items])

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (open) {
        setOpen(false)
      } else if (selected) {
        setSelected(null)
        onChange?.(null)
      }
    }
  }

  return (
    <div className="relative lg:-m-4 lg:p-4" onClick={handleCardClick}>
      <label className="block text-sm text-muted dark:text-dark-muted">Usługa</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative mt-1 w-full rounded-xl border border-border bg-white/80 px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-accent dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text"
      >
        {selected ? (
          <span className="block whitespace-normal break-words">
            {selected.name_pl} - {selected.duration_min} min{selected.price_pln ? ` / ${selected.price_pln} zł` : ''}
          </span>
        ) : (
          <span className="text-muted dark:text-dark-muted">{isLoading ? 'Ładowanie…' : 'Wybierz usługę'}</span>
        )}
        <span
          className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dark:stroke-dark-muted"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${open ? 'max-h-72 opacity-100 mt-2' : 'max-h-0 opacity-0'} bg-white/90 border border-border rounded-xl dark:bg-dark-card/90 dark:border-dark-border`}
      >
        <ul className="max-h-72 overflow-auto p-1">
          {items.map(p => (
            <li key={p.id}>
              <button
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary/60 focus:bg-primary/60 focus:outline-none whitespace-normal break-words dark:text-dark-text dark:hover:bg-dark-border/60"
                onClick={() => {
                  setSelected(p)
                  setOpen(false)
                  onChange?.(p)
                }}
              >
                {p.name_pl} - {p.duration_min} min{p.price_pln ? ` / ${p.price_pln} zł` : ''}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
