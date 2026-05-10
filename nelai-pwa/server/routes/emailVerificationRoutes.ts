/**
 * Enlace mágico de verificación de correo y reenvío.
 */
import type { Express, Request, Response } from 'express'
import { resendVerificationIpLimiter, verifyEmailIpLimiter } from '../middleware/rateLimits.js'
import type { PrismaClient } from '@prisma/client'
import { HttpError, getHttpStatus } from '../auth/httpError.js'
import {
  consumeVerificationTokenAndOpenSession,
  createVerificationTokenAndSendEmail,
} from '../auth/emailVerificationFlow.js'

/** Origen público de la PWA (puede incluir subruta, p. ej. https://host.com/gh-repo). */
function verificationPageUrl(): string {
  const base = (process.env.AUTH_FRONTEND_ORIGIN || 'http://localhost:5173').trim().replace(/\/$/, '')
  return `${base}/auth/email-verified`
}

export function registerEmailVerificationRoutes(app: Express, getPrisma: () => Promise<PrismaClient | null>) {
  app.get('/api/auth/verify-email', verifyEmailIpLimiter, async (req: Request, res: Response) => {
    const token = typeof req.query.token === 'string' ? req.query.token : ''
    const failRedirect = () => {
      const u = new URL(verificationPageUrl())
      u.hash = `error=${encodeURIComponent('invalid_token')}`
      res.redirect(302, u.href)
    }

    if (!token.trim()) {
      return failRedirect()
    }

    let prisma: PrismaClient | null = null
    try {
      prisma = await getPrisma()
    } catch {
      return failRedirect()
    }
    if (!prisma) {
      return failRedirect()
    }

    try {
      const session = await consumeVerificationTokenAndOpenSession(prisma, token)
      const u = new URL(verificationPageUrl())
      u.hash =
        `access_token=${encodeURIComponent(session.accessToken)}` +
        `&token_type=Bearer` +
        `&user_email=${encodeURIComponent(session.user.email)}`
      res.redirect(302, u.href)
    } catch (e: unknown) {
      console.error('[auth/verify-email]', e)
      if (e instanceof HttpError) {
        const u = new URL(verificationPageUrl())
        u.hash = `error=${encodeURIComponent(e.message)}`
        return res.redirect(302, u.href)
      }
      return failRedirect()
    }
  })

  app.post('/api/auth/resend-verification', resendVerificationIpLimiter, async (req: Request, res: Response) => {
    const email = typeof (req.body as { email?: string })?.email === 'string'
      ? (req.body as { email: string }).email
      : ''
    const em = email.trim().toLowerCase()

    const opaque = () => res.json({ ok: true })

    if (!em) {
      return opaque()
    }

    let prisma: PrismaClient | null = null
    try {
      prisma = await getPrisma()
    } catch {
      return res.status(503).json({ error: 'Base de datos no disponible' })
    }
    if (!prisma) {
      return res.status(503).json({ error: 'Base de datos no configurada' })
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: em },
      })
      if (!user?.passwordHash || user.emailVerifiedAt) {
        return opaque()
      }

      await createVerificationTokenAndSendEmail(
        prisma,
        user.id,
        user.email,
        user.displayName || user.email.split('@')[0] || 'Usuario'
      )
      return opaque()
    } catch (e: unknown) {
      const status = getHttpStatus(e)
      if (e instanceof HttpError && status === 429) {
        return res.status(429).json({ error: e.message })
      }
      console.error('[auth/resend-verification]', e)
      return res.status(status).json({
        error: e instanceof Error ? e.message : 'Error al reenviar',
      })
    }
  })
}
