/// <reference types="vite/client" />

declare module 'vite/client' {
  interface ImportMetaEnv {
    readonly BASE_URL: string
    /** `saas` activa login de organización antes del keyring local */
    readonly VITE_APP_MODE?: string
    /** URL del backend Express (p. ej. http://localhost:3456) */
    readonly VITE_API_BASE_URL?: string
    /** `true` = peticiones a `/api/...` en el mismo origen (Vite hace de proxy en dev; ver VITE_API_PROXY_TARGET) */
    readonly VITE_API_USE_SAME_ORIGIN?: string
    /** Origen del API para el proxy de Vite (solo dev), p. ej. http://127.0.0.1:3456 */
    readonly VITE_API_PROXY_TARGET?: string
    /** `true`: Gemini vía proxy usa GEMINI_API_KEY en servidor + Bearer de sesión */
    readonly VITE_LLM_PROXY_USES_SERVER_KEY?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}
