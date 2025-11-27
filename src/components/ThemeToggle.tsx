"use client"
import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  // Синхронизируем состояние с уже установленной темой
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    
    // Сохраняем в localStorage
    localStorage.setItem('theme', newTheme ? 'dark' : 'light')
    
    // Применяем к document
    if (newTheme) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 hover:opacity-80 transition-opacity duration-300"
      aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
    >
      <Image
        src={isDark ? '/dark.png' : '/light.png'}
        alt={isDark ? 'Светлая тема' : 'Темная тема'}
        width={48}
        height={48}
        className="h-12 w-12"
      />
    </button>
  )
}
