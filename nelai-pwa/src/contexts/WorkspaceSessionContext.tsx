import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { WorkspaceSession } from '@/types/workspace'
import {
  clearWorkspaceSession,
  readWorkspaceSession,
  writeWorkspaceSession,
} from '@/services/workspace/sessionStorage'
import { refreshSessionFromServer } from '@/services/workspace/refreshSessionFromServer'
import {
  loginWithPassword,
  registerWorkspace,
  type RegisterWorkspaceInput,
} from '@/services/workspace/workspaceAuthApi'
import { ensureSaaSPlatformGeminiConfig } from '@/config/saasDefaultLlm'
import { WorkspaceSessionContext } from '@/contexts/workspaceSessionContext'

export function WorkspaceSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WorkspaceSession | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isSessionSynced, setIsSessionSynced] = useState(false)

  useEffect(() => {
    setSession(readWorkspaceSession())
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    let cancelled = false
    /** Si el API no responde (proxy colgado, backend caído), no bloquear la app indefinidamente. */
    const safetyMs = 15_000
    const safety = globalThis.setTimeout(() => {
      if (!cancelled) setIsSessionSynced(true)
    }, safetyMs)

    ;(async () => {
      try {
        const next = await refreshSessionFromServer()
        if (!cancelled) setSession(next)
      } catch {
        /* refreshSessionFromServer ya tolera red; por si cambia el contrato */
      } finally {
        globalThis.clearTimeout(safety)
        if (!cancelled) setIsSessionSynced(true)
      }
    })()

    return () => {
      cancelled = true
      globalThis.clearTimeout(safety)
    }
  }, [isHydrated])

  /** Perfil local «criterIA (plataforma)» para IA sin BYOK (proxy + sesión). */
  useEffect(() => {
    if (!isHydrated) return
    void ensureSaaSPlatformGeminiConfig()
  }, [isHydrated, session?.accessToken])

  const signIn = useCallback(async (email: string, password: string, opts?: { inviteToken?: string }) => {
    const next = await loginWithPassword(email, password, opts)
    writeWorkspaceSession(next)
    setSession(next)
  }, [])

  const signUp = useCallback(async (input: RegisterWorkspaceInput) => {
    const next = await registerWorkspace(input)
    if ('pendingVerification' in next && next.pendingVerification) {
      return next
    }
    writeWorkspaceSession(next)
    setSession(next)
    return next
  }, [])

  const applySession = useCallback((next: WorkspaceSession) => {
    writeWorkspaceSession(next)
    setSession(next)
  }, [])

  const signOut = useCallback(() => {
    clearWorkspaceSession()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, signIn, signUp, applySession, signOut, isHydrated, isSessionSynced }),
    [session, signIn, signUp, applySession, signOut, isHydrated, isSessionSynced]
  )

  return (
    <WorkspaceSessionContext.Provider value={value}>{children}</WorkspaceSessionContext.Provider>
  )
}
