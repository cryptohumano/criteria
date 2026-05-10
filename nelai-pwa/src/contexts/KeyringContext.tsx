import { createContext, useContext, ReactNode } from 'react'
import { useKeyring } from '@/hooks/useKeyring'
import type { KeyringAccount } from '@/hooks/useKeyring'

interface KeyringContextType {
  keyring: ReturnType<typeof useKeyring>['keyring']
  isReady: boolean
  accounts: KeyringAccount[]
  isUnlocked: boolean
  hasStoredAccounts: boolean
  storedAccountsStatus: ReturnType<typeof useKeyring>['storedAccountsStatus']
  storedAccountsError: ReturnType<typeof useKeyring>['storedAccountsError']
  hasWebAuthnCredentials: boolean
  generateMnemonic: () => string
  unlock: (password: string) => Promise<boolean>
  unlockWithWebAuthn: (credentialId: string) => Promise<boolean>
  lock: () => void
  addFromMnemonic: (mnemonic: string, name?: string, type?: 'sr25519' | 'ed25519' | 'ecdsa', password?: string) => Promise<KeyringAccount | null>
  addFromUri: (uri: string, name?: string, type?: 'sr25519' | 'ed25519' | 'ecdsa', password?: string) => Promise<KeyringAccount | null>
  addFromJson: (jsonData: object, jsonPassword: string, password?: string) => Promise<KeyringAccount | null>
  removeAccount: (address: string) => Promise<boolean>
  getAccount: (address: string) => KeyringAccount | undefined
  getDerivedEthereumAddress: (address: string) => string | null
  setSS58Format: (format: number) => void
  refreshWebAuthnCredentials: () => Promise<boolean>
  refreshStoredAccounts: () => Promise<boolean>
}

export const KeyringContext = createContext<KeyringContextType | undefined>(undefined)

export function KeyringProvider({ children }: { children: ReactNode }) {
  const keyringData = useKeyring()

  return (
    <KeyringContext.Provider value={keyringData}>
      {children}
    </KeyringContext.Provider>
  )
}

export function useKeyringContext() {
  const context = useContext(KeyringContext)
  if (context === undefined) {
    throw new Error('useKeyringContext debe usarse dentro de KeyringProvider')
  }
  return context
}

