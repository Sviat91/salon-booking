"use client"
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

type Procedure = { id: string; name_pl: string; duration_min: number }

export default function ProcedureSelect({ valueId, onChange }: { valueId?: string; onChange?: (p: Procedure | null) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['procedures'],
    queryFn: () => fetch('/api/procedures').then(r => r.json()),
  })
  const items: Procedure[] = data?.items || []
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

  return (
    <div className="relative">
      <label className="block text-sm text-muted">Service</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative mt-1 w-full rounded-xl border border-border bg-white/80 px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {selected ? (
          <span className="block whitespace-normal break-words">
            {selected.name_pl} - {selected.duration_min} min
          </span>
        ) : (
          <span className="text-muted">{isLoading ? 'Loading...' : 'Choose a service'}</span>
        )}
        <span
          className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </span>
      </button>
      <div
        className={`absolute left-0 top-full z-10 mt-2 w-full rounded-xl border border-border bg-white/95 shadow-lg transition-opacity duration-150 ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <ul className="max-h-72 overflow-auto p-1">
          {items.map(p => (
            <li key={p.id}>
              <button
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-primary/60 focus:bg-primary/60 focus:outline-none whitespace-normal break-words"
                onClick={() => {
                  setSelected(p)
                  setOpen(false)
                  onChange?.(p)
                }}
              >
                {p.name_pl} - {p.duration_min} min
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
