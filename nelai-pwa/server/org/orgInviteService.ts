import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Organization, PrismaClient } from '@prisma/client'
import type { OrgMemberRole } from '@prisma/client'
import { HttpError } from '../auth/httpError.js'
import { assertOrgUnderUserCap } from '../usage/orgEntitlements.js'
import { isEmailVerificationRequiredForPasswordRegister } from '../config/emailVerificationPolicy.js'
import { createVerificationTokenAndSendEmail } from '../auth/emailVerificationFlow.js'
import { sendWelcomeEmailSafe } from '../email/welcomeEmail.js'
import { getPlanEntitlements } from '../billing/planCatalog.js'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SESSION_MS = 14 * 24 * 60 * 60 * 1000

export function hashInviteToken(raw: string): string {
  return createHash('sha256').update(raw.trim(), 'utf8').digest('hex')
}

async function countOpenInvites(prisma: PrismaClient, organizationId: string): Promise<number> {
  return prisma.organizationInvite.count({
    where: {
      organizationId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
}

async function deleteOrganizationIfEmpty(prisma: PrismaClient, organizationId: string): Promise<void> {
  const n = await prisma.user.count({ where: { organizationId } })
  if (n > 0) return
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {})
}

/**
 * Mueve un usuario ya autenticado a la organización de una invitación válida (un solo uso).
 * No crea usuario ni valida contraseña: el llamador debe haber autenticado antes.
 */
export async function prismaApplyOrganizationInvite(
  prisma: PrismaClient,
  params: {
    user: { id: string; organizationId: string; orgRole: OrgMemberRole }
    rawInviteToken: string
  }
): Promise<Organization> {
  const raw = params.rawInviteToken.trim()
  if (!raw) {
    throw new HttpError('Token de invitación requerido', 400)
  }
  const h = hashInviteToken(raw)
  const invite = await prisma.organizationInvite.findUnique({
    where: { tokenHash: h },
    include: { organization: true },
  })
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    throw new HttpError('Invitación inválida o caducada. Pide un nuevo enlace al administrador.', 400)
  }

  if (params.user.organizationId === invite.organizationId) {
    throw new HttpError('Ya perteneces a esta organización.', 409)
  }

  await assertOrgUnderUserCap(prisma, invite.organizationId, invite.organization.plan)

  const membersHere = await prisma.user.count({
    where: { organizationId: params.user.organizationId },
  })
  if (params.user.orgRole === 'owner' && membersHere > 1) {
    throw new HttpError(
      'Eres propietario de un equipo con más miembros. Transfiere la propiedad o reorganiza el equipo antes de unirte a otra organización con esta invitación.',
      409,
    )
  }

  const oldOrgId = params.user.organizationId

  await prisma.$transaction(async (tx) => {
    const marked = await tx.organizationInvite.updateMany({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (marked.count !== 1) {
      throw new HttpError('Invitación ya utilizada o inválida.', 400)
    }
    await tx.user.update({
      where: { id: params.user.id },
      data: {
        organizationId: invite.organizationId,
        orgRole: invite.orgRole,
      },
    })
  })

  await deleteOrganizationIfEmpty(prisma, oldOrgId)

  return invite.organization
}

export async function getInvitePreview(prisma: PrismaClient, rawToken: string) {
  const h = hashInviteToken(rawToken)
  const inv = await prisma.organizationInvite.findUnique({
    where: { tokenHash: h },
    include: { organization: { select: { id: true, name: true, kind: true } } },
  })
  if (!inv || inv.usedAt || inv.expiresAt < new Date()) {
    return null
  }
  return {
    organizationName: inv.organization.name,
    organizationKind: inv.organization.kind,
    expiresAt: inv.expiresAt.toISOString(),
    role: inv.orgRole,
  }
}

export async function createOrganizationInvite(
  prisma: PrismaClient,
  params: {
    organizationId: string
    invitedByUserId: string
    orgRole?: OrgMemberRole
  }
): Promise<{ rawToken: string; expiresAt: Date }> {
  const { organizationId, invitedByUserId } = params
  const orgRole = params.orgRole ?? 'member'

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, kind: true, plan: true, name: true },
  })
  if (!org) throw new HttpError('Organización no encontrada', 404)
  // Equipo (B2B) y cuenta personal (B2C) pueden invitar si el plan deja más de un asiento (p. ej. Starter).
  const nUsers = await prisma.user.count({ where: { organizationId } })
  const nInvites = await countOpenInvites(prisma, organizationId)
  const max = getPlanEntitlements(org.plan).maxUsersPerOrg
  if (max > 0 && nUsers + nInvites >= max) {
    throw new HttpError(
      `Límite de miembros del plan (${max}) alcanzado. Mejora el plan o revoca invitaciones pendientes.`,
      402,
    )
  }

  const rawToken = randomBytes(24).toString('base64url')
  const tokenHash = hashInviteToken(rawToken)
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  await prisma.organizationInvite.create({
    data: {
      organizationId,
      tokenHash,
      orgRole,
      invitedByUserId,
      expiresAt,
    },
  })

  return { rawToken, expiresAt }
}

