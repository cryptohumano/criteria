/**
 * Catálogo de planes (B2B / B2C) + defaults de cuota.
 *
 * La única métrica de cuota *real* del producto son los **tokens LLM** consumidos
 * por organización en el periodo del plan. No se limita la cantidad de documentos
 * (cada conversación / pad de Etherpad es un documento gratuito en sí mismo;
 * lo que cuesta es la interacción con el agente, medida en tokens).
 *
 * Cada plan declara su periodo de renovación de cupos (`tokenPeriod`):
 * - `month`: ventana mensual (UTC para trial sin Stripe; ciclo Stripe en planes pago).
 * - `fortnight`: quincena rodante de 15 días desde `Organization.createdAt`.
 *
 * Overrides por env (ver `usage/planLimits.ts`):
 * - `tokenPeriod === 'fortnight'` → `PLAN_<PLANID>_LLM_TOKENS_PER_FORTNIGHT`.
 * - `tokenPeriod === 'month'`     → `PLAN_<PLANID>_LLM_TOKENS_PER_MONTH`.
 */

export type BillingPlanId = 'trial' | 'starter' | 'pro' | 'enterprise'

/** Periodo de renovación de cupos de un plan. */
export type TokenPeriod = 'month' | 'fortnight'

export type PlanEntitlements = {
  id: BillingPlanId
  /** Etiqueta corta para UI */
  label: string
  /** Precio de referencia en USD/mes (solo informativo; el cobro real es el Price de Stripe). */
  monthlyPriceUsd: number | null
  /** 0 = sin tope de usuarios (Enterprise). */
  maxUsersPerOrg: number
  /**
   * Tokens LLM agregados por *periodo del plan*; 0 = ilimitado.
   * Debe coincidir con defaults en `planLimits.ts`.
   */
  monthlyLlmTokens: number
  /** Periodo de renovación de tokens. */
  tokenPeriod: TokenPeriod
  /** Líneas de marketing / producto (ES). */
  highlights: string[]
}

const PLANS: Record<BillingPlanId, PlanEntitlements> = {
  trial: {
    id: 'trial',
    label: 'Trial (quincenal)',
    monthlyPriceUsd: 0,
    maxUsersPerOrg: 1,
    monthlyLlmTokens: 50_000,
    tokenPeriod: 'fortnight',
    highlights: [
      '1 usuario, 1 organización',
      '50k tokens de agente / quincena',
      'Documentos ilimitados (la cuota real es por tokens)',
      'Etherpad + PII por patrones; export PDF manual',
    ],
  },
  starter: {
    id: 'starter',
    label: 'Starter',
    monthlyPriceUsd: 29,
    maxUsersPerOrg: 5,
    monthlyLlmTokens: 2_000_000,
    tokenPeriod: 'month',
    highlights: [
      'Hasta 5 usuarios por organización',
      '~2M tokens de agente / mes incluidos',
      'Documentos ilimitados',
      'Export PDF y panel de uso',
    ],
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    monthlyPriceUsd: 99,
    maxUsersPerOrg: 20,
    monthlyLlmTokens: 10_000_000,
    tokenPeriod: 'month',
    highlights: [
      'Hasta 20 usuarios',
      '~10M tokens / mes',
      'Documentos ilimitados',
      'Prioridad de colas / modelos superiores (configuración de producto)',
    ],
  },
  enterprise: {
    id: 'enterprise',
    label: 'Enterprise',
    monthlyPriceUsd: 399,
    maxUsersPerOrg: 0,
    monthlyLlmTokens: 0,
    tokenPeriod: 'month',
    highlights: [
      'SSO, SLA, retención y despliegue dedicado (venta asistida)',
      'Límites negociados (tokens, usuarios)',
      'Auditoría y compliance según acuerdo',
    ],
  },
}

export function normalizeBillingPlanId(plan: string): BillingPlanId {
  const p = String(plan || 'trial')
    .trim()
    .toLowerCase()
  if (p === 'starter' || p === 'pro' || p === 'enterprise' || p === 'trial') return p
  return 'trial'
}

export function getPlanEntitlements(plan: string): PlanEntitlements {
  const id = normalizeBillingPlanId(plan)
  return PLANS[id]
}

export function listBillingPlanIds(): BillingPlanId[] {
  return ['trial', 'starter', 'pro', 'enterprise']
}

/** Tokens por periodo del plan, por defecto (antes de leer env en planLimits). */
export function defaultLlmTokensPerPeriodByPlan(): Record<BillingPlanId, number> {
  return {
    trial: PLANS.trial.monthlyLlmTokens,
    starter: PLANS.starter.monthlyLlmTokens,
    pro: PLANS.pro.monthlyLlmTokens,
    enterprise: PLANS.enterprise.monthlyLlmTokens,
  }
}

/** Periodo de renovación de cada plan (tokens). */
export function tokenPeriodByPlan(): Record<BillingPlanId, TokenPeriod> {
  return {
    trial: PLANS.trial.tokenPeriod,
    starter: PLANS.starter.tokenPeriod,
    pro: PLANS.pro.tokenPeriod,
    enterprise: PLANS.enterprise.tokenPeriod,
  }
}

function stripePriceIdConfigured(plan: BillingPlanId): boolean {
  if (plan === 'trial') return false
  if (plan === 'starter') return Boolean(String(process.env.STRIPE_PRICE_STARTER || '').trim())
  if (plan === 'pro') return Boolean(String(process.env.STRIPE_PRICE_PRO || '').trim())
  if (plan === 'enterprise') return Boolean(String(process.env.STRIPE_PRICE_ENTERPRISE || '').trim())
  return false
}

/** Respuesta segura para `GET /api/billing/plans` (sin secretos). */
export function listPlansPublicPayload() {
  return {
    currency: 'usd',
    plans: listBillingPlanIds().map((id) => {
      const e = PLANS[id]
      return {
        id: e.id,
        label: e.label,
        monthlyPriceUsd: e.monthlyPriceUsd,
        maxUsersPerOrg: e.maxUsersPerOrg,
        monthlyLlmTokens: e.monthlyLlmTokens,
        tokenPeriod: e.tokenPeriod,
        highlights: e.highlights,
        stripeCheckoutAvailable: stripePriceIdConfigured(id),
      }
    }),
    addOns: {
      extraTokensPackUsd: 10,
      extraTokensPackMillion: 2,
      extraUserUsdRange: [5, 10] as const,
    },
  }
}
