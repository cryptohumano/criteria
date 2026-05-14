import type { OrgMemberRole, PrismaClient } from '@prisma/client'
import { HttpError } from '../auth/httpError.js'
import { resolveOrgUsagePeriod } from '../usage/orgUsagePeriod.js'

const TRIAL_MS = 14 * 24 * 60 * 60 * 1000

export type OrgMemberRow = {
  id: string
  email: string
  displayName: string | null
  orgRole: OrgMemberRole
  createdAt: string
}

export type OrgMemberRowWithUsage = OrgMemberRow & {
  /** Tokens LLM (proxy) en el periodo de uso actual del plan (misma ventana que el panel de uso). */
  llmTokensThisPeriod: number
}

export type OrgMembersListResult = {
  members: OrgMemberRowWithUsage[]
  /** Eventos con `userId` nulo en ese periodo (p. ej. trazas antiguas). */
  unattributedLlmTokensThisPeriod: number
}

export async function listOrganizationMembers(prisma: PrismaClient, organizationId: string): Promise<OrgMemberRow[]> {
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: {
      id: true,
      email: true,
      displayName: true,
      orgRole: true,
      createdAt: true,
    },
    orderBy: [{ email: 'asc' }],
  })
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    orgRole: u.orgRole,
    createdAt: u.createdAt.toISOString(),
  }))
}

export async function listOrganizationMembersWithLlmUsage(
  prisma: PrismaClient,
  organizationId: string,
  planId: string,
): Promise<OrgMembersListResult> {
  const members = await listOrganizationMembers(prisma, organizationId)
  const { start } = await resolveOrgUsagePeriod(prisma, organizationId, planId)
  const sums = await prisma.usageEvent.groupBy({
    by: ['userId'],
    where: {
      organizationId,
      createdAt: { gte: start },
      kind: { startsWith: 'llm.' },
      unit: 'token',
    },
    _sum: { quantity: true },
  })
  const byUser = new Map<string | null, number>()
  for (const row of sums) {
    byUser.set(row.userId, row._sum.quantity ?? 0)
  }
  const unattributedLlmTokensThisPeriod = byUser.get(null) ?? 0
  const withUsage: OrgMemberRowWithUsage[] = members.map((m) => ({
    ...m,
    llmTokensThisPeriod: byUser.get(m.id) ?? 0,
  }))
  return { members: withUsage, unattributedLlmTokensThisPeriod }
}

/**
 * Expulsa a un miembro de la organización actual: crea una org personal nueva en trial,
 * lo mueve como owner y cierra todas sus sesiones (debe volver a entrar).
 * No restaura un «plan anterior» (no existe en el modelo); queda en trial en su propio espacio.
 */
export async function removeOrganizationMember(
  prisma: PrismaClient,
  params: {
    organizationId: string
    actorUserId: string
    actorOrgRole: OrgMemberRole
    targetUserId: string
  },
): Promise<void> {
  const { organizationId, actorUserId, actorOrgRole, targetUserId } = params

  if (actorOrgRole !== 'owner' && actorOrgRole !== 'admin') {
    throw new HttpError('Solo el propietario o un administrador puede expulsar miembros.', 403)
  }

  if (actorUserId === targetUserId) {
    throw new HttpError(
      'No puedes expulsarte a ti mismo desde aquí. Si quieres salir del equipo, pide a otro administrador que te retire o elimina tu cuenta desde Ajustes.',
      400,
    )
  }

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, organizationId },
    select: { id: true, orgRole: true, email: true, displayName: true },
  })
  if (!target) {
    throw new HttpError('Usuario no encontrado en esta organización.', 404)
  }

  if (target.orgRole === 'owner') {
    throw new HttpError('No se puede expulsar al propietario de la organización.', 403)
  }

  if (actorOrgRole === 'admin' && target.orgRole === 'admin') {
    throw new HttpError('Solo el propietario puede expulsar a un administrador.', 403)
  }

  const label = String(target.displayName?.trim() || target.email.split('@')[0] || 'Usuario').trim()

  await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        name: `Cuenta de ${label}`,
        plan: 'trial',
        kind: 'personal',
        trialEndsAt: new Date(Date.now() + TRIAL_MS),
      },
    })
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        organizationId: newOrg.id,
        orgRole: 'owner',
      },
    })
    await tx.session.deleteMany({ where: { userId: targetUserId } })
  })
}
