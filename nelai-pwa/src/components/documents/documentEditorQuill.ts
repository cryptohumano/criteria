/**
 * Toolbar externa del editor de documentos.
 *
 * Quill solo construye botones con `addControls` cuando `modules.toolbar.container` es un **array**.
 * Si `container` es string o HTMLElement vacío, espera HTML ya generado; hay que poblar el nodo con
 * `addControls` antes de instanciar Quill (ver `DocumentEditor`).
 */
import {
  DOCUMENT_FONT_PICKER,
  DOCUMENT_SIZE_PICKER,
  ensureQuillDocumentFormats,
} from './registerQuillDocumentFormats'
import { ensureQuillPageBreak } from './registerQuillPageBreak'

ensureQuillDocumentFormats()
ensureQuillPageBreak()

export const DOCUMENT_EDITOR_QUILL_TOOLBAR_ID = 'nelai-doc-quill-toolbar-host'

/** Misma definición que usa `RichTextEditor` en modo integrado (mantener alineado). */
export const DOCUMENT_EDITOR_QUILL_TOOLBAR_GROUPS: ReadonlyArray<ReadonlyArray<unknown>> = [
  [
    { header: [1, 2, 3, false] },
    { font: [...DOCUMENT_FONT_PICKER] },
    { size: [...DOCUMENT_SIZE_PICKER] },
    'bold',
    'italic',
    'underline',
    'strike',
    { list: 'ordered' },
    { list: 'bullet' },
    { align: [] },
    'link',
    'image',
    'pageBreak',
    'clean',
  ],
]
