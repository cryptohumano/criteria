/**
 * Depuración del editor Quill / RichTextEditor.
 * En dev siempre activo; en prod: `localStorage.setItem('NELAI_QUILL_DEBUG', '1')` y recargar.
 *
 * Salida: `[Quill/RichText t=123.4ms]` + mensaje y datos. Orden cronológico claro para ver dobles
 * disparos del mismo clic (listeners duplicados en la toolbar).
 */
export function isQuillRichTextDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return import.meta.env.DEV || window.localStorage?.getItem('NELAI_QUILL_DEBUG') === '1'
  } catch {
    return Boolean(import.meta.env.DEV)
  }
}

function debugTimestamp(): string {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now().toFixed(1)
    }
  } catch {
    /* */
  }
  return '?'
}

export function quillRichTextDebug(first: string, ...rest: unknown[]) {
  if (!isQuillRichTextDebugEnabled()) return
  const t = debugTimestamp()
  if (rest.length === 0) {
    console.log(`[Quill/RichText t=${t}ms]`, first)
    return
  }
  if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null && !Array.isArray(rest[0])) {
    console.log(`[Quill/RichText t=${t}ms]`, first, rest[0])
    return
  }
  console.log(`[Quill/RichText t=${t}ms]`, first, ...rest)
}
