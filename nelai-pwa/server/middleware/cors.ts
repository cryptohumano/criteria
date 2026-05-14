/**
 * CORS explícito para el front (PWA) y preflight.
 *
 * Con `fetch(..., { credentials: 'include' })` el navegador **no** permite
 * `Access-Control-Allow-Origin: *`; hay que devolver el origen concreto y
 * `Access-Control-Allow-Credentials: true`.
 */
import type { RequestHandler } from 'express'

function tryUrlOrigin(url: string): string | null {
  try {
    return new URL(url.trim()).origin
  } catch {
    return null
  }
}

/** Origen permitido para reflejar en `Access-Control-Allow-Origin`, o `*` si no aplica. */
function resolveAllowOrigin(req: { headers: { origin?: string } }): string {
  const configured = process.env.CORS_ORIGIN?.trim()
  if (configured) return configured

  const originHeader = (req.headers.origin || '').trim()
  if (!originHeader) return '*'

  const incomingOrigin = tryUrlOrigin(originHeader)
  if (!incomingOrigin) return '*'

  const front = (process.env.AUTH_FRONTEND_ORIGIN || 'http://localhost:5173').trim()
  const frontOrigin = tryUrlOrigin(front)
  if (frontOrigin && incomingOrigin === frontOrigin) return originHeader

  // Desarrollo: Vite en localhost, 127.0.0.1 o red privada (p. ej. 192.168.x.x) — credenciales + CORS reflejado
  if (process.env.NODE_ENV !== 'production') {
    try {
      const u = new URL(originHeader)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '*'
      const h = u.hostname
      if (h === 'localhost' || h === '127.0.0.1') return originHeader
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return originHeader
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return originHeader
      if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return originHeader
    } catch {
      /* ignore */
    }
  }

  return '*'
}

export const corsMiddleware: RequestHandler = (req, res, next) => {
  const allowOrigin = resolveAllowOrigin(req)
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  if (allowOrigin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  )
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Request-ID, x-request-id, Authorization',
  )
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, x-request-id')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
}