function normEmail(email: unknown): string {
  return String(email || '')
    .trim()
    .toLowerCase()
}

/**
 * Registro con contraseña uniendo una org existente vía token de invitación.
 */
export async function prismaRegisterWithInviteToken(
  prisma: PrismaClient,
  body: { email?: string; password?: string; displayName?: string },
  rawInviteToken: string
): Promise<
  | { kind: 'session'; accessToken: string; user: object; organization: object }
  | { kind: 'pending'; email: string }
> {
  const { email, password, displayName } = body || {}
  if (!email || !password) {
    throw new HttpError('email y password son requeridos', 400)
  }
  const em = normEmail(email)
  const disp = String(displayName || em.split('@')[0] || 'Usuario').trim()

  const h = hashInviteToken(rawInviteToken)
  const invite = await prisma.organizationInvite.findUnique({
    where: { tokenHash: h },
    include: { organization: true },
  })
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    throw new HttpError('Invitación inválida o caducada. Pide un nuevo enlace al administrador.', 400)
  }

  const existing = await prisma.user.findUnique({
    where: { email: em },
    select: {
      id: true,
      passwordHash: true,
      emailVerifiedAt: true,
      organizationId: true,
      orgRole: true,
    },
  })
  if (existing) {
    if (!existing.passwordHash) {
      throw new HttpError(
        'Esta cuenta usa solo Google. Abre Iniciar sesión con el mismo enlace de invitación (sustituye /register por /login en la URL) y usa «Continuar con Google».',
        409,
      )
    }
    if (!(await bcrypt.compare(String(password), existing.passwordHash))) {
      throw new HttpError('Credenciales inválidas', 401)
    }
    if (!existing.emailVerifiedAt) {
      throw new HttpError(
        'Verifica tu correo antes de aceptar la invitación. Revisa la bandeja o pide un nuevo enlace de verificación.',
        403,
      )
    }
    await prismaApplyOrganizationInvite(prisma, {
      user: {
        id: existing.id,
        organizationId: existing.organizationId,
        orgRole: existing.orgRole,
      },
      rawInviteToken,
    })
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_MS)
    const fresh = await prisma.user.findUnique({
      where: { id: existing.id },
      include: { organization: true },
    })
    if (!fresh) {
      throw new HttpError('Usuario no encontrado', 500)
    }
    await prisma.session.create({
      data: { token, userId: fresh.id, expiresAt },
    })
    return {
      kind: 'session',
      accessToken: token,
      user: {
        id: fresh.id,
        email: fresh.email,
        displayName: fresh.displayName || disp,
        orgRole: fresh.orgRole,
        platformRole: fresh.platformRole,
      },
      organization: {
        id: fresh.organization.id,
        name: fresh.organization.name,
        plan: fresh.organization.plan,
        kind: fresh.organization.kind,
      },
    }
  }

  const hash = await bcrypt.hash(String(password), 10)

  await assertOrgUnderUserCap(prisma, invite.organizationId, invite.organization.plan)

  const needVerify = isEmailVerificationRequiredForPasswordRegister()
  if (needVerify) {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: em,
          displayName: disp,
          passwordHash: hash,
          emailVerifiedAt: null,
          organizationId: invite.organizationId,
          orgRole: invite.orgRole,
          platformRole: 'none',
        },
      })
      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      })
      return { user }
    })
    try {
      await createVerificationTokenAndSendEmail(prisma, result.user.id, result.user.email, disp)
    } catch (e: unknown) {
      await prisma.user.delete({ where: { id: result.user.id } }).catch(() => {})
      await prisma.organizationInvite
        .update({ where: { id: invite.id }, data: { usedAt: null } })
        .catch(() => {})
      throw new HttpError(
        e instanceof Error ? `No se pudo enviar el correo de verificación: ${e.message}` : 'No se pudo enviar el correo',
        503,
      )
    }
    return { kind: 'pending', email: em }
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MS)
  const org = invite.organization

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: em,
        displayName: disp,
        passwordHash: hash,
        emailVerifiedAt: new Date(),
        organizationId: invite.organizationId,
        orgRole: invite.orgRole,
        platformRole: 'none',
      },
    })
    await tx.organizationInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    })
    await tx.session.create({
      data: { token, userId: user.id, expiresAt },
    })
    return { user }
  })

  void sendWelcomeEmailSafe({
    toEmail: result.user.email,
    toName: result.user.displayName || disp,
    organizationName: org.name,
    plan: org.plan,
    organizationKind: org.kind,
    trialEndsAt: org.trialEndsAt,
  })

  return {
    kind: 'session',
    accessToken: token,
    user: {
      id: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName || disp,
      orgRole: result.user.orgRole,
      platformRole: result.user.platformRole,
    },
    organization: {
      id: org.id,
      name: org.name,
      plan: org.plan,
      kind: org.kind,
    },
  }
}

