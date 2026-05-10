/**
 * Configuración de API Keys para LLM (IA) en CriterIA
 */

export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'custom'

export interface LLMApiConfig {
  id: string
  provider: LLMProvider
  name: string
  /** Opcional si usas proxy Gemini con clave en servidor (VITE_LLM_PROXY_USES_SERVER_KEY + sesión). */
  apiKey?: string
  endpoint?: string
  /** URL del proxy para Gemini (evita CORS desde navegador). Ej: https://tu-servidor.com/api/llm-proxy */
  proxyUrl?: string
  model?: string
  isActive: boolean
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'criteria-llm-configs'
const LEGACY_STORAGE_KEY = 'nelai-llm-configs'

const DEFAULT_ENDPOINTS: Record<LLMProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  custom: '',
}

export function getDefaultEndpoint(provider: LLMProvider): string {
  return DEFAULT_ENDPOINTS[provider] || ''
}

export async function getAllLLMConfigs(): Promise<LLMApiConfig[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LLMApiConfig[]
    // Migración: si viene de Nelai, persistir con la clave nueva.
    if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, raw)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function getActiveLLMConfig(): Promise<LLMApiConfig | null> {
  const configs = await getAllLLMConfigs()
  return configs.find((c) => c.isActive) ?? null
}

export async function saveLLMConfig(config: LLMApiConfig): Promise<void> {
  const configs = await getAllLLMConfigs()
  const exists = configs.findIndex((c) => c.id === config.id)
  const now = Date.now()
  const toSave = { ...config, updatedAt: now }

  if (exists >= 0) {
    configs[exists] = toSave
  } else {
    toSave.createdAt = now
    configs.push(toSave)
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

export async function deleteLLMConfig(id: string): Promise<void> {
  const configs = await getAllLLMConfigs()
  const filtered = configs.filter((c) => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
}

export async function setActiveLLMConfig(id: string): Promise<void> {
  const configs = await getAllLLMConfigs()
  const updated = configs.map((c) => ({
    ...c,
    isActive: c.id === id,
    updatedAt: Date.now(),
  }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}
