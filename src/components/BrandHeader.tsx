"use client"
import Image from 'next/image'

interface BrandHeaderProps {
  onLogoClick?: () => void
}

export default function BrandHeader({ onLogoClick }: BrandHeaderProps) {
  const logoClickable = typeof onLogoClick === 'function'
  return (
    <header className="flex flex-col items-center gap-3 py-4 lg:py-6">
      <div
        className={`h-20 w-20 rounded-full overflow-hidden ring-2 ring-accent/70 shadow-sm bg-white${
          logoClickable ? ' cursor-pointer' : ''
        }`}
        onClick={onLogoClick}
      >
        <Image src="/logo.png" alt="Logo Somique Beauty" width={80} height={80} className="h-20 w-20 object-cover" />
      </div>
      
      {/* head_logo показывается только на мобильных устройствах */}
      <div
        className={`block lg:hidden mt-3 mb-2 px-4${logoClickable ? ' cursor-pointer' : ''}`}
        onClick={onLogoClick}
      >
        <Image
          src="/head_logo.png"
          alt="Logo Somique Beauty"
          width={200}
          height={80}
          className="h-auto max-w-[180px] sm:max-w-[200px] mx-auto"
        />
      </div>
      
      <h1
        className={`text-4xl font-semibold tracking-tight${logoClickable ? ' cursor-pointer' : ''}`}
        onClick={onLogoClick}
      >
        Zarezerwuj wizytę
      </h1>
    </header>
  )
}
