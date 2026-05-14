/**
 * Auth B2B con Prisma (PostgreSQL).
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'
import type { AuthSession } from './auth/types.js'
import { HttpError } from './auth/httpError.js'
import { computeTrialExpired } from './usage/orgEntitlements.js'
import { isEmailVerificationRequiredForPasswordRegister } from './config/emailVerificationPolicy.js'
import { createVerificationTokenAndSendEmail } from './auth/emailVerificationFlow.js'
import { sendWelcomeEmailSafe } from './email/welcomeEmail.js'

const SESSION_MS = 14 * 24 * 60 * 60 * 1000

export type PrismaRegisterSessionResult = {
  kind: 'session'
  accessToken: string
  user: {
    id: string
    email: string
    displayName: string
    orgRole: string
    platformRole: string
  }
  organization: {
    id: string
    name: string
    plan: string
    kind: string
  }
}

export type PrismaRegisterResult = PrismaRegisterSessionResult | { kind: 'pending'; email: string }

function normEmail(email: unknown): string {
  return String(email).trim().toLowerCase()
}

export interface RegisterBody {
  organizationName?: string
  email?: string
  password?: string
  displayName?: string
  accountKind?: string
  /** Token de invitaci?n (enlace /register?invite=?). Si viene, se une a la org existente en lugar de crear una nueva. */
  inviteToken?: string
}

export interface LoginBody {
  email?: string
  password?: string
  /** Misma invitaci?n que en registro (`/login?invite=?`). Tras validar credenciales, une a la organizaci?n. */
  inviteToken?: string
}

/**
 * Cuenta equipo (B2B): `accountKind` = "team" y nombre de organizaci?n obligatorio.
 * Cuenta personal (B2C): `accountKind` = "personal" o sin nombre de org.
 * `platformRole` superadmin solo por operaci?n en base de datos, nunca por este endpoint.
 */
export async function prismaRegister(prisma: PrismaClient, body: RegisterBody): Promise<PrismaRegisterResult> {
  const rawInvite = typeof body.inviteToken === 'string' ? body.inviteToken.trim() : ''
  if (rawInvite) {
    const { prismaRegisterWithInviteToken } = await import('./org/orgInviteService.js')
    return prismaRegisterWithInviteToken(prisma, body, rawInvite) as Promise<PrismaRegisterResult>
  }

  const { organizationName, email, password, displayName, accountKind } = body || {}
  if (!email || !password) {
    throw new HttpError('email y password son requeridos', 400)
  }
  const em = normEmail(email)
  const existingUser = await prisma.user.findUnique({
    where: { email: em },
    select: { passwordHash: true },
  })
  if (existingUser) {
    if (!existingUser.passwordHash) {
      throw new HttpError('Ya existe una cuenta con este correo (Google). Inicia sesi?n con Google.', 409)
    }
    throw new HttpError('Ya existe una cuenta con este correo. Inicia sesi?n.', 409)
  }
  const disp = String(displayName || em.split('@')[0] || 'Usuario').trim()
  const kind = String(accountKind || '')
    .toLowerCase()
    .trim()
  const wantsTeam =
    kind === 'team' || (kind !== 'personal' && String(organizationName || '').trim().length > 0)
  if (wantsTeam && !String(organizationName || '').trim()) {
    throw new HttpError('Para cuenta equipo (B2B), organizationName es requerido', 400)
  }
  const orgName = wantsTeam ? String(organizationName).trim() : `Cuenta de ${disp}`

  const hash = await bcrypt.hash(String(password), 10)
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  const needVerify = isEmailVerificationRequiredForPasswordRegister()

  if (needVerify) {
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          plan: 'trial',
          kind: wantsTeam ? 'team' : 'personal',
          trialEndsAt,
        },
      })
      const user = await tx.user.create({
        data: {
          email: em,
          displayName: disp,
          passwordHash: hash,
          emailVerifiedAt: null,
          organizationId: org.id,
          orgRole: 'owner',
          platformRole: 'none',
        },
      })
      return { org, user }
    })
    try {
      await createVerificationTokenAndSendEmail(prisma, result.user.id, result.user.email, disp)
    } catch (e: unknown) {
      await prisma.user.delete({ where: { id: result.user.id } }).catch(() => {})
      await prisma.organization.delete({ where: { id: result.org.id } }).catch(() => {})
      throw new HttpError(
        e instanceof Error
          ? `No se pudo enviar el correo de verificaci?n: ${e.message}`
          : 'No se pudo enviar el correo de verificaci?n',
        503
      )
    }
    return { kind: 'pending', email: em }
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MS)
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: orgName,
        plan: 'trial',
        kind: wantsTeam ? 'team' : 'personal',
        trialEndsAt,
      },
    })
    const user = await tx.user.create({
      data: {
        email: em,
        displayName: disp,
        passwordHash: hash,
        emailVerifiedAt: new Date(),
        organizationId: org.id,
        orgRole: 'owner',
        platformRole: 'none',
      },
    })
    await tx.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    })
    return { org, user }
  })

  void sendWelcomeEmailSafe({
    toEmail: result.user.email,
    toName: result.user.displayName || disp,
    organizationName: result.org.name,
    plan: result.org.plan,
    organizationKind: result.org.kind,
    trialEndsAt: result.org.trialEndsAt,
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
      id: result.org.id,
      name: result.org.name,
      plan: result.org.plan,
      kind: result.org.kind,
    },
  }
}

export interface GoogleUserProfile {
  sub: string
  email: string
  emailVerified: boolean
  name?: string
}

