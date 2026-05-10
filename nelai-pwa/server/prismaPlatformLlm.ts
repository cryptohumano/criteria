/**
 * Acceso a `PlatformLlmCredential` hasta que `prisma generate` regenere el cliente
 * (mismo patrón que en proyectos con migración pendiente).
 */
import type { PrismaClient } from '@prisma/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any

export function platformLlmCredentialDb(prisma: PrismaClient) {
  return (prisma as P).platformLlmCredential as {
    findUnique: (a: { where: { provider: string }; select?: { secretEnc?: boolean; last4?: boolean } }) => Promise<{
      secretEnc: string
      last4: string | null
    } | null>
    upsert: (a: {
      where: { provider: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }) => Promise<unknown>
    delete: (a: { where: { provider: string } }) => Promise<unknown>
  }
}
