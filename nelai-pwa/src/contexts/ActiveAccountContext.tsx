/**
 * Contexto para manejar la cuenta activa en la sesión
 * Permite aislar la lógica y datos por cuenta
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useKeyringContext } from './KeyringContext'
import { CRITERIA_STORAGE, LEGACY_NELAI_STORAGE } from '@/constants/storageKeys'

interface ActiveAccountContextType {
  activeAccount: string | null // Dirección de la cuenta activa
  setActiveAccount: (address: string | null) => void
  activeAccountData: ReturnType<typeof useKeyringContext>['accounts'][0] | null // Datos completos de la cuenta activa
  switchAccount: (address: string) => void // Cambiar cuenta activa
  clearActiveAccount: () => void // Limpiar cuenta activa
}

const ActiveAccountContext = createContext<ActiveAccountContextType | undefined>(undefined)

const ACTIVE_ACCOUNT_STORAGE_KEY = CRITERIA_STORAGE.activeAccount
const LEGACY_ACTIVE_ACCOUNT_STORAGE_KEY = LEGACY_NELAI_STORAGE.activeAccount

export function ActiveAccountProvider({ children }: { children: ReactNode }) {
  const { accounts, isUnlocked } = useKeyringContext()
  const [activeAccount, setActiveAccountState] = useState<string | null>(null)

  // Cargar cuenta activa desde localStorage al iniciar
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY) ??
        localStorage.getItem(LEGACY_ACTIVE_ACCOUNT_STORAGE_KEY)
      if (stored) {
        // Ojo: cuando el keyring está bloqueado, `accounts=[]` pero eso NO significa
        // que la cuenta guardada sea inválida. La validación real se hace al desbloquear.
        setActiveAccountState(stored)
        // Migración: si venía de Nelai, persistir con la clave nueva.
        localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, stored)
        localStorage.removeItem(LEGACY_ACTIVE_ACCOUNT_STORAGE_KEY)
      } else if (isUnlocked && accounts.length > 0) {
        // Si no hay cuenta guardada y ya está desbloqueado, usar la primera disponible
        const first = accounts[0].address
        setActiveAccountState(first)
        localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, first)
      }
    } catch (error) {
      console.error('[ActiveAccount] Error al cargar cuenta activa:', error)
    }
  }, [accounts, isUnlocked])

  // Actualizar cuenta activa cuando cambian las cuentas disponibles
  useEffect(() => {
    // No reescribir/limpiar la cuenta activa mientras el keyring esté bloqueado:
    // `accounts=[]` es esperado y no debe forzar a "crear cuenta".
    if (!isUnlocked) return

    if (accounts.length > 0 && !activeAccount) {
      // Si no hay cuenta activa pero hay cuentas disponibles, usar la primera
      const first = accounts[0].address
      setActiveAccountState(first)
      localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, first)
    } else if (activeAccount && !accounts.some(acc => acc.address === activeAccount)) {
      // Si la cuenta activa ya no existe, usar la primera disponible
      if (accounts.length > 0) {
        const first = accounts[0].address
        setActiveAccountState(first)
        localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, first)
      } else {
        setActiveAccountState(null)
        localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY)
      }
    }
  }, [accounts, activeAccount, isUnlocked])

  // Función para cambiar cuenta activa
  const setActiveAccount = useCallback((address: string | null) => {
    if (address === null) {
      setActiveAccountState(null)
      localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY)
      return
    }

    // Verificar que la cuenta existe
    const accountExists = accounts.some(acc => acc.address === address)
    if (!accountExists) {
      console.warn('[ActiveAccount] Intento de activar cuenta que no existe:', address)
      return
    }

    setActiveAccountState(address)
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, address)
    console.log('[ActiveAccount] Cuenta activa cambiada a:', address)
  }, [accounts])

  // Función para cambiar cuenta (alias más claro)
  const switchAccount = useCallback((address: string) => {
    setActiveAccount(address)
  }, [setActiveAccount])

  // Función para limpiar cuenta activa
  const clearActiveAccount = useCallback(() => {
    setActiveAccount(null)
  }, [setActiveAccount])

  // Obtener datos completos de la cuenta activa
  const activeAccountData = activeAccount
    ? accounts.find(acc => acc.address === activeAccount) || null
    : null

  return (
    <ActiveAccountContext.Provider
      value={{
        activeAccount,
        setActiveAccount,
        activeAccountData,
        switchAccount,
        clearActiveAccount,
      }}
    >
      {children}
    </ActiveAccountContext.Provider>
  )
}

export function useActiveAccount() {
  const context = useContext(ActiveAccountContext)
  if (context === undefined) {
    throw new Error('useActiveAccount debe usarse dentro de ActiveAccountProvider')
  }
  return context
}
