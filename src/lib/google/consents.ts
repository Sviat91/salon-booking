// Main consents module - re-exports all consent operations

// Types
export type { UserConsent, UserDataExport } from './types'

// Utility exports
export { normalizePhoneForSheet } from './consent-utils'

// Save operation
export { saveUserConsent } from './consent-operations/save'

// Find operations
export {
  findUserConsent,
  findUserConsentByPhone,
  hasValidConsent,
} from './consent-operations/find'

// Withdraw operation
export {
  withdrawUserConsent,
  type UpdateConsentWithdrawalOptions,
  type WithdrawOutcome,
} from './consent-operations/withdraw'

// Erase operation
export {
  eraseUserData,
  type EraseUserDataOptions,
  type EraseOutcome,
} from './consent-operations/erase'

// Export operation
export {
  exportUserData,
  type ExportUserDataOptions,
  type ExportOutcome,
} from './consent-operations/export'
