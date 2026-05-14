/**
 * Cliente LLM para agentes CriterIA — OpenAI, Anthropic y Gemini
 */

import type { LLMApiConfig } from '@/config/llmConfig'
import { llmProxyUsesServerKey } from '@/config/saasConfig'
import { readWorkspaceSession } from '@/services/workspace/sessionStorage'

export interface ChatMessageAttachment {
  mimeType: string
  data: string // base64
  fileName?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  /** Adjuntos (PDF, imágenes). Solo Gemini los procesa nativamente. */
  attachments?: ChatMessageAttachment[]
}

export interface LLMResponse {
  content: string
  error?: string
  /** true si la respuesta se cortó por límite de tokens */
  truncated?: boolean
  /** Solo Gemini (google_search): fuentes usadas para grounding */
  citations?: Array<{ url: string; title?: string }>
}

function extractGeminiCitations(payload: unknown): Array<{ url: string; title?: string }> {
  if (!payload || typeof payload !== 'object') return []
  const p = payload as any
  const out: Array<{ url: string; title?: string }> = []
  const seen = new Set<string>()

  // Estructuras típicas (varían por versión/modelo):
  // - candidates[0].groundingMetadata.groundingChunks[].web.{uri,title}
  // - candidates[0].groundingMetadata.webSearchQueries / groundingSupports (ignoramos)
  const chunks = p?.candidates?.[0]?.groundingMetadata?.groundingChunks
  if (Array.isArray(chunks)) {
    for (const ch of chunks) {
      const uri =
        (typeof ch?.web?.uri === 'string' && ch.web.uri) ||
        (typeof ch?.retrievedContext?.uri === 'string' && ch.retrievedContext.uri) ||
        (typeof ch?.uri === 'string' && ch.uri) ||
        (typeof ch?.url === 'string' && ch.url) ||
        ''
      if (!uri) continue
      if (seen.has(uri)) continue
      seen.add(uri)
      const title =
        (typeof ch?.web?.title === 'string' && ch.web.title) ||
        (typeof ch?.retrievedContext?.title === 'string' && ch.retrievedContext.title) ||
        (typeof ch?.title === 'string' && ch.title) ||
        undefined
      out.push({ url: uri, ...(title ? { title } : {}) })
    }
  }

  // Algunas respuestas incluyen citationMetadata; intentamos extraer URLs si están presentes.
  const cmeta = p?.candidates?.[0]?.citationMetadata?.citations
  if (Array.isArray(cmeta)) {
    for (const c of cmeta) {
      const uri = c?.uri || c?.url
      if (typeof uri !== 'string' || !uri) continue
      if (seen.has(uri)) continue
      seen.add(uri)
      const title = typeof c?.title === 'string' ? c.title : undefined
      out.push({ url: uri, title })
    }
  }

  return out.slice(0, 24)
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone?: (truncated?: boolean) => void
}

/**
 * 429: Gemini limita por RPM (requests/min), TPM, RPD.
 * No reintentar agresivamente: cada retry cuenta contra el límite.
 * Ver https://ai.google.dev/gemini-api/docs/rate-limits
 */
const RETRY_DELAY_MS = 60_000 // 1 min para RPM
const MAX_RETRIES_429 = 1

/** Reintentos para errores de red transitorios (ERR_HTTP2_PROTOCOL_ERROR, Failed to fetch) */
const MAX_RETRIES_NETWORK = 2
const NETWORK_RETRY_DELAY_MS = 3000

import { v4 as uuidv4 } from 'uuid'


/** Contador de solicitudes por sesión (para depuración de límites) */
let sessionRequestCount = 0

/** Bloqueo global si recibimos 429 para evitar spam */
let globalCooldownUntil = 0

