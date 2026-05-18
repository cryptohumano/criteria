/**
 * OAuth 2.0 de Google para sesión B2B (Prisma).
 * Requiere GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI.
 */
import type { Request, Response, Express } from 'express'
import { randomBytes } from 'node:crypto'
import { getPrisma } from '../db.js'
import { googleOAuthStartLimiter } from '../middleware/rateLimits.js'
import { prismaLoginWithGoogle } from '../prisma-auth.js'
import { HttpError, getHttpStatus } from '../auth/httpError.js'

const pending = new Map<string, { returnUrl: string; expiresAt: number; inviteToken?: string }>()
const PENDING_TTL_MS = 15 * 60 * 1000

function prunePending() {
  const now = Date.now()
  for (const [k, v] of pending) {
    if (v.expiresAt < now) pending.delete(k)
  }
}

function getFrontendOrigin(): string {
  const raw = (process.env.AUTH_FRONTEND_ORIGIN || 'http://localhost:5173').trim().replace(/\/$/, '')
  return raw
}

function isAllowedReturnUrl(candidate: string, allowedOrigin: string): boolean {
  try {
    const u = new URL(candidate)
    const o = new URL(allowedOrigin.endsWith('/') ? allowedOrigin : `${allowedOrigin}/`)
    return u.origin === o.origin
  } catch {
    return false
  }
}

function sanitizeReturnUrl(raw: string | undefined): string {
  prunePending()
  const allowedOrigin = getFrontendOrigin()
  if (raw && isAllowedReturnUrl(raw, allowedOrigin)) {
    return raw
  }
  return `${allowedOrigin}/auth/google/callback`
}

async function exchangeCode(code: string): Promise<{
  access_token: string
  id_token?: string
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Falta GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_OAUTH_REDIRECT_URI')
  }
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const desc = typeof json.error_description === 'string' ? json.error_description : JSON.stringify(json)
    throw new Error(`Google token: ${res.status} ${desc}`)
  }
  const access_token = json.access_token as string | undefined
  if (!access_token) throw new Error('Google no devolvió access_token')
  return { access_token, id_token: json.id_token as string | undefined }
}

async function fetchGoogleProfile(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(`Google userinfo: ${res.status}`)
  }
  return json
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get('/api/auth/google/start', googleOAuthStartLimiter, (req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
    if (!clientId) {
      return res.status(503).json({
        error: 'Google OAuth no está configurado (GOOGLE_CLIENT_ID).',
      })
    }
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim()
    if (!redirectUri) {
      return res.status(503).json({
        error: 'Falta GOOGLE_OAUTH_REDIRECT_URI (URL de callback del API, p. ej. http://localhost:3456/api/auth/google/callback).',
      })
    }

    const returnUrl = sanitizeReturnUrl(typeof req.query.return === 'string' ? req.query.return : undefined)
    const inviteRaw = typeof req.query.invite === 'string' ? req.query.invite.trim() : ''
    const state = randomBytes(24).toString('hex')
    pending.set(state, {
      returnUrl,
      expiresAt: Date.now() + PENDING_TTL_MS,
      inviteToken: inviteRaw || undefined,
    })

    const scope = encodeURIComponent('openid email profile')
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      '&response_type=code' +
      `&scope=${scope}` +
      `&state=${encodeURIComponent(state)}` +
      '&prompt=select_account'

    res.redirect(302, url)
  })

  app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
    const returnWithError = (returnUrl: string, code: string, message: string) => {
      const u = new URL(returnUrl)
      u.hash = `error=${encodeURIComponent(code)}&error_description=${encodeURIComponent(message)}`
      res.redirect(302, u.href)
    }

    const fallbackReturn = sanitizeReturnUrl(undefined)
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    const err = typeof req.query.error === 'string' ? req.query.error : ''

    if (err) {
      return returnWithError(fallbackReturn, err, String(req.query.error_description || err))
    }

    prunePending()
    const pendingRow = state ? pending.get(state) : undefined
    if (!pendingRow) {
      return returnWithError(fallbackReturn, 'invalid_state', 'Estado OAuth inválido o caducado. Vuelve a intentar.')
    }
    pending.delete(state)
    const { returnUrl } = pendingRow

    if (!code) {
      return returnWithError(returnUrl, 'missing_code', 'Google no devolvió código de autorización.')
    }

    let prisma: Awaited<ReturnType<typeof getPrisma>> = null
    try {
      prisma = await getPrisma()
    } catch (e) {
      console.error('[auth/google/callback] Prisma:', e)
      return returnWithError(fallbackReturn, 'no_database', 'Base de datos no disponible para completar el inicio de sesión.')
    }

    if (!prisma) {
      return returnWithError(returnUrl, 'no_database', 'Base de datos no configurada (DATABASE_URL).')
    }

    try {
      const tokens = await exchangeCode(code)
      const raw = await fetchGoogleProfile(tokens.access_token)
      const sub = String(raw.sub || '')
      const email = String(raw.email || '')
      const emailVerified = raw.email_verified === true || raw.email_verified === 'true'
      const name = typeof raw.name === 'string' ? raw.name : undefined
      if (!sub || !email) {
        return returnWithError(returnUrl, 'incomplete_profile', 'Perfil de Google incompleto.')
      }

      const session = await prismaLoginWithGoogle(
        prisma,
        {
          sub,
          email,
          emailVerified,
          name,
        },
        pendingRow.inviteToken ? { rawInviteToken: pendingRow.inviteToken } : undefined
      )

      const u = new URL(returnUrl)
      u.hash =
        `access_token=${encodeURIComponent(session.accessToken)}` +
        `&token_type=Bearer` +
        `&user_email=${encodeURIComponent(session.user.email)}`
      res.redirect(302, u.href)
    } catch (e: unknown) {
      const status = e instanceof HttpError ? e.statusCode : getHttpStatus(e)
      const message = e instanceof Error ? e.message : 'Error OAuth'
      console.error('[auth/google/callback]', e)
      return returnWithError(returnUrl, `oauth_${status}`, message)
    }
  })
}
