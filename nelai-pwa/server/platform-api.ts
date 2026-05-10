/**
 * Agregados de solo lectura para el panel de superadmin (requiere `platformRole` en sesión vía /api).
 */
import type { PrismaClient } from '@prisma/client'
import { getPlanEntitlements } from './billing/planCatalog.js'
import { getLlmTokenLimitForPlan } from './usage/planLimits.js'
import { startOfUtcMonth } from './usage/period.js'

export async function getPlatformStats(prisma: PrismaClient) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [
    organizations,
    users,
    sessions,
    apiKeys,
    apiKeysActive,
    usageEvents,
    usageEvents24h,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.session.count(),
    prisma.apiKey.count(),
    prisma.apiKey.count({ where: { revokedAt: null } }),
    prisma.usageEvent.count(),
    prisma.usageEvent.count({ where: { createdAt: { gte: dayAgo } } }),
  ])
  return {
    organizations,
    users,
    sessions,
    apiKeys,
    apiKeysActive,
    apiKeysRevoked: apiKeys - apiKeysActive,
    usageEvents,
    usageEvents24h,
  }
}

export async function getPlatformOrganizations(
  prisma: PrismaClient,
  q: { take?: unknown; skip?: unknown }
) {
  const take = Math.min(100, Math.max(1, Number(q.take) || 25))
  const skip = Math.max(0, Number(q.skip) || 0)
  const rows = await prisma.organization.findMany({
    take,
    skip,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      plan: true,
      kind: true,
      stripeCustomerId: true,
      stripeSubscriptionStatus: true,
      stripeCurrentPeriodStart: true,
      createdAt: true,
      _count: { select: { users: true, apiKeys: true, usageEvents: true } },
    },
  })
  const ids = rows.map((r) => r.id)
  const tokenSums =
    ids.length > 0
      ? await prisma.usageEvent.groupBy({
          by: ['organizationId'],
          where: {
            organizationId: { in: ids },
            // Nota: para performance usamos un "from" común aproximado (inicio de mes UTC).
            // Trials usan quincena rodante por org y planes pago el ciclo Stripe; aquí
            // preferimos consistencia y evitar N queries. Se corrige en un endpoint dedicado.
            createdAt: { gte: startOfUtcMonth() },
            kind: { startsWith: 'llm.' },
            unit: 'token',
          },
          _sum: { quantity: true },
        })
      : []
  const tokenByOrg = new Map(
    tokenSums.map((t) => [t.organizationId, t._sum.quantity ?? 0] as const),
  )
  return {
    take,
    skip,
    organizations: rows.map((o) => {
      const ent = getPlanEntitlements(o.plan)
      return {
        ...o,
        llmTokensThisMonth: tokenByOrg.get(o.id) ?? 0,
        llmTokenLimit: getLlmTokenLimitForPlan(o.plan),
        maxUsersPerOrg: ent.maxUsersPerOrg,
      }
    }),
  }
}

/** Listado paginado de usuarios (PPI: correo visible solo a superadmin). */
export async function getPlatformUsers(
  prisma: PrismaClient,
  q: { take?: unknown; skip?: unknown }
) {
  const take = Math.min(200, Math.max(1, Number(q.take) || 50))
  const skip = Math.max(0, Number(q.skip) || 0)
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        orgRole: true,
        platformRole: true,
        createdAt: true,
        organization: { select: { id: true, name: true, plan: true } },
      },
    }),
    prisma.user.count(),
  ])
  return { take, skip, total, users: rows }
}
