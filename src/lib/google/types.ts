// Shared types for Google Sheets consent operations

export interface UserConsent {
  phone: string
  email?: string
  name: string
  consentDate: string
  ipHash: string
  consentPrivacyV10: boolean
  consentTermsV10: boolean
  consentNotificationsV10: boolean
  consentWithdrawnDate?: string
  withdrawalMethod?: string
}

export interface UserDataExport {
  personalData: {
    name: string
    phone: string
    email?: string
  }
  consentHistory: {
    consentDate: string
    ipHash: string
    privacyV10: boolean
    termsV10: boolean
    notificationsV10: boolean
    withdrawnDate?: string
    withdrawalMethod?: string
  }[]
  isAnonymized: boolean
  exportTimestamp: string
}

export type ConsentRowMatch = {
  index: number
  row: string[]
  consent: UserConsent
  isWithdrawn: boolean
  consentTimestamp: number
}
