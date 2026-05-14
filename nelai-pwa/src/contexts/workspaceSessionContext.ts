import { createContext } from 'react'
import type { WorkspaceSession } from '@/types/workspace'
import type { RegisterWorkspaceInput, RegisterWorkspaceResult } from '@/services/workspace/workspaceAuthApi'

/** Contrato del contexto (módulo aparte para que Fast Refresh no duplique `createContext` al editar el provider). */
export interface WorkspaceSessionContextValue {
  session: WorkspaceSession | null
  signIn: (email: string, password: string, opts?: { inviteToken?: string }) => Promise<void>
  signUp: (input: RegisterWorkspaceInput) => Promise<RegisterWorkspaceResult>
  applySession: (next: WorkspaceSession) => void
  signOut: () => void
  isHydrated: boolean
  isSessionSynced: boolean
}

export const WorkspaceSessionContext = createContext<WorkspaceSessionContextValue | undefined>(
  undefined
)
