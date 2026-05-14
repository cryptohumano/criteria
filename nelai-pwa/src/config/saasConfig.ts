/**
 * `true`: las peticiones van a rutas relativas `/api/...` (mismo origen).
 * En desarrollo, Vite puede reenviar al Express con `server.proxy` (ver `vite.config.ts`).
 * Evita CORS y "Failed to fetch" cuando el front es :5173 y el API :3456.
 */
export function apiUsesSameOrigin(): boolean {
  return import.meta.env.VITE_API_USE_SAME_ORIGIN === 'true'
}

/**
 * Hay backend configurado: URL explícita o modo mismo-origen (relativo).
 */
export function hasWorkspaceApiBase(): boolean {
  if (apiUsesSameOrigin()) return true
  return Boolean((import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim())
}

/**
 * URL del backend (Express), sin barra final, o cadena vacía si solo hay mismo-origen (rutas `/api/...` relativas).
 * Acepta `http://host:3456` o `http://host:3456/api` (se normaliza a host sin `/api` para no duplicar `/api/...` en las rutas).
 *
 * Si defines `VITE_API_BASE_URL` (p. ej. `http://localhost:3456`), **gana** sobre `VITE_API_USE_SAME_ORIGIN`:
 * así el front llama al API directo y no depende del proxy de Vite (evita 404 en `/api/billing/sync` cuando ambas vars están puestas).
 */
/**
 * Si abres Vite por IP de LAN (p. ej. 192.168.x.x:5173) pero `.env` tiene `localhost:3456`,
 * en el dispositivo `localhost` es el propio cliente → connection refused. En dev, alinea el host del API al de la página.
 */
function rewriteExplicitApiBaseForLanDev(base: string): string {
  if (typeof window === 'undefined' || !import.meta.env.DEV || !base) return base
  if (!/^https?:\/\//i.test(base)) return base
  try {
    const api = new URL(base)
    const pageHost = window.location.hostname
    const apiLoopback = api.hostname === 'localhost' || api.hostname === '127.0.0.1'
    const pageIsLan = pageHost !== 'localhost' && pageHost !== '127.0.0.1'
    if (apiLoopback && pageIsLan) {
      api.hostname = pageHost
      return `${api.protocol}//${api.host}`
    }
  } catch {
    /* ignore */
  }
  return base
}

export function getApiBaseUrl(): string {
  let u = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? ''
  u = u.replace(/\/+$/, '')
  u = u.replace(/\/api$/i, '')
  if (u) return rewriteExplicitApiBaseForLanDev(u)
  if (apiUsesSameOrigin()) {
    return ''
  }
  return ''
}

/**
 * URL absoluta para `fetch` hacia el API (evita rutas relativas mal resueltas desde subrutas de la SPA).
 * Mismo origen: `https://origen/api/...`; con `VITE_API_BASE_URL` absoluta: `https://api/...`.
 */
export function workspaceApiFetchUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = getApiBaseUrl().trim().replace(/\/$/, '')
  if (typeof window === 'undefined') {
    return base && /^https?:\/\//i.test(base) ? `${base}${p}` : p
  }
  if (base && /^https?:\/\//i.test(base)) {
    return `${base}${p}`
  }
  return new URL(p, window.location.origin).href
}

/**
 * Mensaje legible para fallos de red en `fetch` hacia el API.
 */
export function describeApiFetchError(e: unknown): string {
  if (!(e instanceof Error)) return 'Error de red desconocido'
  const m = e.message
  if (
    m === 'Failed to fetch' ||
    m === 'Load failed' ||
    m.startsWith('NetworkError') ||
    m.includes('Network request failed')
  ) {
    return 'No se pudo conectar con el API. Comprueba: proceso del servidor; VITE_API_BASE_URL; o en local VITE_API_USE_SAME_ORIGIN=true (Vite hace de proxy a VITE_API_PROXY_TARGET) para evitar CORS.'
  }
  return m
}

/**
 * Si es true, las llamadas Gemini vía proxy pueden omitir apiKey en cliente y
 * enviar Bearer de sesión; el servidor usa GEMINI_API_KEY.
 */
export function llmProxyUsesServerKey(): boolean {
  return import.meta.env.VITE_LLM_PROXY_USES_SERVER_KEY === 'true'
}
