import type { Request } from 'express'
import type { PrismaClient } from '@prisma/client'
import { prismaResolveSession } from '../prisma-auth.js'
import type { AuthSession } from './types.js'
import { authSessions } from './memoryDevStore.js'

export function parseBearer(req: Request): string | null {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return null
  const t = h.slice(7).trim()
  return t || null
}

/**
 * Resuelve sesión: Prisma → memoria dev → token demo (solo no producción).
 */
export function createResolveAuthSession(getPrisma: () => Promise<PrismaClient | null>) {
  return async function resolveAuthSession(req: Request): Promise<AuthSession | null> {
    const token = parseBearer(req)
    if (!token) return null
    let prisma: PrismaClient | null = null
    try {
      prisma = await getPrisma()
    } catch {
      prisma = null
    }
    if (prisma) {
      const row = await prismaResolveSession(prisma, token)
      if (row) return row
    }
    const row = authSessions.get(token)
    if (row) return row
    if (process.env.NODE_ENV !== 'production' && token.startsWith('demo.')) {
      return {
        userId: 'demo-user',
        email: 'demo@local',
        displayName: 'Demo',
        orgRole: 'owner',
        platformRole: 'none',
        organizationId: 'demo-org',
        organizationName: 'Organización demo',
        organizationKind: 'team',
        plan: 'trial',
        trialEndsAt: null,
        trialExpired: false,
      }
    }
    return null
  }
}
