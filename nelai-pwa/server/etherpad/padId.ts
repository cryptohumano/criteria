import { createHash } from 'node:crypto'

/**
 * ID de pad válido para Etherpad (solo caracteres seguros) derivado del id de documento CriterIA.
 *
 * Nota: el prefijo `nelai_` se mantiene por compatibilidad con pads ya creados
 * en Etherpad. Renombrar a `criteria_` requiere una migración separada de pads.
 */
export function padIdFromDocId(docId: string): string {
  const raw = createHash('sha256').update(docId, 'utf8').digest('hex').slice(0, 40)
  return `nelai_${raw}`
}
