/**
 * Periodo de agregación de uso (tokens, documentos) por organización.
 *
 * Reglas:
 * - **Trial**: quincena rodante de 15 días desde `Organization.createdAt`.
 * - **Pago (Stripe activo / trialing / past_due / unpaid)**: ciclo Stripe actual.
 * - **Resto**: mes calendario UTC.
 */
import type { PrismaClient } from '@prisma/client'

type UsageDb = Pick<PrismaClient, 'usageEvent' | 'organization'>
import { endOfRollingFortnight, startOfRollingFortnight, startOfUtcMonth } from './period.js'
import { normalizePlanId } from './planLimits.js'

function shouldUseStripeBillingPeriod(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase()
  return s === 'active' || s === 'trialing' || s === 'past_due' || s === 'unpaid'
}

export type UsagePeriodSource = 'stripe' | 'utc-month' | 'rolling-fortnight'

export async function resolveOrgUsagePeriod(
  prisma: UsageDb,
  organizationId: string,
  planId: string,
): Promise<{ start: Date; end: Date | null; source: UsagePeriodSource }> {
  if (normalizePlanId(planId) === 'trial') {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { createdAt: true },
    })
    const anchor = org?.createdAt ?? new Date()
    return {
      start: startOfRollingFortnight(anchor),
      end: endOfRollingFortnight(anchor),
      source: 'rolling-fortnight',
    }
  }
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      stripeSubscriptionStatus: true,
      stripeCurrentPeriodStart: true,
      stripeCurrentPeriodEnd: true,
    },
  })
  if (
    org &&
    shouldUseStripeBillingPeriod(org.stripeSubscriptionStatus) &&
    org.stripeCurrentPeriodStart
  ) {
    return {
      start: org.stripeCurrentPeriodStart,
      end: org.stripeCurrentPeriodEnd ?? null,
      source: 'stripe',
    }
  }
  return { start: startOfUtcMonth(), end: null, source: 'utc-month' }
}
