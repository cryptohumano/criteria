import { detectPii } from './piiDetect'
import { detectPiiOutsideCriteriaBrackets } from './criteriaPlaceholders'
import type { PiiMatch, PiiReviewRow } from './piiTypes'

/**
 * Misma numeración global de placeholders que `anonymizeDocAndMessage`, pero solo para subconjuntos de coincidencias.
 */
export function anonymizeDocAndMessageWithMatches(
  docPlain: string,
  userMessage: string,
  docMatches: PiiMatch[],
  msgMatches: PiiMatch[]
): { docSan: string; msgSan: string; rows: PiiReviewRow[] } {
  if (docMatches.length === 0 && msgMatches.length === 0) {
    return { docSan: docPlain, msgSan: userMessage, rows: [] }
  }

  let n = 0
  const nextPh = (m: PiiMatch) => {
    n += 1
    return `[CRITERIA_${m.kind}_${String(n).padStart(3, '0')}]`
  }

  const mapDoc = new Map<PiiMatch, string>()
  for (const m of [...docMatches].sort((a, b) => a.start - b.start)) {
    mapDoc.set(m, nextPh(m))
  }
  const mapMsg = new Map<PiiMatch, string>()
  for (const m of [...msgMatches].sort((a, b) => a.start - b.start)) {
    mapMsg.set(m, nextPh(m))
  }

  const rows: PiiReviewRow[] = [
    ...[...docMatches]
      .sort((a, b) => a.start - b.start)
      .map((m) => ({
        kind: m.kind,
        original: m.text,
        placeholder: mapDoc.get(m)!,
        source: 'document' as const,
      })),
    ...[...msgMatches]
      .sort((a, b) => a.start - b.start)
      .map((m) => ({
        kind: m.kind,
        original: m.text,
        placeholder: mapMsg.get(m)!,
        source: 'message' as const,
      })),
  ]

  const docSan = applyPlaceholders(docPlain, docMatches, (m) => mapDoc.get(m)!)
  const msgSan = applyPlaceholders(userMessage, msgMatches, (m) => mapMsg.get(m)!)
  return { docSan, msgSan, rows }
}

function applyPlaceholders(text: string, matches: PiiMatch[], placeholderFor: (m: PiiMatch) => string): string {
  const sorted = [...matches].sort((a, b) => b.start - a.start)
  let out = text
  for (const m of sorted) {
    const ph = placeholderFor(m)
    out = out.slice(0, m.start) + ph + out.slice(m.end)
  }
  return out
}

/**
 * Sustituye solo los `matches` indicados (posiciones válidas en `text`).
 * Renumera placeholders del 001 en orden de aparición en el texto.
 */
export function anonymizeWithMatches(text: string, matches: PiiMatch[]): { sanitized: string; rows: PiiReviewRow[] } {
  if (matches.length === 0) {
    return { sanitized: text, rows: [] }
  }
  const asc = [...matches].sort((a, b) => a.start - b.start)
  let n = 0
  const map = new Map<PiiMatch, string>()
  const rows: PiiReviewRow[] = []
  for (const m of asc) {
    n += 1
    const ph = `[CRITERIA_${m.kind}_${String(n).padStart(3, '0')}]`
    map.set(m, ph)
    rows.push({ kind: m.kind, original: m.text, placeholder: ph })
  }
  const sanitized = applyPlaceholders(text, matches, (m) => map.get(m)!)
  return { sanitized, rows }
}

/** Anonimiza un solo texto; numera placeholders en orden de aparición. */
export function anonymizePlainText(text: string): { sanitized: string; matches: PiiMatch[]; rows: PiiReviewRow[] } {
  const matches = detectPii(text)
  if (matches.length === 0) {
    return { sanitized: text, matches: [], rows: [] }
  }
  const { sanitized, rows } = anonymizeWithMatches(text, matches)
  return { sanitized, matches, rows }
}

/**
 * Anonimiza documento y mensaje con una sola secuencia de numeración de placeholders.
 */
export function anonymizeDocAndMessage(
  docPlain: string,
  userMessage: string
): {
  docSan: string
  msgSan: string
  rows: PiiReviewRow[]
  hasPii: boolean
  docMatches: PiiMatch[]
  msgMatches: PiiMatch[]
} {
  const mDoc = detectPiiOutsideCriteriaBrackets(docPlain)
  const mMsg = detectPiiOutsideCriteriaBrackets(userMessage)
  if (mDoc.length === 0 && mMsg.length === 0) {
    return { docSan: docPlain, msgSan: userMessage, rows: [], hasPii: false, docMatches: [], msgMatches: [] }
  }

  const { docSan, msgSan, rows } = anonymizeDocAndMessageWithMatches(docPlain, userMessage, mDoc, mMsg)
  return { docSan, msgSan, rows, hasPii: true, docMatches: mDoc, msgMatches: mMsg }
}
