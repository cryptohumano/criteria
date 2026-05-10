import { detectPii } from './piiDetect'
import type { PiiKind, PiiMatch, PiiReviewRow } from './piiTypes'

/** Bloque `[CRITERIA_<KIND>_###]` (o legacy `[NELAI_*]`) ya incrustado en el texto. */
const CRITERIA_BRACKET_RE = /\[((?:CRITERIA|NELAI)_[^\]]+)\]/g

const KNOWN_KINDS = new Set<PiiKind>([
  'EMAIL',
  'PHONE',
  'IBAN',
  'DNI',
  'NIE',
  'RFC_MX',
  'CURP',
  'AMOUNT_MXN',
  'CONTRACT_SLOT',
  'ESCRITURA_REF',
  'REGISTRY_FOLIO',
  'MANUAL',
])

export function nelaiBracketRanges(plain: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = []
  let m: RegExpExecArray | null
  const r = new RegExp(CRITERIA_BRACKET_RE.source, 'g')
  while ((m = r.exec(plain)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length })
    if (m.index === r.lastIndex) r.lastIndex++
  }
  return out
}

function overlapsBracket(a: { start: number; end: number }, b: { start: number; end: number }) {
  return !(a.end <= b.start || a.start >= b.end)
}

/** PII detectado fuera de bloques `[NELAI_*]` ya presentes en el documento. */
export function detectPiiOutsideNelaiBrackets(plain: string): PiiMatch[] {
  const spans = nelaiBracketRanges(plain)
  return detectPii(plain).filter((m) => !spans.some((s) => overlapsBracket(m, s)))
}

/** Siguiente índice global ### para nuevos tokens NELAI (todos los tipos comparten secuencia). */
export function nextNelaiSerial(plain: string): number {
  let max = 0
  const r = /\[(?:CRITERIA|NELAI)_[^\]]+_(\d{3})\]/g
  let m: RegExpExecArray | null
  while ((m = r.exec(plain)) !== null) {
    max = Math.max(max, parseInt(m[1], 10))
    if (m.index === r.lastIndex) r.lastIndex++
  }
  return max + 1
}

/**
 * @param plain Texto donde buscar tokens existentes (p. ej. `getPlainText()` de Quill).
 * @param alsoScan Cadenas adicionales para la numeración (p. ej. placeholders ya en el registro del documento),
 *   evita colisiones y huecos si el HTML/plano del editor aún no refleja todos los tokens.
 */
export function buildNelaiPlaceholder(plain: string, kind: PiiKind, ...alsoScan: string[]): string {
  const combined = [plain, ...alsoScan].filter(Boolean).join('\n')
  const n = nextNelaiSerial(combined)
  return `[CRITERIA_${kind}_${String(n).padStart(3, '0')}]`
}

function parseKindFromInner(inner: string): PiiKind {
  const rest = inner.startsWith('CRITERIA_')
    ? inner.slice(9)
    : inner.startsWith('NELAI_')
      ? inner.slice(6)
      : inner
  const m = rest.match(/^(.+)_(\d{3})$/)
  if (!m) return 'MANUAL'
  const k = m[1] as PiiKind
  return KNOWN_KINDS.has(k) ? k : 'MANUAL'
}

/** P. ej. `[NELAI_EMAIL_001]` → `EMAIL` */
export function kindFromNelaiBracketToken(full: string): PiiKind {
  const inner = full.startsWith('[') && full.endsWith(']') ? full.slice(1, -1) : full
  return parseKindFromInner(inner)
}

/** Filas para tabla: placeholders que ya están escritos en el documento. */
export function embeddedNelaiRowsFromPlain(plain: string): PiiReviewRow[] {
  const rows: PiiReviewRow[] = []
  let m: RegExpExecArray | null
  const r = new RegExp(CRITERIA_BRACKET_RE.source, 'g')
  while ((m = r.exec(plain)) !== null) {
    const full = m[0]
    const inner = m[1]
    const kind = parseKindFromInner(inner)
    rows.push({
      kind,
      original: '(placeholder activo en el documento)',
      placeholder: full,
      source: 'document',
    })
    if (m.index === r.lastIndex) r.lastIndex++
  }
  return rows
}

// Nuevos nombres (marca CriterIA). Mantener compatibilidad con imports previos.
export const criteriaBracketRanges = nelaiBracketRanges
export const detectPiiOutsideCriteriaBrackets = detectPiiOutsideNelaiBrackets
export const nextCriteriaSerial = nextNelaiSerial
export const buildCriteriaPlaceholder = buildNelaiPlaceholder
export const kindFromCriteriaBracketToken = kindFromNelaiBracketToken
export const embeddedCriteriaRowsFromPlain = embeddedNelaiRowsFromPlain
