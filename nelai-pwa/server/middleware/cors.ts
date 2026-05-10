/**
 * CORS explícito para el front (PWA) y preflight.
 */
import type { RequestHandler } from 'express'

export const corsMiddleware: RequestHandler = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*')
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
