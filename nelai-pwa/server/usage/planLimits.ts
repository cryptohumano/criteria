/**
 * Límite de tokens de IA facturables por org y *periodo del plan* (clave del sistema).
 * `0` = sin límite (enterprise por defecto).
 *
 * Override por env (según `tokenPeriod` del plan en `planCatalog.ts`):
 * - `tokenPeriod === 'fortnight'` → `PLAN_<ID>_LLM_TOKENS_PER_FORTNIGHT`
 * - `tokenPeriod === 'month'`     → `PLAN_<ID>_LLM_TOKENS_PER_MONTH`
 *
 * Defaults alineados con `server/billing/planCatalog.ts`.
 */
import {
  defaultLlmTokensPerPeriodByPlan,
  normalizeBillingPlanId,
  tokenPeriodByPlan,
  type BillingPlanId,
  type TokenPeriod,
} from '../billing/planCatalog.js'

const DEFAULT_TOKENS: Record<BillingPlanId, number> = defaultLlmTokensPerPeriodByPlan()
const PERIOD_BY_PLAN: Record<BillingPlanId, TokenPeriod> = tokenPeriodByPlan()

export function normalizePlanId(plan: string): string {
  return normalizeBillingPlanId(String(plan || 'trial').trim().toLowerCase() || 'trial')
}

function envSuffixForPeriod(period: TokenPeriod): 'PER_FORTNIGHT' | 'PER_MONTH' {
  return period === 'fortnight' ? 'PER_FORTNIGHT' : 'PER_MONTH'
}

/**
 * Tokens LLM máximos sumados (`UsageEvent` unit=token, kind `llm.*`) en el periodo
 * actual del plan; 0 = ilimitado.
 */
export function getLlmTokenLimitForPlan(plan: string): number {
  const id = normalizePlanId(plan) as BillingPlanId
  const period = PERIOD_BY_PLAN[id] ?? 'month'
  const suffix = envSuffixForPeriod(period)
  const envName = `PLAN_${id.toUpperCase()}_LLM_TOKENS_${suffix}`
  const fromEnv = process.env[envName]?.trim()
  if (fromEnv !== undefined && fromEnv !== '') {
    const n = Number(fromEnv)
    if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  }
  return DEFAULT_TOKENS[id] ?? DEFAULT_TOKENS.trial
}

/** Si false, se registran eventos pero no se corta el tráfico (solo desarrollo). */
export function isLlmQuotaEnforced(): boolean {
  if (process.env.NODE_ENV !== 'production' && process.env.USAGE_ENFORCE_LLM_QUOTA === '0') {
    return false
  }
  if (process.env.USAGE_ENFORCE_LLM_QUOTA === '1' || process.env.USAGE_ENFORCE_LLM_QUOTA === 'true') {
    return true
  }
  return process.env.NODE_ENV === 'production'
}
