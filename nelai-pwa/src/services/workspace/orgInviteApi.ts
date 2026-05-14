import { getApiBaseUrl, hasWorkspaceApiBase } from '@/config/saasConfig'
import { readWorkspaceSession } from '@/services/workspace/sessionStorage'

function authHeaders(): HeadersInit {
  const t = readWorkspaceSession()?.accessToken
  if (!t) throw new Error('No hay sesión de plataforma')
  return { Authorization: `Bearer ${t}` }
}

export type InvitePreview = {
  organizationName: string
  organizationKind: string
  expiresAt: string
  role: string
}

export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/org/invite-preview?token=${encodeURIComponent(token)}`)
  const data = (await r.json().catch(() => ({}))) as InvitePreview & { error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  return data as InvitePreview
}

/** Aceptar invitación estando ya logueado (p. ej. abriste `/register?invite=…` con sesión activa). */
export async function acceptOrgInviteWithSession(rawToken: string): Promise<void> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const t = rawToken.trim()
  if (!t) throw new Error('Token de invitación vacío')
  const r = await fetch(`${base}/api/org/invite/accept`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token: t }),
  })
  const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
}

export async function createOrgInvite(): Promise<{ joinUrl: string; expiresAt: string; token: string }> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/org/invites`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  })
  const data = (await r.json().catch(() => ({}))) as {
    joinUrl?: string
    expiresAt?: string
    token?: string
    error?: string
  }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (!data.joinUrl || !data.expiresAt || !data.token) throw new Error('Respuesta inválida')
  return { joinUrl: data.joinUrl, expiresAt: data.expiresAt, token: data.token }
}

export type OrgMemberRow = {
  id: string
  email: string
  displayName: string | null
  orgRole: string
  createdAt: string
  /** Tokens de IA (periodo actual del plan); 0 si el servidor no envía el campo. */
  llmTokensThisPeriod?: number
}

export type FetchOrgMembersResult = {
  members: OrgMemberRow[]
  unattributedLlmTokensThisPeriod: number
}

export async function fetchOrgMembers(): Promise<FetchOrgMembersResult> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/org/members`, {
    headers: { ...authHeaders() },
    credentials: 'include',
  })
  const data = (await r.json().catch(() => ({}))) as {
    members?: OrgMemberRow[]
    unattributedLlmTokensThisPeriod?: unknown
    error?: string
  }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (!Array.isArray(data.members)) throw new Error('Respuesta inválida de miembros')
  const rawUn = data.unattributedLlmTokensThisPeriod
  const unattributedLlmTokensThisPeriod =
    typeof rawUn === 'number' && Number.isFinite(rawUn) ? Math.max(0, Math.floor(rawUn)) : 0
  const members = data.members.map((m) => ({
    ...m,
    llmTokensThisPeriod:
      typeof m.llmTokensThisPeriod === 'number' && Number.isFinite(m.llmTokensThisPeriod)
        ? Math.max(0, Math.floor(m.llmTokensThisPeriod))
        : 0,
  }))
  return { members, unattributedLlmTokensThisPeriod }
}

export async function removeOrgMember(userId: string): Promise<void> {
  if (!hasWorkspaceApiBase()) throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true')
  const base = getApiBaseUrl()
  const id = userId.trim()
  if (!id) throw new Error('Usuario inválido')
  const r = await fetch(`${base}/api/org/members/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
    credentials: 'include',
  })
  const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
}
