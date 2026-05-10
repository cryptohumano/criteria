/**
 * Crea/actualiza en el dispositivo un perfil Gemini que usa el proxy y la clave del servidor
 * (superadmin / GEMINI_API_KEY), sin BYOK. Id estable para no duplicar.
 */
import { isSaaSWorkspaceMode } from './appMode'
import { getApiBaseUrl, hasWorkspaceApiBase, llmProxyUsesServerKey } from './saasConfig'
import { getAllLLMConfigs, saveLLMConfig, setActiveLLMConfig, type LLMApiConfig } from './llmConfig'

const PLATFORM_GEMINI_ID = 'criteria-saas-platform-gemini'
const LEGACY_PLATFORM_GEMINI_ID = 'nelai-saas-platform-gemini'

export function getPlatformGeminiConfigId(): string {
  return PLATFORM_GEMINI_ID
}

/**
 * En modo SaaS + proxy con clave de servidor, asegura un perfil listo para quienes no usan BYOK.
 * Si el usuario no tiene ninguna config activa, activa el perfil de plataforma.
 */
export async function ensureSaaSPlatformGeminiConfig(): Promise<void> {
  if (!isSaaSWorkspaceMode() || !llmProxyUsesServerKey()) return
  if (!hasWorkspaceApiBase()) return
  const base = getApiBaseUrl()

  const proxyUrl = `${base}/api/llm-proxy`
  const configs = await getAllLLMConfigs()
  const existing = configs.find((c) => c.id === PLATFORM_GEMINI_ID) ?? configs.find((c) => c.id === LEGACY_PLATFORM_GEMINI_ID)
  const now = Date.now()

  if (existing) {
    const needsUpdate =
      existing.proxyUrl !== proxyUrl ||
      existing.name !== 'CriterIA (plataforma)' ||
      !existing.model
    if (needsUpdate) {
      await saveLLMConfig({
        ...existing,
        id: PLATFORM_GEMINI_ID,
        name: 'CriterIA (plataforma)',
        proxyUrl,
        model: existing.model || 'gemini-2.5-flash',
        updatedAt: now,
      })
    }
    if (!configs.some((c) => c.isActive)) {
      await setActiveLLMConfig(PLATFORM_GEMINI_ID)
    }
    return
  }

  const hasActive = configs.some((c) => c.isActive)
  const newCfg: LLMApiConfig = {
    id: PLATFORM_GEMINI_ID,
    provider: 'gemini',
    name: 'CriterIA (plataforma)',
    apiKey: undefined,
    proxyUrl,
    model: 'gemini-2.5-flash',
    isActive: !hasActive,
    createdAt: now,
    updatedAt: now,
  }
  await saveLLMConfig(newCfg)
  if (!hasActive) {
    await setActiveLLMConfig(PLATFORM_GEMINI_ID)
  }
}
