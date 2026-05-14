export type WorkspacePlan = 'trial' | 'starter' | 'pro' | 'enterprise'

/** B2B: equipo; B2C: contenedor personal (un miembro). */
export type OrganizationKind = 'team' | 'personal'

/** Rol dentro de la organización (invitaciones, permisos). */
export type OrgMemberRole = 'owner' | 'admin' | 'member'

/** Rol de plataforma (soporte / operaciones). No se asigna por registro público. */
export type UserPlatformRole = 'none' | 'superadmin'

export interface WorkspaceUser {
  id: string
  email: string
  displayName: string
  orgRole: OrgMemberRole
  platformRole: UserPlatformRole
}

export interface WorkspaceOrganization {
  id: string
  name: string
  plan: WorkspacePlan
  kind: OrganizationKind
}

export interface WorkspaceSession {
  accessToken: string
  user: WorkspaceUser
  organization: WorkspaceOrganization
}
