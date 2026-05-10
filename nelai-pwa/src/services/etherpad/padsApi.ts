import { getApiBaseUrl, hasWorkspaceApiBase } from '@/config/saasConfig'
import { readWorkspaceSession } from '@/services/workspace/sessionStorage'

function authHeaders(): HeadersInit {
  const t = readWorkspaceSession()?.accessToken
  if (!t) throw new Error('No hay sesión de plataforma')
  return { Authorization: `Bearer ${t}` }
}

export type PadSessionResponse = {
  padId: string
  padUrl: string
  expiresAt: string | null
}

export type PadContentResponse = {
  padId: string
  format: 'text'
  content: string
}

export type RedactionRow = {
  id: string
  placeholder: string
  createdAt: string
}

export async function listRedactions(docId: string): Promise<{ redactions: RedactionRow[] }> {
  if (!hasWorkspaceApiBase()) {
    throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true (backend Express)')
  }
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/docs/${encodeURIComponent(docId)}/redactions`, {
    headers: { ...authHeaders() },
    credentials: 'include',
  })
  const data = (await r.json().catch(() => ({}))) as { redactions?: RedactionRow[]; error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  return { redactions: Array.isArray(data.redactions) ? data.redactions : [] }
}

export async function createRedaction(
  docId: string,
  input: { placeholder: string; original: string },
): Promise<{ ok: boolean; redaction: RedactionRow }> {
  if (!hasWorkspaceApiBase()) {
    throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true (backend Express)')
  }
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/docs/${encodeURIComponent(docId)}/redactions`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  const raw = await r.text().catch(() => '')
  const data = (() => {
    try {
      return raw
        ? (JSON.parse(raw) as { ok?: boolean; redaction?: RedactionRow; error?: string })
        : ({} as { ok?: boolean; redaction?: RedactionRow; error?: string })
    } catch {
      return {} as { ok?: boolean; redaction?: RedactionRow; error?: string }
    }
  })()
  if (!r.ok) throw new Error(data.error || raw || `Error ${r.status}`)
  if (!data.ok || !data.redaction) throw new Error('Respuesta inválida de redactions (create)')
  return { ok: true, redaction: data.redaction }
}

export async function restoreRedaction(
  docId: string,
  redactionId: string,
): Promise<{ ok: boolean; restored: { id: string; placeholder: string; original: string } }> {
  if (!hasWorkspaceApiBase()) {
    throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true (backend Express)')
  }
  const base = getApiBaseUrl()
  const r = await fetch(
    `${base}/api/docs/${encodeURIComponent(docId)}/redactions/${encodeURIComponent(redactionId)}/restore`,
    {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    },
  )
  const raw = await r.text().catch(() => '')
  const data = (() => {
    try {
      return raw
        ? (JSON.parse(raw) as { ok?: boolean; restored?: { id: string; placeholder: string; original: string }; error?: string })
        : ({} as { ok?: boolean; restored?: { id: string; placeholder: string; original: string }; error?: string })
    } catch {
      return {} as { ok?: boolean; restored?: { id: string; placeholder: string; original: string }; error?: string }
    }
  })()
  if (!r.ok) throw new Error(data.error || raw || `Error ${r.status}`)
  if (!data.ok || !data.restored) throw new Error('Respuesta inválida de redactions (restore)')
  return { ok: true, restored: data.restored }
}

export async function createOrGetPadSession(docId: string): Promise<PadSessionResponse> {
  if (!hasWorkspaceApiBase()) {
    throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true (backend Express)')
  }
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/docs/${encodeURIComponent(docId)}/pad/session`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  })
  const data = (await r.json().catch(() => ({}))) as PadSessionResponse & { error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (!data.padUrl || !data.padId) throw new Error('Respuesta inválida de pad/session')
  return data
}

export async function fetchPadText(docId: string): Promise<PadContentResponse> {
  if (!hasWorkspaceApiBase()) {
    throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true (backend Express)')
  }
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/docs/${encodeURIComponent(docId)}/pad/content?format=text`, {
    headers: { ...authHeaders() },
    credentials: 'include',
  })
  const data = (await r.json().catch(() => ({}))) as PadContentResponse & { error?: string }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`)
  if (typeof data.content !== 'string') throw new Error('Respuesta inválida de pad/content')
  return data
}

export async function setPadText(docId: string, text: string): Promise<{ ok: boolean; padId: string }> {
  if (!hasWorkspaceApiBase()) {
    throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true (backend Express)')
  }
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/docs/${encodeURIComponent(docId)}/pad/set-text`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text }),
  })
  // Si el backend/proxy devuelve un 502 sin body JSON, `r.json()` revienta con "Unexpected end...".
  // Leemos texto primero y tratamos de parsear.
  const raw = await r.text().catch(() => '')
  const data = (() => {
    try {
      return raw ? (JSON.parse(raw) as { ok?: boolean; padId?: string; error?: string }) : {}
    } catch {
      return {}
    }
  })()
  if (!r.ok) throw new Error(data.error || raw || `Error ${r.status}`)
  if (!data.ok || typeof data.padId !== 'string') throw new Error('Respuesta inválida de pad/set-text')
  return { ok: true, padId: data.padId }
}

export async function exportPadMarkdown(docId: string): Promise<Blob> {
  if (!hasWorkspaceApiBase()) {
    throw new Error('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true (backend Express)')
  }
  const base = getApiBaseUrl()
  const r = await fetch(`${base}/api/docs/${encodeURIComponent(docId)}/pad/export/markdown`, {
    headers: { ...authHeaders() },
    credentials: 'include',
  })
  if (!r.ok) {
    const raw = await r.text().catch(() => '')
    try {
      const j = raw ? (JSON.parse(raw) as { error?: string }) : {}
      throw new Error(j.error || raw || `Error ${r.status}`)
    } catch {
      throw new Error(raw || `Error ${r.status}`)
    }
  }
  return await r.blob()
}

