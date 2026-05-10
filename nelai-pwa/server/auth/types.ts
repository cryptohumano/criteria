import type { OrgMemberRole, UserPlatformRole } from '@prisma/client'

/** Payload común tras resolver Bearer (Prisma, memoria dev o demo). */
export interface AuthSession {
  userId: string
  email: string
  displayName: string
  orgRole: OrgMemberRole
  platformRole: UserPlatformRole
  organizationId: string
  organizationName: string
  organizationKind: string
  plan: string
  /** ISO 8601; solo trial. */
  trialEndsAt?: string | null
  /** true si plan trial y ya pasó `trialEndsAt`. */
  trialExpired?: boolean
}
