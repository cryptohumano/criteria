import { getApiBaseUrl, hasWorkspaceApiBase } from '@/config/saasConfig'
import { readWorkspaceSession } from '@/services/workspace/sessionStorage'

function authHeaders(): HeadersInit {
  const t = readWorkspaceSession()?.accessToken
  if (!t) throw new Error('No hay sesión de plataforma')
  return { Authorization: `Bearer ${t}` }
}

export type PlatformStats = {
  organizations: number
  users: number
  sessions: number
  apiKeys: number
  apiKeysActive: number
  apiKeysRevoked: number
  usageEvents: number
  usageEvents24h: number
}

export type PlatformOrganizationRow = {
  id: string
  name: string
  plan: string
  kind: string
  stripeCustomerId: string | null
  createdAt: string
  _count: { users: number; apiKeys: number; usageEvents: number }
  /** Tokens LLM (mes civil UTC); ausente si el API es antiguo. */
  llmTokensThisMonth?: number
  /** 0 = ilimitado; ausente si el API es antiguo. */
  llmTokenLimit?: number
  /** 0 = sin tope en catálogo; ausente si el API es antiguo. */
  maxUsersPerOrg?: number
}

export async function fetchPlatformStats(): Promise<{ stats: PlatformStats }> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true (backend Express)')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/platform/stats`, { headers: authHeaders() })
  const data = (await r.json().catch(() => ({}))) as { stats?: PlatformStats; error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (!data.stats) throw new Error('Respuesta inválida de /api/platform/stats')
  return { stats: data.stats }
}

export async function fetchPlatformOrganizations(params?: {
  take?: number
  skip?: number
}): Promise<{
  take: number
  skip: number
  organizations: PlatformOrganizationRow[]
}> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const q = new URLSearchParams()
  if (params?.take != null) q.set('take', String(params.take))
  if (params?.skip != null) q.set('skip', String(params.skip))
  const url = `${base}/api/platform/organizations${q.toString() ? `?${q}` : ''}`
  const r = await fetch(url, { headers: authHeaders() })
  const data = (await r.json().catch(() => ({}))) as {
    organizations?: PlatformOrganizationRow[]
    take?: number
    skip?: number
    error?: string
  }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (!data.organizations) throw new Error('Respuesta inválida')
  return {
    take: data.take ?? 25,
    skip: data.skip ?? 0,
    organizations: data.organizations,
  }
}

export type PlatformUserRow = {
  id: string
  email: string
  displayName: string | null
  orgRole: string
  platformRole: string
  createdAt: string
  organization: { id: string; name: string; plan: string }
}

export type PlatformLlmCredentialsStatus = {
  gemini: {
    activeSource: 'database' | 'environment' | 'none'
    last4: string | null
    hasEnvFallback: boolean
  }
  databaseEncryptionReady: boolean
}

export async function fetchPlatformLlmCredentials(): Promise<PlatformLlmCredentialsStatus> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/platform/llm-credentials`, { headers: authHeaders() })
  const data = (await r.json().catch(() => ({}))) as PlatformLlmCredentialsStatus & { error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  return data as PlatformLlmCredentialsStatus
}

export async function putPlatformGeminiKey(apiKey: string): Promise<void> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/platform/llm-credentials/gemini`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  })
  const data = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
}

export async function deletePlatformGeminiKeyFromDb(): Promise<void> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/platform/llm-credentials/gemini`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  const data = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
}

export async function fetchPlatformUsers(params?: { take?: number; skip?: number }): Promise<{
  take: number
  skip: number
  total: number
  users: PlatformUserRow[]
}> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const q = new URLSearchParams()
  if (params?.take != null) q.set('take', String(params.take))
  if (params?.skip != null) q.set('skip', String(params.skip))
  const url = `${base}/api/platform/users${q.toString() ? `?${q}` : ''}`
  const r = await fetch(url, { headers: authHeaders() })
  const data = (await r.json().catch(() => ({}))) as {
    users?: PlatformUserRow[]
    take?: number
    skip?: number
    total?: number
    error?: string
  }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (!data.users) throw new Error('Respuesta inválida')
  return {
    take: data.take ?? 50,
    skip: data.skip ?? 0,
    total: data.total ?? data.users.length,
    users: data.users,
  }
}
