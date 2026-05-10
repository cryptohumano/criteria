import type { OrgMemberRole, UserPlatformRole } from '@prisma/client'
import type { AuthSession } from './types.js'

/** Fila en memoria (solo sin DATABASE_URL). */
export interface MemoryUserRow {
  passwordHash: string
  userId: string
  organizationId: string
  organizationName: string
  organizationKind: string
  displayName: string
  plan: string
  orgRole: OrgMemberRole
  platformRole: UserPlatformRole
}

/** Sesiones en memoria alineadas con `AuthSession` (strings compatibles con enums Prisma). */
export const authSessions = new Map<string, AuthSession>()

export const usersByEmail = new Map<string, MemoryUserRow>()
