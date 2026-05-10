/**
 * Amplía fuentes y tamaños permitidos en Quill antes de instanciar el editor.
 * Debe ejecutarse una sola vez (idempotente).
 */
import Quill from 'quill'

let ensured = false

/** Valores de clase `ql-font-*` (sin `false`). */
export const DOCUMENT_FONT_VALUES = [
  'arial',
  'georgia',
  'times-new-roman',
  'courier-new',
  'verdana',
  'serif',
  'monospace',
] as const

/** Primer valor `false` = texto predeterminado (sin clase). */
export const DOCUMENT_FONT_PICKER: ReadonlyArray<string | false> = [false, ...DOCUMENT_FONT_VALUES]

export const DOCUMENT_SIZE_VALUES = ['small', '12px', '14px', 'large', '18px', 'huge'] as const

export const DOCUMENT_SIZE_PICKER: ReadonlyArray<string | false> = [false, ...DOCUMENT_SIZE_VALUES]

export function ensureQuillDocumentFormats(): void {
  if (ensured) return
  ensured = true
  const Font = Quill.import('formats/font') as { whitelist: string[] }
  const Size = Quill.import('formats/size') as { whitelist: string[] }
  Font.whitelist = [...DOCUMENT_FONT_VALUES]
  Size.whitelist = [...DOCUMENT_SIZE_VALUES]
}
