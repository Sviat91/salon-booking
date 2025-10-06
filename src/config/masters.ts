/**
 * Master configuration type
 */
export interface Master {
  id: string
  name: string
  avatar: string
}

/**
 * Valid master IDs as union type
 */
export type MasterId = 'olga' | 'yuliia'

/**
 * Client-safe master configuration
 * Only includes data needed on the client side
 * Calendar and Sheet IDs are accessed server-side only
 */
export const MASTERS: Record<MasterId, Master> = {
  olga: {
    id: 'olga',
    name: 'Olga',
    avatar: '/photo_master_olga.png',
  },
  yuliia: {
    id: 'yuliia',
    name: 'Yuliia',
    avatar: '/photo_master_yuliia.png',
  },
} as const

/**
 * Array of all master IDs for iteration
 */
export const MASTER_IDS: readonly MasterId[] = ['olga', 'yuliia'] as const

/**
 * Default master (fallback)
 */
export const DEFAULT_MASTER_ID: MasterId = 'olga'

/**
 * Check if a string is a valid master ID
 */
export function isValidMasterId(id: string): id is MasterId {
  return MASTER_IDS.includes(id as MasterId)
}

/**
 * Get master configuration by ID
 * @throws Error if master ID is invalid
 */
export function getMasterById(id: string): Master {
  if (!isValidMasterId(id)) {
    throw new Error(`Invalid master ID: ${id}. Valid IDs: ${MASTER_IDS.join(', ')}`)
  }
  return MASTERS[id]
}

/**
 * Get master configuration by ID with fallback to default
 */
export function getMasterByIdSafe(id: string | null | undefined): Master {
  if (!id || !isValidMasterId(id)) {
    return MASTERS[DEFAULT_MASTER_ID]
  }
  return MASTERS[id]
}

/**
 * Get all masters as an array
 */
export function getAllMasters(): Master[] {
  return MASTER_IDS.map(id => MASTERS[id])
}
