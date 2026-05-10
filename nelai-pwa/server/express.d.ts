import type { AuthSession } from './auth/types'

declare global {
  namespace Express {
    interface Request {
      /** Sesión resuelta por middleware `requireAuth` / `requirePlatformSuperadmin`. */
      auth?: AuthSession
      /** Asignado por `requestIdMiddleware`. */
      nelaiRequestId?: string
    }
  }
}

export {}
