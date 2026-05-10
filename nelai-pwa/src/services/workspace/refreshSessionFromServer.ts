import { getApiBaseUrl, hasWorkspaceApiBase } from '@/config/saasConfig'
import type { WorkspaceSession, WorkspaceUser } from '@/types/workspace'
import { clearWorkspaceSession, readWorkspaceSession, writeWorkspaceSession } from './sessionStorage'

type MeResponse = {
  user: WorkspaceUser
  organization: WorkspaceSession['organization']
}

/**
 * Alinea la sesión con `GET /api/auth/me` (roles, org) para no depender de un JSON antiguo en `sessionStorage`.
 * Si el token ya no es válido, limpia la sesión.
 */
export async function refreshSessionFromServer(): Promise<WorkspaceSession | null> {
  const current = readWorkspaceSession()
  const base = getApiBaseUrl()
  if (!current?.accessToken) return current
  if (!hasWorkspaceApiBase()) {
    // Modo sin backend: no forzar red
    return current
  }

  const r = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${current.accessToken}` },
  })

  if (r.status === 401) {
    clearWorkspaceSession()
    return null
  }
  if (!r.ok) {
    return current
  }

  const data = (await r.json()) as MeResponse
  if (!data?.user?.email || !data?.organization?.id) {
    return current
  }

  const next: WorkspaceSession = {
    accessToken: current.accessToken,
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.displayName,
      orgRole: data.user.orgRole,
      platformRole: data.user.platformRole,
    },
    organization: {
      id: data.organization.id,
      name: data.organization.name,
      plan: data.organization.plan,
      kind: data.organization.kind,
    },
  }
  writeWorkspaceSession(next)
  return next
}
