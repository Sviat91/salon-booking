import { describe, it, expect } from 'vitest'
import { normalizeString } from '@/lib/utils/string-normalization'

describe('normalizeString', () => {
  describe('Basic normalization', () => {
    it('should trim whitespace', () => {
      expect(normalizeString('  hello  ')).toBe('hello')
    })

    it('should convert to lowercase', () => {
      expect(normalizeString('HELLO')).toBe('hello')
      expect(normalizeString('Hello World')).toBe('hello world')
    })

    it('should trim and lowercase together', () => {
      expect(normalizeString('  HELLO WORLD  ')).toBe('hello world')
    })
  })

  describe('Cyrillic conversion', () => {
    it('should convert Ukrainian Cyrillic to Latin', () => {
      expect(normalizeString('Київ')).toBe('kyiv')
      expect(normalizeString('Україна')).toBe('ukraina')
    })

    it('should convert Russian Cyrillic to Latin', () => {
      expect(normalizeString('Москва')).toBe('moskva')
      expect(normalizeString('Россия')).toBe('rossiia')
    })

    it('should convert Polish diacritics', () => {
      expect(normalizeString('Łódź')).toBe('lodz')
      expect(normalizeString('Kraków')).toBe('krakow')
      expect(normalizeString('Wrocław')).toBe('wroclaw')
    })

    it('should handle mixed scripts', () => {
      expect(normalizeString('Hello Світ')).toBe('hello svit')
      expect(normalizeString('Test Тест')).toBe('test test')
    })
  })

  describe('Special characters', () => {
    it('should preserve spaces', () => {
      expect(normalizeString('hello world')).toBe('hello world')
    })

    it('should handle multiple spaces', () => {
      expect(normalizeString('hello    world')).toBe('hello    world')
    })

    it('should handle hyphens and dashes', () => {
      expect(normalizeString('test-name')).toBe('test-name')
      expect(normalizeString('test—name')).toBe('test—name')
    })

    it('should handle apostrophes', () => {
      expect(normalizeString("O'Brien")).toBe("o'brien")
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(normalizeString('')).toBe('')
    })

    it('should handle only whitespace', () => {
      expect(normalizeString('   ')).toBe('')
    })

    it('should handle single character', () => {
      expect(normalizeString('A')).toBe('a')
      expect(normalizeString('Ł')).toBe('l')
    })

    it('should handle numbers', () => {
      expect(normalizeString('Test 123')).toBe('test 123')
    })
  })

  describe('Real-world names', () => {
    it('should normalize Polish names', () => {
      expect(normalizeString('Andrzej Błażej')).toBe('andrzej blazej')
      expect(normalizeString('Małgorzata Nowak')).toBe('malgorzata nowak')
    })

    it('should normalize Ukrainian names', () => {
      expect(normalizeString('Олександр Іванов')).toBe('oleksandr ivanov')
      expect(normalizeString('Наталія Коваль')).toBe('nataliia koval')
    })

    it('should normalize Russian names', () => {
      expect(normalizeString('Александр Петров')).toBe('aleksandr petrov')
      expect(normalizeString('Наталья Сидорова')).toBe('natalia sidorova')
    })

    it('should handle compound names', () => {
      expect(normalizeString('Jean-Pierre Dupont')).toBe('jean-pierre dupont')
    })
  })

  describe('Consistency', () => {
    it('should produce same result for equivalent inputs', () => {
      const input1 = '  ТЕСТ  '
      const input2 = 'тест'
      const input3 = 'ТЕСТ'
      
      const result = normalizeString(input1)
      expect(normalizeString(input2)).toBe(result)
      expect(normalizeString(input3)).toBe(result)
    })
  })
})
