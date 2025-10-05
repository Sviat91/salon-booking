"use client"
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { 
  Master, 
  MasterId, 
  DEFAULT_MASTER_ID, 
  getMasterByIdSafe,
  isValidMasterId,
  MASTERS 
} from '@/config/masters'
import { clientLog } from '@/lib/client-logger'

const STORAGE_KEY = 'selected-master'

/**
 * Master Context type definition
 */
interface MasterContextType {
  /** Currently selected master */
  selectedMaster: Master
  /** Currently selected master ID */
  selectedMasterId: MasterId
  /** Change the selected master */
  setMaster: (masterId: MasterId) => void
  /** Check if a specific master is selected */
  isMasterSelected: (masterId: MasterId) => boolean
  /** Reset to default master */
  resetMaster: () => void
}

const MasterContext = createContext<MasterContextType | undefined>(undefined)

/**
 * Read master ID from localStorage
 */
function getStoredMasterId(): MasterId | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && isValidMasterId(stored)) {
      return stored as MasterId
    }
  } catch (error) {
    clientLog.warn('Failed to read master from localStorage:', error)
  }
  
  return null
}

/**
 * Save master ID to localStorage
 */
function setStoredMasterId(masterId: MasterId): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, masterId)
  } catch (error) {
    clientLog.warn('Failed to save master to localStorage:', error)
  }
}

/**
 * Master Context Provider
 * Manages selected master state with localStorage persistence
 */
export const MasterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient()
  
  // Initialize state from localStorage or default
  const [selectedMasterId, setSelectedMasterId] = useState<MasterId>(() => {
    return getStoredMasterId() ?? DEFAULT_MASTER_ID
  })
  const selectedMasterIdRef = useRef<MasterId>(selectedMasterId)
  
  useEffect(() => {
    selectedMasterIdRef.current = selectedMasterId
  }, [selectedMasterId])

  const selectedMaster = MASTERS[selectedMasterId]

  /**
   * Change the selected master
   * - Saves to localStorage
   * - Invalidates all booking-related queries
   */
  const setMaster = useCallback((masterId: MasterId) => {
    if (!isValidMasterId(masterId)) {
      clientLog.error('Invalid master ID:', masterId)
      return
    }

    // Skip if already selected (prevents unnecessary re-renders and animations)
    if (masterId === selectedMasterIdRef.current) {
      clientLog.info('Master already selected:', masterId)
      return
    }

    clientLog.info('Changing master to:', masterId)
    
    // Update ref immediately so downstream hooks see the new value even before React flushes state
    selectedMasterIdRef.current = masterId

    // Update state
    setSelectedMasterId(masterId)
    
    // Save to localStorage
    setStoredMasterId(masterId)
    
    // Invalidate all booking-related queries to force refetch with new master
    queryClient.invalidateQueries({ queryKey: ['procedures'] })
    queryClient.invalidateQueries({ queryKey: ['availability'] })
    queryClient.invalidateQueries({ queryKey: ['day-slots'] })
    queryClient.invalidateQueries({ queryKey: ['bookings'] })
    
    clientLog.info('Master changed successfully. Cache invalidated.')
  }, [queryClient])

  /**
   * Check if a specific master is currently selected
   */
  const isMasterSelected = useCallback((masterId: MasterId) => {
    return selectedMasterId === masterId
  }, [selectedMasterId])

  /**
   * Reset to default master
   */
  const resetMaster = useCallback(() => {
    setMaster(DEFAULT_MASTER_ID)
  }, [setMaster])

  // Sync with localStorage on mount (for cases when localStorage changes in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && isValidMasterId(e.newValue)) {
        const newId = e.newValue as MasterId
        selectedMasterIdRef.current = newId
        setSelectedMasterId(newId)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const value: MasterContextType = {
    selectedMaster,
    selectedMasterId,
    setMaster,
    isMasterSelected,
    resetMaster,
  }

  return <MasterContext.Provider value={value}>{children}</MasterContext.Provider>
}

/**
 * Hook to access master context
 * @throws Error if used outside MasterProvider
 */
export function useMaster(): MasterContextType {
  const context = useContext(MasterContext)
  if (context === undefined) {
    throw new Error('useMaster must be used within a MasterProvider')
  }
  return context
}

/**
 * Hook to get only the selected master (convenience hook)
 */
export function useSelectedMaster(): Master {
  const { selectedMaster } = useMaster()
  return selectedMaster
}

/**
 * Hook to get only the selected master ID (convenience hook)
 */
export function useSelectedMasterId(): MasterId {
  const { selectedMasterId } = useMaster()
  return selectedMasterId
}
