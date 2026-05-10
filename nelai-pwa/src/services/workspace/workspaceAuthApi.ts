import { getApiBaseUrl, hasWorkspaceApiBase, workspaceApiFetchUrl } from '@/config/saasConfig'
import type { OrganizationKind, WorkspaceSession, WorkspaceUser } from '@/types/workspace'

interface AuthSuccessBody {
  accessToken: string
  user: WorkspaceUser & { id: string }
  organization: WorkspaceSession['organization'] & { id: string; name: string; plan: string; kind?: OrganizationKind }
  error?: string
}

export function normalizeSession(data: AuthSuccessBody): WorkspaceSession {
  return {
    accessToken: data.accessToken,
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.displayName,
      orgRole: data.user.orgRole ?? 'owner',
      platformRole: data.user.platformRole ?? 'none',
    },
    organization: {
      id: data.organization.id,
      name: data.organization.name,
      plan: (data.organization.plan as WorkspaceSession['organization']['plan']) ?? 'trial',
      kind: data.organization.kind ?? 'team',
    },
  }
}

function demoSession(
  email: string,
  displayName: string,
  orgName: string,
  kind: OrganizationKind = 'team'
): WorkspaceSession {
  const slug = email.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return {
    accessToken: `demo.${btoa(unescape(encodeURIComponent(JSON.stringify({ email, exp: Date.now() + 864e5 }))))}`,
    user: {
      id: `user-${slug}`,
      email,
      displayName: displayName || email.split('@')[0] || 'Usuario',
      orgRole: 'owner',
      platformRole: 'none',
    },
    organization: {
      id: `org-${slug}`,
      name: orgName || 'Mi organización',
      plan: 'trial',
      kind,
    },
  }
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<WorkspaceSession> {
  if (!hasWorkspaceApiBase()) {
    if (password.length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres (modo demo).')
    }
    return demoSession(
      email.trim(),
      email.trim().split('@')[0] || 'Usuario',
      'Organización demo',
      'team'
    )
  }
  const base = getApiBaseUrl()

  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  })
  const data = (await res.json().catch(() => ({}))) as AuthSuccessBody
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`)
  }
  if (!data.accessToken || !data.user || !data.organization) {
    throw new Error('Respuesta de login inválida')
  }
  return normalizeSession(data)
}

export type RegisterWorkspaceInput = {
  email: string
  password: string
  displayName?: string
  /** Nombre de la empresa o equipo. Obligatorio si `accountKind` es `team` (B2B). */
  organizationName?: string
  /**
   * `team`: B2B (varios miembros posibles en el futuro). `personal`: B2C (un solo contenedor "personal").
   * Por defecto, si se envía `organizationName` no vacío, se trata como team.
   */
  accountKind?: 'team' | 'personal'
}

/** URL absoluta de callback OAuth (respeta `import.meta.env.BASE_URL`). */
export function buildGoogleOAuthReturnUrl(): string {
  const basePath = import.meta.env.BASE_URL || '/'
  const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`
  return new URL('auth/google/callback', `${window.location.origin}${prefix}`).href
}

/**
 * URL del API para iniciar OAuth Google (`return` validado en servidor con `AUTH_FRONTEND_ORIGIN`).
 * `null` si no hay backend configurado.
 */
export function getGoogleOAuthStartUrl(): string | null {
  if (!hasWorkspaceApiBase()) return null
  const returnUrl = buildGoogleOAuthReturnUrl()
  const base = getApiBaseUrl()
  const path = `/api/auth/google/start?return=${encodeURIComponent(returnUrl)}`
  if (base) return `${base}${path}`
  return path
}

/** Tras redirect OAuth: intercambia el token opaco por perfil vía `GET /api/auth/me`. */
export async function fetchWorkspaceSessionWithAccessToken(accessToken: string): Promise<WorkspaceSession> {
  if (!hasWorkspaceApiBase()) {
    throw new Error('No hay API configurada')
  }
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json().catch(() => ({}))) as {
    user?: AuthSuccessBody['user']
    organization?: AuthSuccessBody['organization']
    error?: string
  }
  if (!res.ok || !data.user || !data.organization) {
    throw new Error(data.error || `Error ${res.status} al validar sesión`)
  }
  return normalizeSession({
    accessToken,
    user: data.user,
    organization: data.organization,
  })
}

export type RegisterWorkspaceResult =
  | WorkspaceSession
  | { pendingVerification: true; email: string }

export async function registerWorkspace(input: RegisterWorkspaceInput): Promise<RegisterWorkspaceResult> {
  const { email, password, displayName, organizationName, accountKind } = input

  if (!hasWorkspaceApiBase()) {
    if (password.length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres (modo demo).')
    }
    const kind: OrganizationKind =
      accountKind === 'personal' ? 'personal' : 'team'
    const orgLabel =
      kind === 'team'
        ? (organizationName?.trim() || 'Nueva organización')
        : `Cuenta de ${displayName?.trim() || email.split('@')[0] || 'Usuario'}`
    return demoSession(
      email.trim(),
      displayName?.trim() || email.split('@')[0] || 'Usuario',
      orgLabel,
      kind
    )
  }
  const base = getApiBaseUrl()

  const body: Record<string, unknown> = {
    email: email.trim(),
    password,
  }
  if (displayName?.trim()) body.displayName = displayName.trim()
  if (organizationName?.trim()) body.organizationName = organizationName.trim()
  if (accountKind) body.accountKind = accountKind

  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as AuthSuccessBody & {
    pendingVerification?: boolean
    email?: string
  }
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`)
  }
  if (res.status === 201 && data.pendingVerification && data.email) {
    return { pendingVerification: true, email: data.email }
  }
  if (!data.accessToken || !data.user || !data.organization) {
    throw new Error('Respuesta de registro inválida')
  }
  return normalizeSession(data)
}

/** Elimina la cuenta del workspace en el servidor (organización si eres el único miembro). */
export async function deleteWorkspaceAccount(accessToken: string, password?: string): Promise<void> {
  if (!hasWorkspaceApiBase()) {
    throw new Error('No hay API configurada')
  }
  const body = JSON.stringify(password?.trim() ? { password: password.trim() } : {})
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  } as const

  const tryDelete = async (url: string, method: 'DELETE' | 'POST') =>
    fetch(url, { method, headers, body })

  let res = await tryDelete(workspaceApiFetchUrl('/api/auth/delete-account'), 'POST')
  if (res.status === 404) {
    res = await tryDelete(workspaceApiFetchUrl('/api/auth/me'), 'DELETE')
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        data.error ||
          'El servidor no expone la eliminación de cuenta (404). Reinicia el API con el código actual (yarn c2pa-server o dev:saas:all). Si usas `vite preview`, no hay proxy: define VITE_API_BASE_URL al host del API.'
      )
    }
    throw new Error(data.error || `Error ${res.status}`)
  }
}

/** Reenvía enlace mágico si el correo tiene registro pendiente de verificación. */
export async function resendVerificationEmail(email: string): Promise<void> {
  if (!hasWorkspaceApiBase()) return
  const base = getApiBaseUrl()
  const res = await fetch(`${base}/api/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`)
  }
}
