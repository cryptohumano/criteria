import packageJson from '../../package.json'

/**
 * Etiqueta de versión mostrada en la app (p. ej. landing / pie).
 * Opcional: `VITE_APP_RELEASE` en .env para forzar texto exacto (p. ej. `beta 2025-05`).
 */
export function getAppReleaseLabel(): string {
  const fromEnv = import.meta.env.VITE_APP_RELEASE?.trim()
  if (fromEnv) return fromEnv
  return `beta v${packageJson.version}`
}
