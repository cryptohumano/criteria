/**
 * Agente Guía — Servicio de explicación antes de acciones sensibles
 */

import type { GuideActionType } from '@/config/guideAgent'
import { GUIDE_TEMPLATES } from '@/config/guideAgentTemplates'
import { getActiveLLMConfig } from '@/config/llmConfig'
import { canUseLlmForAgent } from '@/utils/llmAvailability'
import { chatCompletion } from './llmClient'

export interface GuideContext {
  actionType: GuideActionType
  fieldsToPublish?: string[]
  hasGeolocation?: boolean
  hasPersonalData?: boolean
  /** Resumen legible de qué datos se subirán (ej: "tipo: médico, severidad: alta, incluye GPS") */
  payloadSummary?: string
}

export interface GuideResult {
  title: string
  content: string
  sections?: { heading: string; body: string }[]
}

/**
 * Obtiene el contenido explicativo para el Agente Guía (plantillas locales).
 */
export function getGuideContent(ctx: GuideContext): GuideResult {
  const template = GUIDE_TEMPLATES[ctx.actionType]
  if (!template) {
    return {
      title: 'Antes de continuar',
      content: 'Esta acción puede tener implicaciones de privacidad. Revisa qué datos se harán públicos.',
    }
  }
  return {
    title: template.title,
    content: template.content,
    sections: template.sections,
  }
}

const GUIDE_PROMPT_SYSTEM = `Eres un asistente de CriterIA que explica de forma breve y clara qué datos serán públicos o privados antes de que el usuario realice una acción sensible. Responde en español, en tono informativo y conciso. Usa formato markdown simple (negritas con **). Máximo 3-4 párrafos.`

// Caché simple para evitar llamadas redundantes en la misma sesión
const guideCache = new Map<string, GuideResult>()

function getCacheKey(ctx: GuideContext): string {
  return JSON.stringify({
    a: ctx.actionType,
    f: ctx.fieldsToPublish,
    g: ctx.hasGeolocation,
    p: ctx.hasPersonalData,
    s: ctx.payloadSummary,
  })
}

function buildGuidePrompt(ctx: GuideContext): string {
  const template = GUIDE_TEMPLATES[ctx.actionType]
  const base = template ? template.content : 'Acción sensible con implicaciones de privacidad.'
  const extras: string[] = []
  if (ctx.payloadSummary) extras.push(`Datos que se subirán: ${ctx.payloadSummary}`)
  if (ctx.fieldsToPublish?.length) extras.push(`Campos a publicar: ${ctx.fieldsToPublish.join(', ')}`)
  if (ctx.hasGeolocation) extras.push('Incluye ubicación GPS.')
  if (ctx.hasPersonalData) extras.push('Incluye datos personales.')
  const extra = extras.length ? `\n\nContexto adicional: ${extras.join(' ')}` : ''
  return `Contexto de la acción: ${base}${extra}\n\nGenera una explicación breve y clara para el usuario, manteniendo el mismo estilo y estructura.`
}

/**
 * Obtiene el contenido del Agente Guía usando LLM si hay API configurada.
 * Si no hay config o falla, devuelve las plantillas locales.
 */
export async function getGuideContentWithLLM(ctx: GuideContext): Promise<GuideResult> {
  const cacheKey = getCacheKey(ctx)
  if (guideCache.has(cacheKey)) {
    console.log('[GuideAgent] Usando respuesta cacheada para:', ctx.actionType)
    return guideCache.get(cacheKey)!
  }

  const config = await getActiveLLMConfig()
  if (!(await canUseLlmForAgent()) || !config) {
    return getGuideContent(ctx)
  }

  const template = GUIDE_TEMPLATES[ctx.actionType]
  const title = template?.title ?? 'Antes de continuar'

  const messages = [
    { role: 'system' as const, content: GUIDE_PROMPT_SYSTEM },
    { role: 'user' as const, content: buildGuidePrompt(ctx) },
  ]

  const res = await chatCompletion(config, messages, { maxTokens: 400, temperature: 0.5 })
  if (res.error || !res.content.trim()) {
    return getGuideContent(ctx)
  }

  const result: GuideResult = {
    title,
    content: res.content.trim(),
    sections: undefined,
  }

  guideCache.set(cacheKey, result)
  return result
}
