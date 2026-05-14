/**
 * Cuotas mensuales y registro de uso para el proxy LLM (tokens agregados).
 */
import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../auth/httpError.js'
import { USAGE_KIND_LLM_GEMINI } from './kinds.js'
import { getPlanEntitlements } from '../billing/planCatalog.js'
import { assertTrialActiveOrPaid } from './orgEntitlements.js'
import { startOfUtcMonth } from './period.js'
import { resolveOrgUsagePeriod, type UsagePeriodSource } from './orgUsagePeriod.js'
import { getLlmTokenLimitForPlan, isLlmQuotaEnforced } from './planLimits.js'
import type { AuthSession } from '../auth/types.js'

export async function sumOrgLlmTokensThisMonth(
  prisma: PrismaClient,
  organizationId: string,
  planId: string
): Promise<number> {
  const { start: from } = await resolveOrgUsagePeriod(prisma, organizationId, planId)
  const agg = await prisma.usageEvent.aggregate({
    where: {
      organizationId,
      createdAt: { gte: from },
      kind: { startsWith: 'llm.' },
      unit: 'token',
    },
    _sum: { quantity: true },
  })
  return agg._sum.quantity ?? 0
}

/**
 * Antes de llamar al proveedor: bloquea si la org ya agotó el cupo de tokens del plan.
 * Solo aplica con Prisma (no en modo memoria sin DB).
 */
export async function assertOrgLlmTokenQuota(
  prisma: PrismaClient,
  session: AuthSession,
  requestId: string
): Promise<void> {
  assertTrialActiveOrPaid(session)
  if (!isLlmQuotaEnforced()) return
  const limit = getLlmTokenLimitForPlan(session.plan)
  if (limit === 0) return
  const used = await sumOrgLlmTokensThisMonth(prisma, session.organizationId, session.plan)
  if (used >= limit) {
    const err = new HttpError(
      'Límite de consumo de IA de tu plan alcanzado para el periodo actual. Contacta al administrador o mejora el plan.',
      402,
    )
    ;(err as Error & { requestId?: string }).requestId = requestId
    throw err
  }
}

function extractGeminiTokenTotal(data: Record<string, unknown>): number {
  const um = data.usageMetadata as Record<string, unknown> | undefined
  if (!um) return 0
  const total = um.totalTokenCount
  if (typeof total === 'number' && total > 0) return total
  const p = um.promptTokenCount
  const c = um.candidatesTokenCount
  if (typeof p === 'number' && typeof c === 'number' && p + c > 0) return p + c
  return 0
}

function extractGeminiUsageMetadata(data: Record<string, unknown>): {
  totalTokenCount?: number
  promptTokenCount?: number
  candidatesTokenCount?: number
} | null {
  const um = data.usageMetadata as Record<string, unknown> | undefined
  if (!um) return null
  const totalTokenCount = typeof um.totalTokenCount === 'number' ? um.totalTokenCount : undefined
  const promptTokenCount = typeof um.promptTokenCount === 'number' ? um.promptTokenCount : undefined
  const candidatesTokenCount =
    typeof um.candidatesTokenCount === 'number' ? um.candidatesTokenCount : undefined
  if (totalTokenCount == null && promptTokenCount == null && candidatesTokenCount == null) return null
  return { totalTokenCount, promptTokenCount, candidatesTokenCount }
}

/**
 * Tras una respuesta 2xx de Gemini: persiste un `UsageEvent` con unit `token`.
 * Mínimo 1 token para no perder trazabilidad si no viene `usageMetadata`.
 */
export async function recordLlmGeminiSuccess(
  prisma: PrismaClient,
  session: AuthSession,
  data: Record<string, unknown>,
  requestId: string,
  model: string
): Promise<void> {
  const n = extractGeminiTokenTotal(data)
  const quantity = Math.max(1, n)
  const usageMetadata = extractGeminiUsageMetadata(data)
  await prisma.usageEvent.create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      kind: USAGE_KIND_LLM_GEMINI,
      unit: 'token',
      quantity,
      model: model || null,
      requestId: requestId.length > 500 ? requestId.slice(0, 500) : requestId,
      meta: { provider: 'google', source: 'llm-proxy', usageMetadata },
    },
  })
}

/** Respuesta de GET /api/usage/llm (panel tenant). */
export type LlmUsageForSession = {
  periodStart: string
  periodEnd: string | null
  periodSource: UsagePeriodSource
  /** Cadencia de renovación de cupos del plan ('month' | 'fortnight'). */
  tokenPeriod: 'month' | 'fortnight'
  plan: string
  organizationId: string
  organizationName: string
  /**
   * Tokens consumidos en el periodo actual del plan.
   * Nombre legacy `usedTokensThisMonth`: en planes con `tokenPeriod === 'fortnight'`
   * representa el consumo de la quincena en curso.
   */
  usedTokensThisMonth: number
  /**
   * Tope de tokens del plan en el periodo actual; 0 = sin tope (enterprise típico).
   * Nombre legacy `monthlyTokenLimit`: representa “por periodo del plan”.
   */
  monthlyTokenLimit: number
  /** 0 = sin tope de usuarios según catálogo. */
  maxUsersPerOrg: number
  /** Usuarios actuales en la organización (asientos ocupados). */
  memberCount: number
  quotaEnforced: boolean
  unlimited: boolean
  /** true si el servidor no tiene `DATABASE_URL` (memoria / demo). */
  noDatabase: boolean
  trialEndsAt: string | null
  trialExpired: boolean
}

export async function getLlmUsageForSession(
  prisma: PrismaClient | null,
  session: AuthSession
): Promise<LlmUsageForSession> {
  const resolved = prisma
    ? await resolveOrgUsagePeriod(prisma, session.organizationId, session.plan)
    : { start: startOfUtcMonth(), end: null, source: 'utc-month' as const }
  const from = resolved.start
  const monthlyTokenLimit = getLlmTokenLimitForPlan(session.plan)
  const ent = getPlanEntitlements(session.plan)
  const used =
    prisma ? await sumOrgLlmTokensThisMonth(prisma, session.organizationId, session.plan) : 0
  const memberCount = prisma
    ? await prisma.user.count({ where: { organizationId: session.organizationId } })
    : 0
  return {
    periodStart: from.toISOString(),
    periodEnd: resolved.end ? resolved.end.toISOString() : null,
    periodSource: resolved.source,
    tokenPeriod: ent.tokenPeriod,
    plan: session.plan,
    organizationId: session.organizationId,
    organizationName: session.organizationName,
    usedTokensThisMonth: used,
    monthlyTokenLimit,
    maxUsersPerOrg: ent.maxUsersPerOrg,
    memberCount,
    quotaEnforced: isLlmQuotaEnforced(),
    unlimited: monthlyTokenLimit === 0,
    noDatabase: !prisma,
    trialEndsAt: session.trialEndsAt ?? null,
    trialExpired: Boolean(session.trialExpired),
  }
}
