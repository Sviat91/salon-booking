"use client"
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useSelectedMaster } from '@/contexts/MasterContext'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface BrandHeaderProps {
  onLogoClick?: () => void
}

export default function BrandHeader({ onLogoClick }: BrandHeaderProps) {
  const { t } = useTranslation()
  const selectedMaster = useSelectedMaster()
  const logoClickable = typeof onLogoClick === 'function'
  const prefersReducedMotion = useReducedMotion()
  
  return (
    <header className="flex flex-col items-center gap-3 py-4 lg:py-6">
      <motion.div
        layoutId={prefersReducedMotion ? undefined : `master-photo-${selectedMaster.id}`}
        className={`h-20 w-20 rounded-full overflow-hidden ring-2 ring-accent/70 shadow-sm bg-white${
          logoClickable ? ' cursor-pointer' : ''
        }`}
        onClick={onLogoClick}
        transition={prefersReducedMotion ? { duration: 0 } : { 
          type: "spring", 
          stiffness: 200, 
          damping: 25,
          duration: 1.2
        }}
      >
        <Image 
          src={selectedMaster.avatar} 
          alt={`${selectedMaster.name} - Beauty Master`} 
          width={80} 
          height={80} 
          className="h-20 w-20 object-cover" 
        />
      </motion.div>
      
      {/* head_logo показывается только на мобильных устройствах */}
      <div
        className={`block lg:hidden mt-3 mb-2 px-4${logoClickable ? ' cursor-pointer' : ''}`}
        onClick={onLogoClick}
      >
        {/* Светлая тема */}
        <Image
          src="/head_logo.png"
          alt="Logo Somique Beauty"
          width={200}
          height={80}
          className="h-auto max-w-[180px] sm:max-w-[200px] mx-auto dark:hidden"
        />
        {/* Темная тема */}
        <Image
          src="/head_logo_night.png"
          alt="Logo Somique Beauty"
          width={200}
          height={80}
          className="h-auto max-w-[180px] sm:max-w-[200px] mx-auto hidden dark:block"
        />
      </div>
      
      <h1
        className={`text-4xl font-semibold tracking-tight${logoClickable ? ' cursor-pointer' : ''}`}
        onClick={onLogoClick}
      >
        {t('booking.bookVisit')}
      </h1>
    </header>
  )
}
