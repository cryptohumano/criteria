/**
 * Orquestador de agentes CriterIA — Decide qué agente invocar según el contexto.
 * Corre íntegramente en la PWA, sin backend.
 */

export type AgentIntent = 'guide-before-action' | 'verify-content'

export interface OrchestratorContext {
  screen: string
  action?: string
  hasContent?: boolean
}

/**
 * Determina qué agente debe mostrarse según el contexto del usuario.
 */
export function getAgentForContext(context: OrchestratorContext): AgentIntent | null {
  const { screen, action } = context

  // Guía: antes de acciones sensibles
  if (
    action === 'publish-dkg' ||
    action === 'register-emergency-onchain' ||
    action === 'register-aviso-onchain' ||
    action === 'sign-document' ||
    action === 'sign-evidence'
  ) {
    return 'guide-before-action'
  }

  // Verificador: pantalla de verificación
  if (action === 'verify' || screen === 'verify' || (context.hasContent && screen === 'verify')) {
    return 'verify-content'
  }

  return null
}
