/**
 * Límites por IP para endurecer auth y proxy LLM sin afectar health checks.
 * Valores por defecto: estrictos en producción, holgados en desarrollo (ver `config/rateLimitProfile.ts`).
 */
import rateLimit from 'express-rate-limit'
import {
  getApiPerMinuteMax,
  getAuthMax,
  getLlmModelsPerMinuteMax,
  getLlmProxyPerMinuteMax,
  getResendVerificationIpMax,
  getVerifyEmailIpMax,
  rateLimitDevBypass,
} from '../config/rateLimitProfile.js'

const ms = (m: number) => m * 60 * 1000

const devSkipAll = rateLimitDevBypass ? { skip: (): boolean => true } : {}

/** Login y registro: anti fuerza bruta. */
export const authCredentialsLimiter = rateLimit({
  windowMs: ms(15),
  max: getAuthMax(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
  ...devSkipAll,
})

/** Resto de rutas /api/* (se excluyen health y estáticos de 404). */
export const apiGeneralLimiter = rateLimit({
  windowMs: ms(1),
  max: getApiPerMinuteMax(),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (rateLimitDevBypass) return true
    const p = req.path || req.url || ''
    return p.includes('health') || p.includes('llm-proxy-health')
  },
})

/** Proxy Gemini: consumo costoso. */
export const llmProxyLimiter = rateLimit({
  windowMs: ms(1),
  max: getLlmProxyPerMinuteMax(),
  standardHeaders: true,
  legacyHeaders: false,
  ...devSkipAll,
})

/** Listado de modelos (query con API key en URL). */
export const llmModelsLimiter = rateLimit({
  windowMs: ms(1),
  max: getLlmModelsPerMinuteMax(),
  standardHeaders: true,
  legacyHeaders: false,
  ...devSkipAll,
})

/** GET /api/auth/verify-email (clics en enlace). */
export const verifyEmailIpLimiter = rateLimit({
  windowMs: ms(15),
  max: getVerifyEmailIpMax(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de verificación desde esta red. Espera unos minutos.' },
  ...devSkipAll,
})

/** POST /api/auth/resend-verification */
export const resendVerificationIpLimiter = rateLimit({
  windowMs: ms(15),
  max: getResendVerificationIpMax(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados reenvíos. Espera unos minutos.' },
  ...devSkipAll,
})
