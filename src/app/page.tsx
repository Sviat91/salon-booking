"use client"
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import MasterSelector from '@/components/MasterSelector'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageToggle from '@/components/LanguageToggle'
import Image from 'next/image'
import { MASTER_IDS } from '@/config/masters'

/**
 * Landing Page - Master Selection
 * First page users see when visiting the site
 * Allows selection between different beauty masters
 * 
 * Prefetches procedures for both masters to ensure instant loading
 */
export default function HomePage() {
  const queryClient = useQueryClient()

  // Prefetch procedures for BOTH masters while user is viewing selection
  useEffect(() => {
    MASTER_IDS.forEach((masterId) => {
      queryClient.prefetchQuery({
        queryKey: ['procedures', masterId],
        queryFn: () => fetch(`/api/procedures?masterId=${masterId}`).then(r => r.json()),
        staleTime: 60 * 60 * 1000, // 1 hour
      })
    })
  }, [queryClient])

  return (
    <main className="flex flex-col relative pb-4">
      {/* Theme and Language toggles */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      
      {/* Desktop Logo - top left */}
      <div className="absolute left-4 top-4 z-10 hidden lg:block">
        {/* Light theme */}
        <Image
          src="/head_logo.png"
          alt="Logo Somique Beauty"
          width={242}
          height={97}
          className="h-auto dark:hidden"
          priority
        />
        {/* Dark theme */}
        <Image
          src="/head_logo_night.png"
          alt="Logo Somique Beauty"
          width={242}
          height={97}
          className="h-auto hidden dark:block"
          priority
        />
      </div>

      {/* Mobile Logo - centered */}
      <div className="block lg:hidden pt-6 pb-2 px-4 text-center">
        {/* Light theme */}
        <Image
          src="/head_logo.png"
          alt="Logo Somique Beauty"
          width={200}
          height={80}
          className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto dark:hidden"
          priority
        />
        {/* Dark theme */}
        <Image
          src="/head_logo_night.png"
          alt="Logo Somique Beauty"
          width={200}
          height={80}
          className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto hidden dark:block"
          priority
        />
      </div>

      {/* Master Selector */}
      <div className="flex justify-center px-4 pt-8 lg:pt-24">
        <MasterSelector />
      </div>
    </main>
  )
}
