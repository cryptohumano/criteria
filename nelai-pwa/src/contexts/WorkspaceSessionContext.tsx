import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
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
  type RegisterWorkspaceResult,
} from '@/services/workspace/workspaceAuthApi'
import { ensureSaaSPlatformGeminiConfig } from '@/config/saasDefaultLlm'

interface WorkspaceSessionContextValue {
  session: WorkspaceSession | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: RegisterWorkspaceInput) => Promise<RegisterWorkspaceResult>
  /** Persiste sesión tras OAuth Google (redirect) sin recargar la página. */
  applySession: (next: WorkspaceSession) => void
  signOut: () => void
  isHydrated: boolean
  /** `true` tras revalidar (o omitir) contra `/api/auth/me` con `VITE_API_BASE_URL`. Evita leer un `platformRole` obsoleto. */
  isSessionSynced: boolean
}

const WorkspaceSessionContext = createContext<WorkspaceSessionContextValue | undefined>(
  undefined
)

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
    ;(async () => {
      try {
        const next = await refreshSessionFromServer()
        if (!cancelled) setSession(next)
      } finally {
        if (!cancelled) setIsSessionSynced(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isHydrated])

  /** Perfil local «Nelai (plataforma)» para IA sin BYOK (proxy + sesión). */
  useEffect(() => {
    if (!isHydrated) return
    void ensureSaaSPlatformGeminiConfig()
  }, [isHydrated, session?.accessToken])

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await loginWithPassword(email, password)
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

export function useWorkspaceSession() {
  const ctx = useContext(WorkspaceSessionContext)
  if (!ctx) {
    throw new Error('useWorkspaceSession debe usarse dentro de WorkspaceSessionProvider')
  }
  return ctx
}
