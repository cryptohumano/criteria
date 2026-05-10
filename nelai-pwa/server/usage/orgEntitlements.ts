/**
 * Enforcement de trial por tiempo y cupos de organización (usuarios).
 */
import type { PrismaClient } from '@prisma/client'
import { HttpError } from '../auth/httpError.js'
import { getPlanEntitlements } from '../billing/planCatalog.js'
import type { AuthSession } from '../auth/types.js'
import { normalizePlanId } from './planLimits.js'

export function isTrialPlan(plan: string): boolean {
  return normalizePlanId(plan) === 'trial'
}

/** Si la org está en trial y ya pasó `trialEndsAt`. */
export function computeTrialExpired(plan: string, trialEndsAt: Date | null): boolean {
  if (!isTrialPlan(plan)) return false
  if (!trialEndsAt) return false
  return trialEndsAt.getTime() < Date.now()
}

export function assertTrialActiveOrPaid(session: AuthSession): void {
  if (session.trialExpired) {
    throw new HttpError(
      'El periodo de prueba (14 días) ha terminado. Contrata un plan en Ajustes → Facturación para seguir usando Etherpad, IA y funciones de equipo.',
      402,
    )
  }
}

/** Carga org y comprueba trial; útil si `req.auth` no incluye flags (no debería pasar con Prisma). */
export async function assertTrialActiveFromDb(prisma: PrismaClient, session: AuthSession): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { plan: true, trialEndsAt: true },
  })
  if (!org) throw new HttpError('Organización no encontrada', 404)
  if (computeTrialExpired(org.plan, org.trialEndsAt)) {
    throw new HttpError(
      'El periodo de prueba (14 días) ha terminado. Contrata un plan en Ajustes → Facturación.',
      402,
    )
  }
}

/** Antes de invitar / crear otro usuario en la org (cuando exista el endpoint). */
export async function assertOrgUnderUserCap(prisma: PrismaClient, organizationId: string, plan: string): Promise<void> {
  const max = getPlanEntitlements(plan).maxUsersPerOrg
  if (max === 0) return
  const n = await prisma.user.count({ where: { organizationId } })
  if (n >= max) {
    throw new HttpError(`Tu plan admite como máximo ${max} usuario(s). Mejora el plan o desactiva cuentas.`, 402)
  }
}
