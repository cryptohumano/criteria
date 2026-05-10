/**
 * Middleware de autorización por sesión Bearer y roles de plataforma.
 */
import type { RequestHandler } from 'express'
import type { AuthSession } from '../auth/types.js'

type Resolver = (req: Parameters<RequestHandler>[0]) => Promise<AuthSession | null>

export function requireAuth(resolveSession: Resolver): RequestHandler {
  return async (req, res, next) => {
    const s = await resolveSession(req)
    if (!s) return res.status(401).json({ error: 'No autorizado' })
    req.auth = s
    next()
  }
}

/** Solo `UserPlatformRole.superadmin` (panel plataforma / métricas). */
export function requirePlatformSuperadmin(resolveSession: Resolver): RequestHandler {
  return async (req, res, next) => {
    const s = await resolveSession(req)
    if (!s) return res.status(401).json({ error: 'No autorizado' })
    if (s.platformRole !== 'superadmin') {
      return res.status(403).json({ error: 'Requiere rol de plataforma superadmin' })
    }
    req.auth = s
    next()
  }
}
