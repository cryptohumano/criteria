import { getApiBaseUrl, hasWorkspaceApiBase } from '@/config/saasConfig'
import { readWorkspaceSession } from '@/services/workspace/sessionStorage'

function authHeaders(): HeadersInit {
  const t = readWorkspaceSession()?.accessToken
  if (!t) throw new Error('No hay sesión de plataforma')
  return { Authorization: `Bearer ${t}` }
}

export type BillingPlanPublic = {
  id: string
  label: string
  monthlyPriceUsd: number | null
  maxUsersPerOrg: number
  /** Tokens LLM máximos por *periodo del plan*. */
  monthlyLlmTokens: number
  /** Cadencia de renovación de cupos. */
  tokenPeriod: 'month' | 'fortnight'
  highlights: string[]
  stripeCheckoutAvailable: boolean
}

export type BillingPlansResponse = {
  currency: string
  plans: BillingPlanPublic[]
  addOns: {
    extraTokensPackUsd: number
    extraTokensPackMillion: number
    extraUserUsdRange: readonly [number, number]
  }
}

export type BillingStatusOrganization = {
  id: string
  name: string
  plan: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripeSubscriptionStatus: string | null
  stripeCurrentPeriodStart: string | null
  stripeCurrentPeriodEnd: string | null
}

export type BillingStatusSnapshot = {
  planId: string
  planLabel: string
  maxUsersPerOrg: number
  llmTokensPerPeriod: number
  tokenPeriod: 'month' | 'fortnight'
  stripeSubscriptionStatus: string | null
  stripeCurrentPeriodStart: string | null
  stripeCurrentPeriodEnd: string | null
  /** Plan cuyo checkout está bloqueado por suscripción activa del mismo tier. */
  lockedCheckoutPlanId: 'starter' | 'pro' | 'enterprise' | null
}

export type BillingStatusResponse = {
  organization: BillingStatusOrganization
  billing: BillingStatusSnapshot
}

export async function fetchBillingStatus(): Promise<BillingStatusResponse> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/billing/status`, {
    method: 'GET',
    headers: { ...authHeaders() },
    credentials: 'include',
  })
  const data = (await r.json().catch(() => ({}))) as BillingStatusResponse & { error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (!data.organization || !data.billing) throw new Error('Respuesta inválida de /api/billing/status')
  return data as BillingStatusResponse
}

/** Catálogo de planes (público, sin Bearer). */
export async function fetchBillingPlans(): Promise<BillingPlansResponse> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/billing/plans`)
  const data = (await r.json().catch(() => ({}))) as BillingPlansResponse & { error?: string }
  if (!r.ok) throw new Error((data as { error?: string }).error || `Error ${r.status}`)
  if (!Array.isArray(data.plans)) throw new Error('Respuesta inválida de /api/billing/plans')
  return data as BillingPlansResponse
}

export async function createCheckout(plan: 'starter' | 'pro' | 'enterprise'): Promise<{ url: string }> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/billing/checkout`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ plan }),
  })
  const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (!data.url) throw new Error('Respuesta inválida de checkout')
  return { url: data.url }
}

export type BillingSyncResponse = {
  synced: boolean
  organization?: {
    plan: string
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
    stripeSubscriptionStatus: string | null
    stripeCurrentPeriodStart: string | null
    stripeCurrentPeriodEnd: string | null
  }
}

/**
 * Reconcilia la org con Stripe tras Checkout (por si el webhook aún no corrió).
 * Los tokens LLM se derivan del `plan` en servidor (`getLlmTokenLimitForPlan`).
 */
export async function postBillingSync(): Promise<BillingSyncResponse> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/billing/sync`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  })
  const data = (await r.json().catch(() => ({}))) as BillingSyncResponse & { error?: string }
  // API antigua (sin redeploy tras añadir /sync): no romper Ajustes / Facturación.
  if (r.status === 404) {
    return { synced: false }
  }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  return data as BillingSyncResponse
}

export async function openPortal(): Promise<{ url: string }> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/billing/portal`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  })
  const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (!data.url) throw new Error('Respuesta inválida de portal')
  return { url: data.url }
}

