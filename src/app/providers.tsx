"use client"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRef } from 'react'
import { LayoutGroup } from 'framer-motion'
import { MasterProvider } from '@/contexts/MasterContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Providers({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<QueryClient>()
  if (!clientRef.current) clientRef.current = new QueryClient({
    defaultOptions: {
      queries: { 
        staleTime: 10 * 60 * 1000, // 10 minutes default
        gcTime: 30 * 60 * 1000, // 30 minutes - keep unused cache longer for better UX
        refetchOnWindowFocus: false,
      },
    }
  })

  // Prefetch moved to landing page (page.tsx) - prefetches for BOTH masters

  return (
    <ErrorBoundary>
      <QueryClientProvider client={clientRef.current}>
        <MasterProvider>
          <LayoutGroup>
            {children}
          </LayoutGroup>
        </MasterProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

