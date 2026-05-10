/**
 * Modo de aplicación: wallet-first (por defecto) vs espacio de trabajo B2B (SaaS).
 * En SaaS se exige sesión de organización antes del flujo de keyring local.
 */
export function isSaaSWorkspaceMode(): boolean {
  return import.meta.env.VITE_APP_MODE === 'saas'
}
