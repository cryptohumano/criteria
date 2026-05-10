import { getActiveLLMConfig } from '@/config/llmConfig'
import { llmProxyUsesServerKey } from '@/config/saasConfig'
import { readWorkspaceSession } from '@/services/workspace/sessionStorage'

/** El agente de documentos / guía puede llamar al LLM (clave propia o proxy con clave en servidor). */
export async function canUseLlmForAgent(): Promise<boolean> {
  const cfg = await getActiveLLMConfig()
  if (!cfg?.isActive) return false
  if (cfg.apiKey?.trim()) return true
  if (
    cfg.provider === 'gemini' &&
    cfg.proxyUrl?.trim() &&
    llmProxyUsesServerKey() &&
    readWorkspaceSession()?.accessToken
  ) {
    return true
  }
  return false
}
