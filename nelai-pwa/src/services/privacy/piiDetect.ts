import type { PiiKind, PiiMatch } from './piiTypes'
import { collectContractMxRaw } from './contractMxDetect'

type RawMatch = { start: number; end: number; kind: PiiKind; text: string }

function runRegex(text: string, re: RegExp, kind: PiiKind, out: RawMatch[]) {
  re.lastIndex = 0
  let m: RegExpExecArray | null
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
  while ((m = r.exec(text)) !== null) {
    const slice = m[0]
    const start = m.index
    const end = start + slice.length
    if (end > start) out.push({ start, end, kind, text: slice })
    if (m.index === r.lastIndex) r.lastIndex++
  }
}

/** Fusiona solapes: conserva el match más largo; si empatan, el que empieza antes. */
function mergeOverlapping(raw: RawMatch[]): PiiMatch[] {
  const sorted = [...raw].sort((a, b) => a.start - b.start || b.end - a.end - (b.end - b.start - (a.end - a.start)))
  const kept: PiiMatch[] = []
  for (const m of sorted) {
    const last = kept[kept.length - 1]
    if (last && m.start < last.end) {
      const lenM = m.end - m.start
      const lenL = last.end - last.start
      if (lenM > lenL || (lenM === lenL && m.start < last.start)) {
        kept[kept.length - 1] = { kind: m.kind, start: m.start, end: m.end, text: m.text }
      }
      continue
    }
    kept.push({ kind: m.kind, start: m.start, end: m.end, text: m.text })
  }
  return kept
}

/**
 * Detecta PII por patrones en un texto.
 * No incluye NER de nombres propios (alto riesgo de falsos positivos/negativos).
 */
export function detectPii(text: string): PiiMatch[] {
  const raw: RawMatch[] = []

  // Email
  runRegex(
    text,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    'EMAIL',
    raw
  )

  // IBAN España (22 dígitos tras ES; admite grupos de 4)
  runRegex(
    text,
    /\bES\d{2}(?:\s?\d{4}){5}\b|\bES\d{22}\b/gi,
    'IBAN',
    raw
  )

  // DNI español
  runRegex(text, /\b\d{8}[A-HJ-NP-TV-Z]\b/gi, 'DNI', raw)

  // NIE
  runRegex(text, /\b[XYZ]\d{7}[A-HJ-NP-TV-Z]\b/gi, 'NIE', raw)

  // Teléfonos ES / +34 (heurística)
  runRegex(
    text,
    /(?:\+34[\s.-]?)?(?:[6-9]\d{1}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}|9\d{2}[\s.-]?\d{3}[\s.-]?\d{3})\b/g,
    'PHONE',
    raw
  )

  // RFC México (patrón habitual; no valida dígito verificador)
  runRegex(text, /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi, 'RFC_MX', raw)

  // CURP (patrón habitual)
  runRegex(text, /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d\b/gi, 'CURP', raw)

  // Contrato / minuta MX (montos, huecos, escritura, folio). Ver contractMxDetect.ts y docs/CONTRACT_SANITIZATION_DESIGN.md
  raw.push(...collectContractMxRaw(text))

  return mergeOverlapping(raw)
}

/** Fusiona solapes entre coincidencias (p. ej. automáticas + MANUAL). */
export function mergePiiMatchSpans(matches: PiiMatch[]): PiiMatch[] {
  if (matches.length === 0) return []
  return mergeOverlapping(matches.map((m) => ({ start: m.start, end: m.end, kind: m.kind, text: m.text })))
}