/** Primera cuenta en la plataforma vía Google con enlace de invitación (entra directo en la org invitada). */
export async function prismaJoinOrganizationAsNewGoogleUser(
  prisma: PrismaClient,
  params: {
    email: string
    displayName: string
    googleSub: string
    rawInviteToken: string
  }
): Promise<{
  accessToken: string
  user: {
    id: string
    email: string
    displayName: string
    orgRole: string
    platformRole: string
  }
  organization: { id: string; name: string; plan: string; kind: string }
}> {
  const em = normEmail(params.email)
  const dup = await prisma.user.findFirst({
    where: { OR: [{ email: em }, { googleSub: params.googleSub }] },
    select: { id: true },
  })
  if (dup) {
    throw new HttpError(
      'Esta cuenta ya está registrada. Inicia sesión con Google usando el enlace con la invitación (?invite=… en la URL).',
      409,
    )
  }

  const raw = params.rawInviteToken.trim()
  const h = hashInviteToken(raw)
  const invite = await prisma.organizationInvite.findUnique({
    where: { tokenHash: h },
    include: { organization: true },
  })
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    throw new HttpError('Invitación inválida o caducada. Pide un nuevo enlace al administrador.', 400)
  }

  await assertOrgUnderUserCap(prisma, invite.organizationId, invite.organization.plan)

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MS)
  const org = invite.organization
  const disp = String(params.displayName || em.split('@')[0] || 'Usuario').trim()

  const newUser = await prisma.$transaction(async (tx) => {
    const marked = await tx.organizationInvite.updateMany({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (marked.count !== 1) {
      throw new HttpError('Invitación ya utilizada o inválida.', 400)
    }
    return tx.user.create({
      data: {
        email: em,
        displayName: disp,
        passwordHash: null,
        googleSub: params.googleSub,
        emailVerifiedAt: new Date(),
        organizationId: invite.organizationId,
        orgRole: invite.orgRole,
        platformRole: 'none',
      },
    })
  })

  await prisma.session.create({
    data: { token, userId: newUser.id, expiresAt },
  })

  void sendWelcomeEmailSafe({
    toEmail: newUser.email,
    toName: newUser.displayName || disp,
    organizationName: org.name,
    plan: org.plan,
    organizationKind: org.kind,
    trialEndsAt: org.trialEndsAt,
  })

  return {
    accessToken: token,
    user: {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName || disp,
      orgRole: newUser.orgRole,
      platformRole: newUser.platformRole,
    },
    organization: {
      id: org.id,
      name: org.name,
      plan: org.plan,
      kind: org.kind,
    },
  }
}