/**
 * Sanitiza un valor para usarlo en cabeceras HTTP.
 */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[^\u0000-\u00FF]/g, '').trim()
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries429 = MAX_RETRIES_429,
  retriesNetwork = MAX_RETRIES_NETWORK,
  isRetry = false
): Promise<Response> {
  // Obtener o generar el ID de rastreo
  const headers = new Headers(init.headers)
  let requestId = headers.get('X-Request-ID')
  
  if (!requestId) {
    requestId = uuidv4()
    headers.set('X-Request-ID', requestId)
    init.headers = headers
  }

  const now = Date.now()
  // No bloquear si es un reintento (ya esperamos el delay)
  if (!isRetry && now < globalCooldownUntil) {
    const waitSecs = Math.ceil((globalCooldownUntil - now) / 1000)
    console.warn(`[LLM] [${requestId}] Solicitud bloqueada por enfriamiento (espera ${waitSecs}s)`)
    return new Response(JSON.stringify({ error: `Demasiadas solicitudes. Reintentando en ${waitSecs}s...` }), {
      status: 429,
      statusText: 'Too Many Requests (Local Cooldown)',
      headers: { 'Content-Type': 'application/json' }
    })
  }

  sessionRequestCount += 1
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (err) {
    if (retriesNetwork > 0 && (err instanceof TypeError || err instanceof Error)) {
      console.warn(`[LLM] [${requestId}] Error de red (${err instanceof Error ? err.message : 'Failed to fetch'}). Reintentando en ${NETWORK_RETRY_DELAY_MS / 1000}s (${retriesNetwork} restantes)`)
      await new Promise((r) => setTimeout(r, NETWORK_RETRY_DELAY_MS))
      return fetchWithRetry(url, init, retries429, retriesNetwork - 1, true)
    }
    throw err
  }
  
  console.log(`[LLM] [${requestId}] Solicitud #${sessionRequestCount} → ${res.status} ${res.ok ? '✓' : '✗'} (${url.slice(0, 80)}${url.length > 80 ? '...' : ''})`)

  if (res.status === 429) {
    // Si es 429, activamos enfriamiento global de 60s
    globalCooldownUntil = Date.now() + 60_000
  }

  if (res.status !== 429 || retries429 <= 0) return res
  const retryAfter = res.headers.get('Retry-After')
  const parsed = parseInt(retryAfter || '', 10)
  // Gemini suele pedir 60s para RPM. Si no hay Retry-After, usamos el default.
  const delayMs = retryAfter && !isNaN(parsed) ? Math.min(parsed * 1000, 120_000) : RETRY_DELAY_MS
  console.warn(`[LLM] [${requestId}] 429 Rate limit. Esperando ${delayMs / 1000}s antes de reintentar (${retries429} restantes)`)
  await new Promise((r) => setTimeout(r, delayMs))
  return fetchWithRetry(url, init, retries429 - 1, retriesNetwork, true)
}

export interface ChatCompletionOptions {
  maxTokens?: number
  temperature?: number
  /** Solo Gemini: habilita Google Search (grounding). Si falla, fallback sin búsqueda. */
  googleSearch?: boolean
}

/**
 * Llama a la API de chat. Soporta OpenAI, Anthropic y Gemini.
 * Los adjuntos (PDF, imágenes) solo funcionan con Gemini.
 */
