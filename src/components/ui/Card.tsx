"use client"
import type { ReactNode } from 'react'

export default function Card({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  const base = 'rounded-2xl bg-white/70 backdrop-blur border border-border shadow-sm p-4'
  return (
    <section className={`${base}${className ? ` ${className}` : ''}`}>
      {title ? <h2 className="text-lg font-medium mb-3 text-text/90">{title}</h2> : null}
      {children}
    </section>
  )
}