export async function prismaLoginWithGoogle(
  prisma: PrismaClient,
  profile: GoogleUserProfile,
  options?: { rawInviteToken?: string }
) {
  const rawInvite = String(options?.rawInviteToken || '').trim()
  if (!profile.emailVerified) {
    throw new HttpError('El correo de Google no est? verificado', 403)
  }
  const em = normEmail(profile.email)
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleSub: profile.sub }, { email: em }] },
    include: { organization: true },
  })

  if (user && user.googleSub && user.googleSub !== profile.sub) {
    throw new HttpError('Este correo ya est? vinculado a otra cuenta de Google', 409)
  }

  if (user && user.email === em && !user.googleSub) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleSub: profile.sub,
        displayName: profile.name?.trim() || user.displayName,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
      include: { organization: true },
    })
  }

  if (!user) {
    if (rawInvite) {
      const { prismaJoinOrganizationAsNewGoogleUser } = await import('./org/orgInviteService.js')
      const disp = String(profile.name || em.split('@')[0] || 'Usuario').trim()
      return prismaJoinOrganizationAsNewGoogleUser(prisma, {
        email: profile.email,
        displayName: disp,
        googleSub: profile.sub,
        rawInviteToken: rawInvite,
      })
    }
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_MS)
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    const disp = String(profile.name || em.split('@')[0] || 'Usuario').trim()
    const created = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: `Cuenta de ${disp}`,
          plan: 'trial',
          kind: 'personal',
          trialEndsAt,
        },
      })
      const newUser = await tx.user.create({
        data: {
          email: em,
          displayName: disp,
          passwordHash: null,
          googleSub: profile.sub,
          emailVerifiedAt: new Date(),
          organizationId: org.id,
          orgRole: 'owner',
          platformRole: 'none',
        },
      })
      await tx.session.create({
        data: { token, userId: newUser.id, expiresAt },
      })
      return { org, user: newUser }
    })
    void sendWelcomeEmailSafe({
      toEmail: created.user.email,
      toName: created.user.displayName || disp,
      organizationName: created.org.name,
      plan: created.org.plan,
      organizationKind: created.org.kind,
      trialEndsAt: created.org.trialEndsAt,
    })
    return {
      accessToken: token,
      user: {
        id: created.user.id,
        email: created.user.email,
        displayName: created.user.displayName || disp,
        orgRole: created.user.orgRole,
        platformRole: created.user.platformRole,
      },
      organization: {
        id: created.org.id,
        name: created.org.name,
        plan: created.org.plan,
        kind: created.org.kind,
      },
    }
  }

  if (rawInvite) {
    const { prismaApplyOrganizationInvite } = await import('./org/orgInviteService.js')
    await prismaApplyOrganizationInvite(prisma, {
      user: { id: user.id, organizationId: user.organizationId, orgRole: user.orgRole },
      rawInviteToken: rawInvite,
    })
    user = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { organization: true },
    })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MS)
  await prisma.session.create({
    data: { token, userId: user.id, expiresAt },
  })
  const o = user.organization
  return {
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName || em.split('@')[0],
      orgRole: user.orgRole,
      platformRole: user.platformRole,
    },
    organization: {
      id: o.id,
      name: o.name,
      plan: o.plan,
      kind: o.kind,
    },
  }
}

export async function prismaLogin(prisma: PrismaClient, body: LoginBody) {
  const { email, password, inviteToken } = body || {}
  if (!email || !password) {
    throw new HttpError('email y password son requeridos', 400)
  }
  const em = normEmail(email)
  let user = await prisma.user.findUnique({
    where: { email: em },
    include: { organization: true },
  })
  if (!user?.passwordHash) {
    throw new HttpError('Esta cuenta usa solo Google. Inicia sesi?n con Google.', 401)
  }
  if (!(await bcrypt.compare(String(password), user.passwordHash))) {
    throw new HttpError('Credenciales inv?lidas', 401)
  }
  if (!user.emailVerifiedAt) {
    throw new HttpError(
      'Verifica tu correo antes de entrar. Revisa la bandeja (y spam) o pide un nuevo enlace desde el registro.',
      403
    )
  }
  const rawInvite = typeof inviteToken === 'string' ? inviteToken.trim() : ''
  if (rawInvite) {
    const { prismaApplyOrganizationInvite } = await import('./org/orgInviteService.js')
    await prismaApplyOrganizationInvite(prisma, {
      user: { id: user.id, organizationId: user.organizationId, orgRole: user.orgRole },
      rawInviteToken: rawInvite,
    })
    user = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { organization: true },
    })
  }
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MS)
  await prisma.session.create({
    data: { token, userId: user.id, expiresAt },
  })
  return {
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName || em.split('@')[0],
      orgRole: user.orgRole,
      platformRole: user.platformRole,
    },
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      plan: user.organization.plan,
      kind: user.organization.kind,
    },
  }
}

export async function prismaResolveSession(
  prisma: PrismaClient,
  token: string | null
): Promise<AuthSession | null> {
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { organization: true } } },
  })
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    }
    return null
  }
  const u = session.user
  const o = u.organization
  const trialExpired = computeTrialExpired(o.plan, o.trialEndsAt)
  return {
    userId: u.id,
    email: u.email,
    displayName: u.displayName || u.email.split('@')[0],
    orgRole: u.orgRole,
    platformRole: u.platformRole,
    organizationId: o.id,
    organizationName: o.name,
    organizationKind: o.kind,
    plan: o.plan,
    trialEndsAt: o.trialEndsAt ? o.trialEndsAt.toISOString() : null,
    trialExpired,
  }
}
