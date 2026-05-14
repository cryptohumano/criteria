/**
 * Enlace mágico + límites por correo (cooldown y techo horario). Rate limit por IP en middleware.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { sendMailerSendEmail } from '../email/mailerSend.js'
import { sendWelcomeEmailSafe } from '../email/welcomeEmail.js'
import { getAuthApiPublicBaseUrl } from '../config/emailVerificationPolicy.js'
import { HttpError } from './httpError.js'

const TOKEN_BYTES = 32
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const SEND_COOLDOWN_MS = 60_000
const MAX_SENDS_PER_EMAIL_PER_HOUR = 5

const lastSendAt = new Map<string, number>()
const sendHistory = new Map<string, number[]>()

function pruneHistory(em: string) {
  const now = Date.now()
  const h = sendHistory.get(em) || []
  const cutoff = now - 60 * 60 * 1000
  const next = h.filter((t) => t > cutoff)
  sendHistory.set(em, next)
  return next
}

export function assertCanSendVerificationEmail(emailNorm: string) {
  const now = Date.now()
  const last = lastSendAt.get(emailNorm) || 0
  if (now - last < SEND_COOLDOWN_MS) {
    throw new HttpError(
      `Espera ${Math.ceil((SEND_COOLDOWN_MS - (now - last)) / 1000)} s antes de pedir otro correo.`,
      429
    )
  }
  const hour = pruneHistory(emailNorm)
  if (hour.length >= MAX_SENDS_PER_EMAIL_PER_HOUR) {
    throw new HttpError('Demasiados envíos a este correo en la última hora. Inténtalo más tarde.', 429)
  }
}

export function recordVerificationEmailSent(emailNorm: string) {
  const now = Date.now()
  lastSendAt.set(emailNorm, now)
  const h = sendHistory.get(emailNorm) || []
  h.push(now)
  sendHistory.set(emailNorm, h)
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export async function createVerificationTokenAndSendEmail(
  prisma: PrismaClient,
  userId: string,
  email: string,
  displayName: string
): Promise<void> {
  const em = email.trim().toLowerCase()
  assertCanSendVerificationEmail(em)

  const token = randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.deleteMany({
      where: { userId, usedAt: null },
    })
    await tx.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    })
  })

  const verifyUrl = `${getAuthApiPublicBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`
  const name = displayName || em.split('@')[0] || 'Usuario'

  try {
    await sendMailerSendEmail({
      to: { email: em, name },
      subject: 'Verifica tu correo — criterIA',
      text: `Hola ${name},\n\nConfirma tu cuenta abriendo este enlace (válido 24 h):\n${verifyUrl}\n\nSi no creaste la cuenta, ignora este mensaje.`,
      html: `<p>Hola ${escapeHtml(name)},</p><p><a href="${escapeAttr(verifyUrl)}">Verificar mi correo</a></p><p style="color:#666;font-size:12px;">Válido 24 h. Si no creaste la cuenta en criterIA, ignora este mensaje.</p>`,
    })
    recordVerificationEmailSent(em)
  } catch (e) {
    await prisma.emailVerificationToken.deleteMany({ where: { userId, tokenHash } }).catch(() => {})
    throw e
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

export async function consumeVerificationTokenAndOpenSession(
  prisma: PrismaClient,
  token: string
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
  const tokenHash = hashToken(token.trim())
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { organization: true } } },
  })
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new HttpError('Enlace inválido o caducado.', 400)
  }

  const SESSION_MS = 14 * 24 * 60 * 60 * 1000
  const sessionToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MS)

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    })
    await tx.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    })
    await tx.session.create({
      data: { token: sessionToken, userId: row.userId, expiresAt },
    })
  })

  const u = row.user
  const o = u.organization
  void sendWelcomeEmailSafe({
    toEmail: u.email,
    toName: u.displayName || u.email.split('@')[0] || 'Usuario',
    organizationName: o.name,
    plan: o.plan,
    organizationKind: o.kind,
    trialEndsAt: o.trialEndsAt,
  })
  return {
    accessToken: sessionToken,
    user: {
      id: u.id,
      email: u.email,
      displayName: u.displayName || u.email.split('@')[0],
      orgRole: u.orgRole,
      platformRole: u.platformRole,
    },
    organization: {
      id: o.id,
      name: o.name,
      plan: o.plan,
      kind: o.kind,
    },
  }
}
