import { getApiBaseUrl, hasWorkspaceApiBase } from '@/config/saasConfig'
import { readWorkspaceSession } from '@/services/workspace/sessionStorage'

function authHeaders(): HeadersInit {
  const t = readWorkspaceSession()?.accessToken
  if (!t) throw new Error('No hay sesión de plataforma')
  return { Authorization: `Bearer ${t}` }
}

export type LlmUsageResponse = {
  periodStart: string
  periodEnd: string | null
  periodSource: 'stripe' | 'utc-month' | 'rolling-fortnight'
  /** Cadencia de renovación de cupos del plan. */
  tokenPeriod?: 'month' | 'fortnight'
  plan: string
  organizationId: string
  organizationName: string
  /** Tokens consumidos en el periodo actual del plan (mensual o quincenal). */
  usedTokensThisMonth: number
  /** Tope de tokens del plan en el periodo actual. */
  monthlyTokenLimit: number
  /** 0 = sin tope según catálogo de planes. */
  maxUsersPerOrg?: number
  /** Miembros actuales en la organización (asientos ocupados). */
  memberCount?: number
  quotaEnforced: boolean
  unlimited: boolean
  noDatabase: boolean
  trialEndsAt?: string | null
  trialExpired?: boolean
}

export async function fetchLlmUsage(): Promise<LlmUsageResponse> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/usage/llm`, { headers: authHeaders() })
  const data = (await r.json().catch(() => ({}))) as LlmUsageResponse & { error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  return data as LlmUsageResponse
}
