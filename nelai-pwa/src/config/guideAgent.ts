/**
 * Configuración del Agente Guía (CriterIA)
 */

export type GuideActionType =
  | 'publish-dkg'
  | 'register-emergency-onchain'
  | 'register-aviso-onchain'
  | 'sign-document'
  | 'sign-evidence'

export const GUIDE_AGENT_CONFIG = {
  /** Mostrar el modal de guía antes de acciones sensibles */
  enabled: true,
  /** Tipos de acción donde se muestra (emergencias excluidas: prioridad velocidad) */
  enabledActions: [
    'publish-dkg',
    'register-aviso-onchain',
    'sign-document',
  ] as GuideActionType[],
  /** Recordar "no volver a mostrar" por acción (localStorage) */
  rememberDismissed: true,
  /** Clave base localStorage para dismissed */
  dismissedStorageKey: 'criteria-guide-dismissed',
}

const LEGACY_DISMISSED_STORAGE_KEY = 'nelai-guide-dismissed'

export function isGuideDismissed(actionType: GuideActionType): boolean {
  if (!GUIDE_AGENT_CONFIG.rememberDismissed) return false
  return (
    localStorage.getItem(`${GUIDE_AGENT_CONFIG.dismissedStorageKey}-${actionType}`) === 'true' ||
    localStorage.getItem(`${LEGACY_DISMISSED_STORAGE_KEY}-${actionType}`) === 'true'
  )
}

export function setGuideDismissed(actionType: GuideActionType): void {
  if (GUIDE_AGENT_CONFIG.rememberDismissed) {
    localStorage.setItem(`${GUIDE_AGENT_CONFIG.dismissedStorageKey}-${actionType}`, 'true')
    localStorage.removeItem(`${LEGACY_DISMISSED_STORAGE_KEY}-${actionType}`)
  }
}
