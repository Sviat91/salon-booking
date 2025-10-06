import { describe, it, expect } from 'vitest'
import {
  MASTERS,
  MASTER_IDS,
  DEFAULT_MASTER_ID,
  isValidMasterId,
  getMasterById,
  getMasterByIdSafe,
  getAllMasters,
  type MasterId,
} from '@/config/masters'

describe('Master Configuration', () => {
  describe('MASTERS constant', () => {
    it('should have exactly 2 masters defined', () => {
      expect(Object.keys(MASTERS)).toHaveLength(2)
    })

    it('should have olga master configured', () => {
      expect(MASTERS.olga).toBeDefined()
      expect(MASTERS.olga.id).toBe('olga')
      expect(MASTERS.olga.name).toBe('Olga')
      expect(MASTERS.olga.avatar).toBe('/photo_master_olga.png')
    })

    it('should have juli master configured', () => {
      expect(MASTERS.juli).toBeDefined()
      expect(MASTERS.juli.id).toBe('juli')
      expect(MASTERS.juli.name).toBe('Juli')
      expect(MASTERS.juli.avatar).toBe('/photo_master_juli.png')
    })
  })

  describe('MASTER_IDS constant', () => {
    it('should contain both master IDs', () => {
      expect(MASTER_IDS).toEqual(['olga', 'juli'])
    })

    it('should be readonly', () => {
      expect(Object.isFrozen(MASTER_IDS)).toBe(true)
    })
  })

  describe('DEFAULT_MASTER_ID constant', () => {
    it('should default to olga', () => {
      expect(DEFAULT_MASTER_ID).toBe('olga')
    })
  })

  describe('isValidMasterId()', () => {
    it('should return true for valid master IDs', () => {
      expect(isValidMasterId('olga')).toBe(true)
      expect(isValidMasterId('juli')).toBe(true)
    })

    it('should return false for invalid master IDs', () => {
      expect(isValidMasterId('invalid')).toBe(false)
      expect(isValidMasterId('anna')).toBe(false)
      expect(isValidMasterId('')).toBe(false)
      expect(isValidMasterId('OLGA')).toBe(false) // case sensitive
    })

    it('should handle edge cases', () => {
      expect(isValidMasterId(null as any)).toBe(false)
      expect(isValidMasterId(undefined as any)).toBe(false)
      expect(isValidMasterId(123 as any)).toBe(false)
    })
  })

  describe('getMasterById()', () => {
    it('should return correct master for valid ID', () => {
      const olga = getMasterById('olga')
      expect(olga.id).toBe('olga')
      expect(olga.name).toBe('Olga')

      const juli = getMasterById('juli')
      expect(juli.id).toBe('juli')
      expect(juli.name).toBe('Juli')
    })

    it('should throw error for invalid ID', () => {
      expect(() => getMasterById('invalid')).toThrow('Invalid master ID')
      expect(() => getMasterById('')).toThrow('Invalid master ID')
    })
  })

  describe('getMasterByIdSafe()', () => {
    it('should return correct master for valid ID', () => {
      const olga = getMasterByIdSafe('olga')
      expect(olga.id).toBe('olga')

      const juli = getMasterByIdSafe('juli')
      expect(juli.id).toBe('juli')
    })

    it('should return default master for invalid ID', () => {
      const master1 = getMasterByIdSafe('invalid')
      expect(master1.id).toBe(DEFAULT_MASTER_ID)

      const master2 = getMasterByIdSafe(null)
      expect(master2.id).toBe(DEFAULT_MASTER_ID)

      const master3 = getMasterByIdSafe(undefined)
      expect(master3.id).toBe(DEFAULT_MASTER_ID)

      const master4 = getMasterByIdSafe('')
      expect(master4.id).toBe(DEFAULT_MASTER_ID)
    })
  })

  describe('getAllMasters()', () => {
    it('should return array of all masters', () => {
      const masters = getAllMasters()
      expect(masters).toHaveLength(2)
      expect(masters[0].id).toBe('olga')
      expect(masters[1].id).toBe('juli')
    })

    it('should return masters in correct order', () => {
      const masters = getAllMasters()
      expect(masters.map(m => m.id)).toEqual(['olga', 'juli'])
    })
  })

  describe('Master data integrity', () => {
    it('should have unique IDs', () => {
      const ids = getAllMasters().map(m => m.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have unique names', () => {
      const names = getAllMasters().map(m => m.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it('should have valid avatar paths', () => {
      getAllMasters().forEach(master => {
        expect(master.avatar).toMatch(/^\/photo_master_.+\.png$/)
      })
    })

    it('should have all required fields', () => {
      getAllMasters().forEach(master => {
        expect(master).toHaveProperty('id')
        expect(master).toHaveProperty('name')
        expect(master).toHaveProperty('avatar')
        expect(typeof master.id).toBe('string')
        expect(typeof master.name).toBe('string')
        expect(typeof master.avatar).toBe('string')
      })
    })
  })
})
