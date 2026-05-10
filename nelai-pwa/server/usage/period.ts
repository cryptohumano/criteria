/** Inicio del mes civil actual en UTC (para agregar cuotas “por mes”). */
export function startOfUtcMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

/** Duración nominal de una quincena rodante (15 días en milisegundos). */
export const FORTNIGHT_MS = 15 * 24 * 60 * 60 * 1000

/**
 * Inicio de la quincena rodante actual respecto a un ancla (típicamente
 * `Organization.createdAt`). Las ventanas son `[anchor + n·15d, anchor + (n+1)·15d)`.
 *
 * - Si `now` es anterior a `anchor`, devuelve `anchor` (ventana 0 aún no comenzada).
 * - Si `now` ≥ `anchor`, devuelve el inicio de la quincena en curso.
 */
export function startOfRollingFortnight(anchor: Date, now = new Date()): Date {
  const a = anchor.getTime()
  const t = now.getTime()
  if (t <= a) return new Date(a)
  const idx = Math.floor((t - a) / FORTNIGHT_MS)
  return new Date(a + idx * FORTNIGHT_MS)
}

/** Fin (exclusivo) de la quincena rodante actual: `start + 15d`. */
export function endOfRollingFortnight(anchor: Date, now = new Date()): Date {
  return new Date(startOfRollingFortnight(anchor, now).getTime() + FORTNIGHT_MS)
}
