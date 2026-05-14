import { useContext } from 'react'
import { WorkspaceSessionContext } from '@/contexts/workspaceSessionContext'

export function useWorkspaceSession() {
  const ctx = useContext(WorkspaceSessionContext)
  if (!ctx) {
    throw new Error('useWorkspaceSession debe usarse dentro de WorkspaceSessionProvider')
  }
  return ctx
}
