"use client"
import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  // Синхронизируем состояние с уже установленной темой
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
  }, [])

  // Отслеживаем скролл для скрытия переключателя
  useEffect(() => {
    let lastScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Показываем когда скроллим вверх или в самом верху
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setIsVisible(true)
      } else {
        // Скрываем когда скроллим вниз
        setIsVisible(false)
      }
      
      lastScrollY = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
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
      className={`fixed top-4 right-4 z-20 p-2 hover:opacity-80 transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-20 opacity-0 pointer-events-none'
      }`}
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
