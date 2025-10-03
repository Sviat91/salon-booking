"use client"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

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

  // Prefetch procedures once on mount
  useEffect(() => {
    clientRef.current!.prefetchQuery({ queryKey: ['procedures'], queryFn: () => fetch('/api/procedures').then(r => r.json()) })
  }, [])

  return <QueryClientProvider client={clientRef.current}>{children}</QueryClientProvider>
}

