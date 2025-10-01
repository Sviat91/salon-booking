"use client"
import { forwardRef, type ReactNode } from 'react'

const Card = forwardRef<
  HTMLElement,
  {
    title?: string
    children: ReactNode
    className?: string
  }
>(({ title, children, className }, ref) => {
  const base = 'rounded-2xl bg-white/70 backdrop-blur border border-border shadow-sm p-4 overflow-visible dark:bg-dark-card/80 dark:border-dark-border dark:text-dark-text box-border'
  return (
    <section ref={ref} className={`${base}${className ? ` ${className}` : ''}`}>
      {title ? <h2 className="text-lg font-medium mb-3 text-text/90 dark:text-dark-text">{title}</h2> : null}
      {children}
    </section>
  )
})
Card.displayName = 'Card'

export default Card
