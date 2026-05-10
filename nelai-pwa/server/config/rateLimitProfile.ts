/**
 * Perfiles de rate limit: producción (estricto) vs desarrollo (más holgado).
 * Siempre se puede forzar con variables RATE_LIMIT_*; en desarrollo, RATE_LIMIT_DISABLED=1 las omite.
 */
const isProd = process.env.NODE_ENV === 'production'

export const rateLimitDevBypass =
  !isProd && (process.env.RATE_LIMIT_DISABLED === '1' || process.env.RATE_LIMIT_DISABLED === 'true')

function numFromEnv(key: string, whenUnsetDev: number, whenUnsetProd: number): number {
  const raw = process.env[key]?.trim()
  if (raw !== undefined && raw !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : whenUnsetProd
  }
  return isProd ? whenUnsetProd : whenUnsetDev
}

/** Intentos login/registro por ventana (15 min). */
export function getAuthMax(): number {
  return numFromEnv('RATE_LIMIT_AUTH_MAX', 100, 30)
}

/** Peticiones /api/* por minuto (excluye health en skip). */
export function getApiPerMinuteMax(): number {
  return numFromEnv('RATE_LIMIT_API_PER_MIN', 2000, 300)
}

export function getLlmProxyPerMinuteMax(): number {
  return numFromEnv('RATE_LIMIT_LLM_PER_MIN', 200, 60)
}

export function getLlmModelsPerMinuteMax(): number {
  return numFromEnv('RATE_LIMIT_LLM_MODELS_PER_MIN', 100, 30)
}

/** Clics en enlace mágico / intentos de verificación por IP (ventana 15 min). */
export function getVerifyEmailIpMax(): number {
  return numFromEnv('RATE_LIMIT_VERIFY_EMAIL_IP_MAX', 80, 40)
}

/** Reenvío de correo de verificación por IP (ventana 15 min). */
export function getResendVerificationIpMax(): number {
  return numFromEnv('RATE_LIMIT_RESEND_VERIFICATION_IP_MAX', 30, 10)
}
