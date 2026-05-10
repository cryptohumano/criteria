/**
 * Firma C2PA: en producción exige sesión salvo `C2PA_REQUIRE_AUTH=false`;
 * en desarrollo solo exige sesión si `C2PA_REQUIRE_AUTH=true|1`.
 */
import type { RequestHandler } from 'express'
import { requireAuth } from './authz.js'

type Resolver = Parameters<typeof requireAuth>[0]

export function c2paSigningRequiresSession(): boolean {
  const raw = process.env.C2PA_REQUIRE_AUTH?.trim().toLowerCase()
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  if (raw === 'true' || raw === '1' || raw === 'yes') return true
  return process.env.NODE_ENV === 'production'
}

export function c2paSignAuthResolver(resolveSession: Resolver): RequestHandler {
  const guard = requireAuth(resolveSession)
  return (req, res, next) => {
    if (!c2paSigningRequiresSession()) return next()
    return guard(req, res, next)
  }
}
