import { useMemo } from 'react'
import type { OrgMemberRole } from '@/types/workspace'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'

const ORG_RANK: Record<OrgMemberRole, number> = {
  member: 0,
  admin: 1,
  owner: 2,
}

/**
 * Helpers de roles y plataforma basados en la sesión SaaS (`WorkspaceSession`).
 * No sustituye comprobaciones en el servidor: la API sigue siendo la fuente de verdad.
 */
export function useWorkspaceAuthorization() {
  const { session, isHydrated, isSessionSynced } = useWorkspaceSession()

  return useMemo(() => {
    const orgRole = session?.user.orgRole ?? null
    const platformRole = session?.user.platformRole ?? null
    const isPlatformSuperadmin = platformRole === 'superadmin'
    const isOrgOwner = orgRole === 'owner'
    const isOrgAdmin = orgRole === 'admin'
    const canManageOrgSettings = orgRole === 'owner' || orgRole === 'admin'

    function hasOrgRoleAtLeast(min: OrgMemberRole): boolean {
      if (!orgRole) return false
      return ORG_RANK[orgRole] >= ORG_RANK[min]
    }

    return {
      session,
      isHydrated,
      isSessionSynced,
      orgRole,
      platformRole,
      isPlatformSuperadmin,
      isOrgOwner,
      isOrgAdmin,
      canManageOrgSettings,
      hasOrgRoleAtLeast,
    }
  }, [session, isHydrated, isSessionSynced])
}
