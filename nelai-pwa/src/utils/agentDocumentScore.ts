/**
 * Bloque [SCORE_LEGAL]…[/SCORE_LEGAL] en respuestas del agente (legal y académico comparten el mismo formato de API).
 */

export interface AgentDocumentScore {
  score: number
  level: string
  summary: string
  risks: string[]
}

const SCORE_BLOCK_RE = /\[SCORE_LEGAL\]([\s\S]*?)\[\/SCORE_LEGAL\]/gi

export function stripAndParseDocumentScore(assistantText: string): {
  score: AgentDocumentScore | null
  cleanText: string
} {
  const scoreRegex = /\[SCORE_LEGAL\]([\s\S]*?)\[\/SCORE_LEGAL\]/i
  const match = scoreRegex.exec(assistantText)
  if (!match) {
    return { score: null, cleanText: assistantText.trim() }
  }
  const block = match[1] || ''
  const scoreNum = /puntuaci[oó]n:\s*(\d+)/i.exec(block)
  const levelStrict = /nivel:\s*(ALTO|MEDIO|BAJO)/i.exec(block)
  const levelLoose = /nivel:\s*([^\n\r]+)/i.exec(block)
  const summary = /resumen:\s*(.+)/i.exec(block)
  const risks = /riesgos:\s*(.+)/i.exec(block)
  const level = (levelStrict?.[1] || levelLoose?.[1] || '').trim()
  if (!scoreNum || !level) {
    const cleanText = assistantText.replace(SCORE_BLOCK_RE, '').trim()
    return { score: null, cleanText }
  }
  const score = Math.max(0, Math.min(100, parseInt(scoreNum[1], 10)))
  const scoreObj: AgentDocumentScore = {
    score: Number.isFinite(score) ? score : 0,
    level: level.toUpperCase(),
    summary: summary?.[1]?.trim() ?? '',
    risks: (risks?.[1] || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean),
  }
  const cleanText = assistantText.replace(SCORE_BLOCK_RE, '').trim()
  return { score: scoreObj, cleanText }
}

/** Último score en un historial guardado (mensajes con `documentScore` o texto con bloque). */
/** Textos de UI según ámbito (el bloque técnico sigue siendo SCORE_LEGAL). */
export function documentScoreUiLabels(domain: 'legal' | 'academic' | 'creator'): {
  panelTitle: string
  confidence: string
  risksTitle: string
} {
  if (domain === 'legal') {
    return {
      panelTitle: 'Puntuación legal',
      confidence: 'Confianza',
      risksTitle: 'Riesgos detectados',
    }
  }
  if (domain === 'creator') {
    return {
      panelTitle: 'Calidad editorial',
      confidence: 'Nivel',
      risksTitle: 'Aspectos a mejorar',
    }
  }
  return {
    panelTitle: 'Calidad académica',
    confidence: 'Nivel',
    risksTitle: 'Aspectos a mejorar',
  }
}

export function lastDocumentScoreFromChatHistory(
  history: Array<{ role: string; content?: string; documentScore?: AgentDocumentScore | null; timestamp?: number }> | undefined,
): { score: AgentDocumentScore; at: number } | null {
  if (!history?.length) return null
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    if (m.role !== 'assistant' || !m.content?.trim()) continue
    if (m.documentScore && typeof m.documentScore.score === 'number') {
      return { score: m.documentScore, at: m.timestamp ?? 0 }
    }
    const { score } = stripAndParseDocumentScore(m.content)
    if (score) {
      return { score, at: m.timestamp ?? 0 }
    }
  }
  return null
}
