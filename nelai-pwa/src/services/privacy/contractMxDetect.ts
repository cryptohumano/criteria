/**
 * Capa B: patrones típicos de minutas y contratos en México (montos, huecos, escritura/folio).
 * Complementa la detección de PII estructural (email, CURP, etc.) en `piiDetect.ts`.
 *
 * Desactivar: `VITE_CONTRACT_MX_REDACT=false` en `.env`.
 * Diseño: `docs/CONTRACT_SANITIZATION_DESIGN.md`
 */

import type { PiiKind } from './piiTypes'

type RawMatch = { start: number; end: number; kind: PiiKind; text: string }

function contractMxRedactEnabled(): boolean {
  try {
    const v = import.meta.env?.VITE_CONTRACT_MX_REDACT
    if (v === 'false' || v === '0') return false
    return true
  } catch {
    return true
  }
}

function runRegex(text: string, re: RegExp, kind: PiiKind, out: RawMatch[]) {
  re.lastIndex = 0
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
  let m: RegExpExecArray | null
  while ((m = r.exec(text)) !== null) {
    const slice = m[0]
    const start = m.index
    const end = start + slice.length
    if (end > start) out.push({ start, end, kind, text: slice })
    if (m.index === r.lastIndex) r.lastIndex++
  }
}

/**
 * Aporta coincidencias de la capa “contrato MX” para fusionar en `detectPii` (merge global de solapes).
 */
export function collectContractMxRaw(text: string): RawMatch[] {
  if (!contractMxRedactEnabled() || !text) return []

  const raw: RawMatch[] = []

  // Monto en pesos con leyenda M.N. o “pesos” + fracción /100 entre paréntesis (muy habitual en instrumentos).
  runRegex(
    text,
    /\$\s*[\d,'.]+\s*\([^)]{0,280}(?:M\.N\.|moneda\s+nacional|pesos\s+\d+\s*\/\s*100)[^)]*\)/gi,
    'AMOUNT_MXN',
    raw
  )

  // Huecos de borrador frecuentes (mayúsculas típicas de minuta).
  runRegex(text, /\bNombre\s+entidad\b/gi, 'CONTRACT_SLOT', raw)
  runRegex(text, /\bEL\s+nombre\b/gi, 'CONTRACT_SLOT', raw)
  runRegex(text, /\bLA\s+nombre\b/gi, 'CONTRACT_SLOT', raw)
  runRegex(text, /\bNombre\s+notario\b/gi, 'CONTRACT_SLOT', raw)

  // Referencias formales a escritura y folio de registro.
  runRegex(text, /\bEscritura\s+Pública\s+número\s+[\d,\s]+\b/gi, 'ESCRITURA_REF', raw)
  runRegex(text, /\bfolio\s+electr[oó]nico\s+n[uú]mero\s+[\d,]+\b/gi, 'REGISTRY_FOLIO', raw)

  return raw
}
