import type { WorkspacePlan, WorkspaceSession } from '@/types/workspace'

const SESSION_KEY = 'criteria-workspace-session'
const LEGACY_SESSION_KEY = 'nelai-workspace-session'

export function readWorkspaceSession(): WorkspaceSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(LEGACY_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WorkspaceSession> | null
    if (!parsed?.accessToken || !parsed?.user?.email || !parsed?.organization?.id) return null
    const u = parsed.user
    const o = parsed.organization
    return {
      accessToken: parsed.accessToken,
      user: {
        id: u.id!,
        email: u.email!,
        displayName: u.displayName ?? u.email!.split('@')[0]!,
        orgRole: u.orgRole ?? 'owner',
        platformRole: u.platformRole ?? 'none',
      },
      organization: {
        id: o.id!,
        name: o.name!,
        plan: (o.plan ?? 'trial') as WorkspacePlan,
        kind: o.kind ?? 'team',
      },
    }
  } catch {
    return null
  }
}

export function writeWorkspaceSession(session: WorkspaceSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  sessionStorage.removeItem(LEGACY_SESSION_KEY)
}

export function clearWorkspaceSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(LEGACY_SESSION_KEY)
}
