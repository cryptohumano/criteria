import type { PiiMatch } from './piiTypes'
import { mergePiiMatchSpans } from './piiDetect'

/**
 * Las selecciones MANUAL tienen prioridad: elimina automáticas que solapan con cualquier manual,
 * luego fusiona solapes entre todas.
 */
export function combineManualAndAuto(manual: PiiMatch[], auto: PiiMatch[]): PiiMatch[] {
  const man = manual.filter((x) => x.end > x.start && x.kind === 'MANUAL')
  const filteredAuto = auto.filter(
    (a) => !man.some((m) => !(a.end <= m.start || a.start >= m.end))
  )
  return mergePiiMatchSpans([...man, ...filteredAuto])
}