export async function chatCompletion(
  config: LLMApiConfig,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<LLMResponse> {
  const requestId = uuidv4()
  console.log(`[LLM] [${requestId}] 🚀 chatCompletion: ${config.provider}/${config.model} (${messages.length} msgs)`)

  const hasAttachments = messages.some((m) => m.attachments?.length)
  if (hasAttachments && config.provider !== 'gemini') {
    return {
      content: '',
      error: 'El análisis de archivos (PDF, imágenes) solo está disponible con Gemini. Cambia el proveedor en Configuración > IA (LLM).',
    }
  }

  try {
    let result: LLMResponse
    if (config.provider === 'anthropic') {
      result = await anthropicChat(config, messages, options)
    } else if (config.provider === 'gemini') {
      // Pass requestId to geminiChat
      result = await geminiChat(config, messages, options, requestId)
    } else {
      result = await openAIChat(config, messages, options)
    }

    if (result.error) {
      console.warn(`[LLM] [${requestId}] ⚠️ Respuesta con error: ${result.error}`)
    } else {
      console.log(`[LLM] [${requestId}] ✅ Respuesta recibida satisfactoriamente`)
    }
    return result
  } catch (error: any) {
    console.error(`[LLM] [${requestId}] ❌ Error en chatCompletion:`, error)
    throw error
  }
}

/**
 * Chat con streaming (modo agente). Solo Gemini por ahora.
 * Muestra la respuesta progresivamente y detecta truncación.
 */
export async function chatCompletionStream(
  config: LLMApiConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: ChatCompletionOptions
): Promise<{ content: string; error?: string; truncated?: boolean }> {
  if (config.provider === 'gemini' && config.proxyUrl) {
    // Con proxy no hay streaming; usar chatCompletion y simular
    const res = await chatCompletion(config, messages, options)
    if (res.error) return res
    callbacks.onChunk(res.content)
    callbacks.onDone?.(res.truncated)
    return res
  }
  if (config.provider === 'gemini') {
    return geminiChatStream(config, messages, callbacks, options)
  }
  // Fallback: llamada normal y simular streaming con el contenido completo
  const res = await chatCompletion(config, messages, options)
  if (res.error) return res
  callbacks.onChunk(res.content)
  callbacks.onDone?.(res.truncated)
  return res
}

async function openAIChat(
  config: LLMApiConfig,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<LLMResponse> {
  if (!config.apiKey?.trim()) {
    return { content: '', error: 'Falta API key de OpenAI' }
  }
  const baseUrl = config.endpoint?.trim() || 'https://api.openai.com/v1'
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`

  const body = {
    model: config.model || 'gpt-4o-mini',
    messages,
    max_tokens: options?.maxTokens ?? 2048,
    temperature: options?.temperature ?? 0.7,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sanitizeHeaderValue(config.apiKey)}`,
  }

  try {
    const res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const text = await res.text()
      return { content: '', error: `API error ${res.status}: ${text.slice(0, 200)}` }
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    return content ? { content } : { content: '', error: 'Formato de respuesta no reconocido' }
  } catch (err) {
    console.error('[LLM] Error:', err)
    return { content: '', error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}

async function anthropicChat(
  config: LLMApiConfig,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<LLMResponse> {
  if (!config.apiKey?.trim()) {
    return { content: '', error: 'Falta API key de Anthropic' }
  }
  const baseUrl = config.endpoint?.trim() || 'https://api.anthropic.com'
  const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`

  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMsgs = messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model: config.model || 'claude-3-5-haiku-20241022',
    max_tokens: options?.maxTokens ?? 2048,
    messages: chatMsgs.map((m) => ({ role: m.role, content: m.content })),
  }
  if (systemMsg) body.system = systemMsg.content
  if (options?.temperature != null) body.temperature = options.temperature

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': sanitizeHeaderValue(config.apiKey),
    'anthropic-version': '2023-06-01',
  }

  try {
    const res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const text = await res.text()
      return { content: '', error: `API error ${res.status}: ${text.slice(0, 200)}` }
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> }
    const content = data.content?.[0]?.text
    return content ? { content } : { content: '', error: 'Formato de respuesta no reconocido' }
  } catch (err) {
    console.error('[LLM] Error:', err)
    return { content: '', error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}

function sanitizeModelName(model: string): string {
  // Ya no corregimos gemini-3 porque es una versión válida de frontera
  return model.toLowerCase().trim()
}

async function geminiChat(
  config: LLMApiConfig,
  messages: ChatMessage[],
  options?: ChatCompletionOptions,
  requestId?: string
): Promise<LLMResponse> {
  const useGoogleSearch = options?.googleSearch === true
  const model = sanitizeModelName(config.model || 'gemini-2.5-flash')
  const proxyUrl = config.proxyUrl?.trim()
  const workspaceToken = readWorkspaceSession()?.accessToken
  const geminiServerProxy =
    !!proxyUrl &&
    llmProxyUsesServerKey() &&
    !String(config.apiKey || '').trim() &&
    !!workspaceToken

  if (proxyUrl && !String(config.apiKey || '').trim() && !geminiServerProxy) {
    return {
      content: '',
      error:
        'Para Gemini vía proxy sin API key en el dispositivo: inicia sesión, activa VITE_LLM_PROXY_USES_SERVER_KEY y asegúrate de que el superadmin haya configurado la clave de Google en plataforma (o GEMINI_API_KEY en el servidor).',
    }
  }
  if (!proxyUrl && !String(config.apiKey || '').trim()) {
    return { content: '', error: 'Falta API key de Gemini' }
  }

  if (requestId) {
    console.debug(
      `[LLM] [${requestId}] Procesando solicitud Gemini vía ${proxyUrl ? (geminiServerProxy ? 'Proxy (clave servidor)' : 'Proxy') : 'Directo'}`
    )
  }

  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMsgs = messages.filter((m) => m.role !== 'system')

  const contents = chatMsgs.map((m) => {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
    if (m.content) parts.push({ text: m.content })
    if (m.attachments?.length) {
      for (const att of m.attachments) {
        parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } })
      }
    }
    if (parts.length === 0) parts.push({ text: '(archivo adjunto)' })
    return { role: m.role === 'assistant' ? 'model' : 'user', parts }
  })

  const buildBody = (withTools: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 2048,
        temperature: options?.temperature ?? 0.7,
      },
    }
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] }
    }
    if (withTools) {
      body.tools = [{ google_search: {} }]
    }
    return body
  }

  const doRequest = (withTools: boolean) => {
    const body = buildBody(withTools)
    if (proxyUrl) {
      // Usar proxy para evitar CORS (la API de Gemini no soporta CORS desde navegador)
      const url = proxyUrl.replace(/\/$/, '')
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (requestId) headers['X-Request-ID'] = requestId
      const payload: Record<string, unknown> = { model, body }
      if (geminiServerProxy && workspaceToken) {
        payload.useServerKey = true
        headers.Authorization = `Bearer ${workspaceToken}`
      } else {
        payload.apiKey = String(config.apiKey || '')
      }
      return fetchWithRetry(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
    }
    const baseUrl = config.endpoint?.trim() || 'https://generativelanguage.googleapis.com/v1beta'
    const url = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent`
    return fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': sanitizeHeaderValue(config.apiKey),
      },
      body: JSON.stringify(body),
    })
  }

  try {
    let res = useGoogleSearch ? await doRequest(true) : await doRequest(false)

    // Si falló con google_search (400, 403, etc.), reintentar sin tools.
    // IMPORTANTE: Si es 429 (Rate Limit) o 401 (Auth), NO reintentar, ya que fallará igual
    // y solo consumirá más cuota o activará más enfriamientos.
    if (!res.ok && useGoogleSearch && res.status !== 429 && res.status !== 401) {
      console.warn(`[LLM] [${requestId || 'gen'}] Google Search no disponible (status ${res.status}), usando modo estándar`)
      res = await doRequest(false)
    }

    if (!res.ok) {
      const text = await res.text()
      const errorMsg = `API error ${res.status}: ${text.slice(0, 200)}`
      if (requestId) {
        console.error(`[LLM] [${requestId}] ${errorMsg}`)
      }
      return { content: '', error: errorMsg }
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        finishReason?: string
      }>
    }
    const candidate = data.candidates?.[0]
    const text = candidate?.content?.parts?.[0]?.text
    const truncated = candidate?.finishReason === 'MAX_TOKENS'
    /** Siempre extraer grounding/citationMetadata si vienen en el JSON (p. ej. tras fallback sin tools). */
    const citations = extractGeminiCitations(data)
    return text
      ? { content: text, truncated, citations: citations.length ? citations : undefined }
      : { content: '', error: 'Formato de respuesta no reconocido' }
  } catch (err) {
    console.error('[LLM] Error en geminiChat:', err)
    return { content: '', error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}

async function geminiChatStream(
  config: LLMApiConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: ChatCompletionOptions
): Promise<{ content: string; error?: string; truncated?: boolean }> {
  if (!config.apiKey?.trim()) {
    return { content: '', error: 'Streaming directo a Gemini requiere API key en el cliente' }
  }
  const baseUrl = config.endpoint?.trim() || 'https://generativelanguage.googleapis.com/v1beta'
  const model = config.model || 'gemini-2.5-flash'
  const url = `${baseUrl.replace(/\/$/, '')}/models/${model}:streamGenerateContent`

  const systemMsg = messages.find((m) => m.role === 'system')
  const chatMsgs = messages.filter((m) => m.role !== 'system')

  const contents = chatMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
    },
  }
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] }
  }
  if (options?.googleSearch) {
    body.tools = [{ google_search: {} }]
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-goog-api-key': sanitizeHeaderValue(config.apiKey),
  }

  try {
    let res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok && options?.googleSearch) {
      delete body.tools
      res = await fetchWithRetry(url, { method: 'POST', headers, body: JSON.stringify(body) })
    }
    if (!res.ok) {
      const text = await res.text()
      return { content: '', error: `API error ${res.status}: ${text.slice(0, 200)}` }
    }

    const reader = res.body?.getReader()
    if (!reader) return { content: '', error: 'Stream no disponible' }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    let truncated = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]' || trimmed === 'data:') continue
        const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
        try {
          const json = JSON.parse(jsonStr) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> }
              finishReason?: string
            }>
          }
          const candidate = json.candidates?.[0]
          const text = candidate?.content?.parts?.[0]?.text
          if (text) {
            fullContent += text
            callbacks.onChunk(text)
          }
          if (candidate?.finishReason === 'MAX_TOKENS') truncated = true
        } catch {
          // Ignorar líneas JSON inválidas
        }
      }
    }

    callbacks.onDone?.(truncated)
    return { content: fullContent, truncated }
  } catch (err) {
    console.error('[LLM] Stream error:', err)
    return { content: '', error: err instanceof Error ? err.message : 'Error de conexión' }
  }
}
