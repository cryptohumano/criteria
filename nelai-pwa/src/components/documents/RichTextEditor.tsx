/**
 * Editor de texto enriquecido usando Quill
 */

import { useRef, useEffect, useLayoutEffect, useState, useMemo, useCallback } from 'react'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import { cn } from '@/lib/utils'
import PhotoCapture from './PhotoCapture'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Camera, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Scope } from 'parchment'
import { quillRichTextDebug } from '@/lib/quillRichTextDebug'
import { DOCUMENT_EDITOR_QUILL_TOOLBAR_GROUPS } from './documentEditorQuill'
import { DEFAULT_PAPER_FORMAT, PAPER_SPECS, normalizePaperFormat, type PaperFormatId } from '@/constants/paperFormat'
import { CRITERIA_QUILL_PAGE_BREAK_CLASS, NELAI_QUILL_PAGE_BREAK_CLASS } from '@/constants/criteriaQuillEmbed'

/** `value` del padre aún no hidratado (`''`) mientras Quill ya serializa el bloque vacío. */
function isMissingHtmlProp(incoming: string) {
  return !(incoming || '').trim()
}

/** HTML mínimo de documento vacío (getSemanticHTML de Quill 2). */
function isSemanticQuillEmpty(html: string) {
  const s = (html || '').trim().replace(/\s+/g, '')
  if (!s) return true
  return /^<p><br\s*\/?><\/p>$/i.test(s) || /^<p><\/p>$/i.test(s)
}

/** Token `[CRITERIA_…]` (o legacy `[NELAI_…]`) incrustado en el documento (PII / manual). */
function isCriteriaBracketPlaceholder(s: string) {
  return /^\[(?:CRITERIA|NELAI)_[^\]]+\]$/.test((s || '').trim())
}

function insertPlainUserText(q: any, index: number, text: string) {
  if (isCriteriaBracketPlaceholder(text)) {
    q.insertText(index, text, { bold: true }, 'user')
  } else {
    q.insertText(index, text, 'user')
  }
}

/** Igualar comillas tipográficas y NBSP para comparar fragmentos con el texto que vio el modelo. */
function normalizePlainForMatch(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
}

function collectSubstringIndices(haystack: string, needle: string): number[] {
  if (!needle) return []
  const out: number[] = []
  let from = 0
  while (from <= haystack.length - needle.length) {
    const i = haystack.indexOf(needle, from)
    if (i === -1) break
    out.push(i)
    from = i + 1
  }
  return out
}

/**
 * Elige dónde sustituir cuando hay varias apariciones: prioriza la que cae dentro de la selección
 * del editor (el usuario suele marcar el párrafo correcto antes de pulsar «Aplicar» en el agente).
 */
function pickReplaceSpan(
  haystack: string,
  needle: string,
  selStart: number | undefined,
  selEnd: number | undefined
): { index: number; length: number } | null {
  const tryNeedle = (n: string): { index: number; length: number } | null => {
    if (!n) return null
    const indices = collectSubstringIndices(haystack, n)
    if (indices.length === 0) return null
    if (indices.length === 1) return { index: indices[0], length: n.length }

    if (typeof selStart === 'number') {
      const lo = Math.min(selStart, selEnd ?? selStart)
      const hi = Math.max(selStart, selEnd ?? selStart)

      const contained = indices.find((i) => i >= lo && i + n.length <= hi)
      if (contained !== undefined) return { index: contained, length: n.length }

      const overlap = indices.find((i) => i < hi && i + n.length > lo)
      if (overlap !== undefined) return { index: overlap, length: n.length }

      const cursor = selStart
      let best = indices[0]
      let bestDist = Math.abs(indices[0] - cursor)
      for (const idx of indices) {
        const d = Math.abs(idx - cursor)
        if (d < bestDist) {
          best = idx
          bestDist = d
        }
      }
      return { index: best, length: n.length }
    }

    return { index: indices[0], length: n.length }
  }

  let span = tryNeedle(needle)
  if (span) return span

  const trimmed = needle.trim()
  if (trimmed && trimmed !== needle) {
    span = tryNeedle(trimmed)
    if (span) return span
  }

  const nn = normalizePlainForMatch(needle)
  if (!nn.trim()) return null
  const matches: { index: number; length: number }[] = []
  const max = haystack.length
  const L = needle.length
  if (L <= 0) return null
  for (let i = 0; i <= max - L; i++) {
    const slice = haystack.slice(i, i + L)
    if (normalizePlainForMatch(slice) === nn) {
      matches.push({ index: i, length: L })
    }
  }
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  if (typeof selStart === 'number') {
    const lo = Math.min(selStart, selEnd ?? selStart)
    const hi = Math.max(selStart, selEnd ?? selStart)
    const Lm = matches[0].length
    const contained = matches.find((m) => m.index >= lo && m.index + Lm <= hi)
    if (contained) return contained
    const overlap = matches.find((m) => m.index < hi && m.index + Lm > lo)
    if (overlap) return overlap
    const cursor = selStart
    return matches.reduce((best, m) =>
      Math.abs(m.index - cursor) < Math.abs(best.index - cursor) ? m : best
    )
  }
  return matches[0]
}

type QuillRange = { index: number; length: number }

/**
 * Tras clic en la toolbar, `getSelection(false)` suele devolver un subrango erróneo (p. ej. 6,2)
 * antes que el bloque que el usuario seleccionó (0,35). Orden:
 * 1) rango congelado en `mousedown` (capture) sobre el host de la toolbar
 * 2) último rango con length&gt;0 de `selection-change`
 * 3) selección viva con length&gt;0
 * 4) `savedRange`
 */
function resolveRangeForToolbar(
  quill: any,
  pendingMousedownRef: { current: QuillRange | null },
  lastCapturedRef: { current: QuillRange | null }
): QuillRange | null {
  try {
    quill.update()
  } catch {
    /* */
  }
  const pending = pendingMousedownRef.current
  if (pending && pending.length > 0) {
    return { index: pending.index, length: pending.length }
  }
  const cap = lastCapturedRef.current
  if (cap && cap.length > 0) {
    return { index: cap.index, length: cap.length }
  }

  const live = quill.getSelection(false) as QuillRange | null
  const sr = quill.selection?.savedRange as QuillRange | null

  if (live && live.length > 0) {
    return { index: live.index, length: live.length }
  }
  if (sr && typeof sr.index === 'number' && sr.length > 0) {
    return { index: sr.index, length: sr.length }
  }
  if (live && typeof live.index === 'number') {
    return { index: live.index, length: Math.max(0, live.length ?? 0) }
  }
  if (cap && typeof cap.index === 'number') {
    return { index: cap.index, length: Math.max(0, cap.length ?? 0) }
  }
  if (sr && typeof sr.index === 'number') {
    return { index: sr.index, length: Math.max(0, sr.length ?? 0) }
  }
  return null
}

export interface EditorApi {
  insertAtCursor: (text: string) => void
  /** Inserta al final del documento (p. ej. bloques [CONTENIDO] desde el agente cuando el foco no está en el editor). */
  insertAtDocumentEnd: (text: string) => void
  replaceText: (original: string, replacement: string) => boolean
  getContent: () => string
  /** Texto plano alineado con índices de Quill (para PII / placeholders). */
  getPlainText: () => string
  /** Selección no vacía en coordenadas de `getPlainText()`. */
  getSelectionPlain: () => { start: number; end: number; text: string } | null
  /** Sustituye el rango `[start,end)` en el texto plano por `replacement`. */
  replacePlainRange: (start: number, end: number, replacement: string) => boolean
  /** Sustituye la selección actual por `replacement`. */
  replaceSelectionWithText: (replacement: string) => boolean
  /** Busca `placeholder` en el texto plano, selecciona y desplaza la vista. */
  focusPlaceholderInDocument: (placeholder: string) => boolean
}

export interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
  /** Ref que se rellena con insertAtCursor cuando el editor está listo */
  editorApiRef?: React.MutableRefObject<EditorApi | null>
  /** Se invoca cuando Quill expone ya `getPlainText` / sustitución por rangos. */
  onEditorReady?: () => void
  /** Sin toolbar ni stats internas: el padre pinta chrome y rellena el host con `addControls` antes de pasar el nodo. */
  viewportEditorChrome?: boolean
  /** Nodo del host de toolbar (con botones ya creados por `addControls` en `DocumentEditor`). */
  toolbarContainerEl?: HTMLDivElement | null
  /** Estadísticas de página/caracteres para barra externa. */
  onDocStatsChange?: (stats: { chars: number; pages: number }) => void
  /** Ref al nodo raíz (p. ej. para scrollIntoView desde fuera). */
  surfaceRef?: React.RefObject<HTMLDivElement | null>
  /**
   * Solo con `viewportEditorChrome`: al desmontar el editor, notifica al padre para recrear el host
   * de la toolbar (evita listeners duplicados si Quill se destruyó y los `click` siguen en el DOM).
   */
  onExternalToolbarHostCycle?: () => void
  /** Tamaño de la “hoja” del editor (debe coincidir con `metadata.paperFormat` al exportar PDF). */
  paperFormat?: PaperFormatId
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe el contenido del documento...',
  className,
  readOnly = false,
  editorApiRef,
  onEditorReady,
  viewportEditorChrome = false,
  toolbarContainerEl = null,
  onDocStatsChange,
  surfaceRef,
  onExternalToolbarHostCycle,
  paperFormat: paperFormatProp = DEFAULT_PAPER_FORMAT,
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill>(null)
  /** Último `value` del padre (p. ej. ir a placeholder si Quill iba desfasado). */
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  /** Última selección del editor (Quill `selection-change`); persiste cuando el clic va a la toolbar externa. */
  const lastQuillRangeRef = useRef<QuillRange | null>(null)
  /** Rango capturado en mousedown (capture) en el host de la toolbar; prioridad sobre `getSelection` al pulsar un control. */
  const toolbarPendingRangeRef = useRef<QuillRange | null>(null)
  /**
   * Quill vuelve a registrar `click` en los mismos `<button>` si el editor se regenera (p. ej. Strict Mode
   * o cambio de `modules`) sin recrear el host → un solo clic ejecuta el handler dos veces (p. ej. bold
   * false y en seguida bold true). Solo el primer handler del mismo tick debe actuar.
   */
  const toolbarHandlerWaveRef = useRef(0)
  /** Último HTML canónico emitido por Quill; evita reinyectar con `setEditorContents` en cada tecla (rompe formatos/selección). */
  const lastEmittedHtmlRef = useRef<string | null>(null)
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)
  const [docStats, setDocStats] = useState({ chars: 0, pages: 1 })
  const showQuill = readOnly || !viewportEditorChrome || toolbarContainerEl !== null

  const paperSpec = useMemo(
    () => PAPER_SPECS[normalizePaperFormat(paperFormatProp)],
    [paperFormatProp]
  )

  /** Altura de una hoja en px (96 CSS px / pulgada); conteo aproximado de páginas (scrollHeight / hoja), alineado con formato PDF. */
  const pageStepPx = useMemo(() => (paperSpec.heightMm * 96) / 25.4, [paperSpec.heightMm])

  const measureDocumentStats = useCallback(() => {
    let chars = 0
    if (value) {
      const d = document.createElement('div')
      d.innerHTML = value
      chars = (d.textContent || d.innerText || '').length
    }
    let pages = 1
    try {
      const q = quillRef.current?.getEditor()
      const root = q?.root as HTMLElement | undefined
      if (root) {
        const step = pageStepPx
        if (step > 0) {
          pages = Math.max(1, Math.ceil(root.scrollHeight / step))
        }
      }
    } catch {
      /* Quill no listo */
    }
    const next = { chars, pages }
    if (viewportEditorChrome) {
      onDocStatsChange?.(next)
    } else {
      setDocStats(next)
      onDocStatsChange?.(next)
    }
  }, [value, viewportEditorChrome, onDocStatsChange, pageStepPx])

  useEffect(() => {
    if (!mounted) return
    measureDocumentStats()
    const raf = requestAnimationFrame(() => measureDocumentStats())
    const t = window.setTimeout(measureDocumentStats, 200)
    let ro: ResizeObserver | null = null
    try {
      const root = quillRef.current?.getEditor()?.root as HTMLElement | undefined
      if (root && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => measureDocumentStats())
        ro.observe(root)
      }
    } catch {
      /* */
    }
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
      ro?.disconnect()
    }
  }, [mounted, value, measureDocumentStats])

  // Ref estable para el handler de imagen — evita que modules cambie en cada render
  const openPhotoDialogRef = useRef(() => setPhotoDialogOpen(true))
  useEffect(() => {
    openPhotoDialogRef.current = () => setPhotoDialogOpen(true)
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!viewportEditorChrome || !onExternalToolbarHostCycle) return
    return () => {
      onExternalToolbarHostCycle()
    }
  }, [viewportEditorChrome, onExternalToolbarHostCycle])

  useEffect(() => {
    if (!showQuill) lastEmittedHtmlRef.current = null
  }, [showQuill])

  /**
   * Sincronizar solo cuando `value` viene de fuera (carga, agente, restaurar versión), no tras cada pulsación del usuario.
   * react-quill-new en modo controlado hace `setContents(clipboard.convert(html))` si el string difiere → formatos y selección se rompen.
   */
  useEffect(() => {
    if (!mounted || !showQuill) return
    let cancelled = false
    let attempts = 0
    const tick = () => {
      if (cancelled) return
      attempts += 1
      let editor: any
      try {
        editor = quillRef.current?.getEditor()
      } catch {
        if (attempts < 30) requestAnimationFrame(tick)
        return
      }
      if (!editor) {
        if (attempts < 30) requestAnimationFrame(tick)
        return
      }

      const incoming = value ?? ''

      if (lastEmittedHtmlRef.current === null) {
        try {
          let cur = editor.getSemanticHTML()
          if (incoming && incoming !== cur) {
            quillRichTextDebug('sync externo (bootstrap): setContents', {
              incomingLen: incoming.length,
              curLen: cur.length,
            })
            editor.setContents(editor.clipboard.convert({ html: incoming }), 'silent')
            cur = editor.getSemanticHTML()
          } else {
            quillRichTextDebug('sync externo (bootstrap): sin setContents', {
              incomingLen: incoming.length,
              curLen: cur.length,
            })
          }
          lastEmittedHtmlRef.current = cur
        } catch (e) {
          quillRichTextDebug('sync externo (bootstrap): error', e)
        }
        return
      }

      if (incoming === lastEmittedHtmlRef.current) return

      let current = ''
      try {
        current = editor.getSemanticHTML()
      } catch {
        return
      }
      if (incoming === current) {
        quillRichTextDebug('sync: alinear lastEmitted con prop (HTML ya coincide en editor)')
        lastEmittedHtmlRef.current = incoming
        return
      }

      /*
       * El padre suele arrancar con content '' pero Quill ya expone `<p><br></p>` (~7 chars).
       * setContents('') en ese caso resetea el delta y rompe negrita/selección (véase logs).
       * Si el padre pide vacío y el editor **solo** está vacío a nivel Quill, normalizamos sin reinyectar.
       * Si el padre pide vacío y hay texto real, interpretamos borrado externo y sí vaciamos.
       */
      if (isMissingHtmlProp(incoming)) {
        if (isSemanticQuillEmpty(current)) {
          quillRichTextDebug('sync: prop vacío + editor vacío; alinear sin setContents', {
            currentLen: current.length,
          })
          lastEmittedHtmlRef.current = current
          if (current !== incoming) onChange(current)
          return
        }
        quillRichTextDebug('sync: prop vacío + editor con texto; vaciar desde el padre', {
          currentLen: current.length,
        })
        try {
          editor.setContents(editor.clipboard.convert({ html: '' }), 'silent')
          lastEmittedHtmlRef.current = editor.getSemanticHTML()
        } catch (e) {
          quillRichTextDebug('sync: error vaciando desde prop vacío', e)
        }
        return
      }

      try {
        quillRichTextDebug('sync externo: setContents por diff prop vs editor', {
          incomingLen: incoming.length,
          currentLen: current.length,
        })
        editor.setContents(editor.clipboard.convert({ html: incoming }), 'silent')
        lastEmittedHtmlRef.current = editor.getSemanticHTML()
      } catch (e) {
        quillRichTextDebug('sync externo: error setContents', e)
      }
    }
    requestAnimationFrame(tick)
    return () => {
      cancelled = true
    }
  }, [value, mounted, showQuill, onChange])

  const handleQuillChange = useCallback(
    (_html: string) => {
      const q = quillRef.current?.getEditor()
      // Al desmontar Quill (ciclo de toolbar, salida de ruta, etc.) react-quill puede disparar onChange;
      // sin instancia válida `getSemanticHTML` sería '' y vaciaría el HTML del padre en IndexedDB.
      if (!q) return
      try {
        const canonical = q.getSemanticHTML?.() ?? ''
        lastEmittedHtmlRef.current = canonical
        onChange(canonical)
      } catch {
        const fallback = typeof _html === 'string' ? _html : ''
        lastEmittedHtmlRef.current = fallback
        onChange(fallback)
      }
      requestAnimationFrame(measureDocumentStats)
    },
    [onChange, measureDocumentStats]
  )

  useEffect(() => {
    if (!mounted || !editorApiRef) return
    if (!showQuill) {
      editorApiRef.current = null
      return
    }
    const tryAttach = () => {
      if (!quillRef.current) return false
      try {
        // react-quill-new puede lanzar error si se llama a getEditor() muy pronto
        const editor = quillRef.current.getEditor()
        if (!editor) return false

        /**
         * Flash highlight con delay de 60ms.
         * Se aplica DESPUÉS de que el caller (handleReplace/handleInsert)
         * haya llamado getContent(), así el HTML guardado nunca incluye
         * el fondo amarillo.
         */
        type FlashOpts = { jump?: boolean }

        /** Resaltado breve tras sustituciones. Con `jump`, pulso largo y visible al ir a un placeholder. */
        const flashHighlight = (q: any, index: number, length: number, opts?: FlashOpts) => {
          const jump = opts?.jump === true
          const delay = jump ? 40 : 60
          setTimeout(() => {
            if (jump) {
              q.formatText(index, length, { background: '#f59e0b' }, 'silent')
            } else {
              q.formatText(index, length, { background: '#facc15' }, 'silent')
            }

            if (!jump) {
              try {
                const editorEl = q.root as HTMLElement
                const bounds = q.getBounds(index, length)
                if (bounds && editorEl) {
                  const scrollContainer = editorEl.closest('.ql-container') || editorEl.parentElement
                  if (scrollContainer) {
                    const targetScroll = bounds.top - scrollContainer.clientHeight / 3
                    editorEl.scrollTo({ top: targetScroll, behavior: 'smooth' })
                  }
                  const absoluteRect = editorEl.getBoundingClientRect()
                  const targetY = absoluteRect.top + bounds.top + window.scrollY - window.innerHeight / 3
                  window.scrollTo({ top: targetY, behavior: 'smooth' })
                }
              } catch {
                /* */
              }
            }

            if (jump) {
              setTimeout(() => {
                q.formatText(index, length, { background: '#fbbf24' }, 'silent')
              }, 650)
              setTimeout(() => {
                q.formatText(index, length, { background: '#fde047' }, 'silent')
              }, 1600)
              setTimeout(() => {
                q.formatText(index, length, { background: '#fef08a' }, 'silent')
              }, 2800)
              setTimeout(() => {
                q.formatText(index, length, { background: '#fef9c3' }, 'silent')
              }, 4200)
              setTimeout(() => {
                q.formatText(index, length, { background: '#fffbeb' }, 'silent')
              }, 5600)
              setTimeout(() => {
                q.formatText(index, length, { background: false }, 'silent')
              }, 7800)
            } else {
              setTimeout(() => {
                q.formatText(index, length, { background: '#fef08a' }, 'silent')
              }, 1200)
              setTimeout(() => {
                q.formatText(index, length, { background: '#fef9c3' }, 'silent')
              }, 2200)
              setTimeout(() => {
                q.formatText(index, length, { background: false }, 'silent')
              }, 3200)
            }
          }, delay)
        }

        const readPlain = (q: { getText: (a?: number, b?: number) => string; getLength: () => number }) => {
          const len = q.getLength()
          if (len <= 1) return ''
          return q.getText(0, len - 1)
        }

        /**
         * `getBounds` de Quill usa coordenadas de viewport; el scroll útil es el de `.ql-container`
         * (hoja con overflow-y), no centrar la página con scrollIntoView del contenedor exterior.
         */
        const scrollQuillRangeIntoView = (qu: any, index: number, length: number) => {
          const root = qu.root as HTMLElement | undefined
          if (!root) return
          const container = root.closest('.ql-container') as HTMLElement | null
          if (!container || container.scrollHeight <= container.clientHeight + 2) {
            try {
              ;(qu as { scrollSelectionIntoView?: () => void }).scrollSelectionIntoView?.call(qu)
            } catch {
              /* */
            }
            return
          }
          let bounds: { top: number; bottom?: number; height?: number } | null = null
          try {
            bounds = qu.getBounds(index, length) as { top: number; bottom?: number; height?: number } | null
          } catch {
            return
          }
          if (!bounds || typeof bounds.top !== 'number') {
            try {
              ;(qu as { scrollSelectionIntoView?: () => void }).scrollSelectionIntoView?.call(qu)
            } catch {
              /* */
            }
            return
          }
          const pad = 72
          const cbr = container.getBoundingClientRect()
          const top = bounds.top
          const bottom =
            typeof bounds.bottom === 'number'
              ? bounds.bottom
              : bounds.top + (typeof bounds.height === 'number' ? bounds.height : 20)
          let dy = 0
          if (top < cbr.top + pad) {
            dy = top - cbr.top - pad
          } else if (bottom > cbr.bottom - pad) {
            dy = bottom - cbr.bottom + pad
          }
          if (dy !== 0) {
            container.scrollBy({ top: dy, behavior: 'smooth' })
          }
        }

        editorApiRef.current = {
          insertAtCursor: (text: string) => {
            const q = quillRef.current?.getEditor()
            if (!q) return
            const range = q.getSelection(true)
            if (range) {
              insertPlainUserText(q, range.index, text)
              q.setSelection(range.index + text.length)
              flashHighlight(q, range.index, text.length)
            } else {
              const pos = q.getLength() - 1
              insertPlainUserText(q, pos, text)
              flashHighlight(q, pos, text.length)
            }
          },
          insertAtDocumentEnd: (text: string) => {
            const q = quillRef.current?.getEditor()
            if (!q) return
            try {
              q.focus()
            } catch {
              /* */
            }
            const pos = Math.max(0, q.getLength() - 1)
            const body = readPlain(q)
            const needsGap =
              body.replace(/\n+$/g, '').trim().length > 0 &&
              text.length > 0 &&
              !/^\n/.test(text) &&
              !/\n\n$/.test(body)
            const toInsert = needsGap ? `\n\n${text}` : text
            insertPlainUserText(q, pos, toInsert)
            try {
              q.setSelection(pos + toInsert.length, 0, 'silent')
            } catch {
              /* */
            }
            flashHighlight(q, pos, toInsert.length)
          },
          replaceText: (original: string, replacement: string) => {
            const q = quillRef.current?.getEditor()
            if (!q || !original) return false
            try {
              q.focus()
            } catch {
              /* */
            }
            const text = readPlain(q)
            const sel = q.getSelection(true) as QuillRange | null
            const selStart = sel?.index
            const selEnd =
              sel != null && typeof sel.index === 'number'
                ? sel.index + Math.max(0, sel.length ?? 0)
                : undefined

            const span = pickReplaceSpan(text, original, selStart, selEnd)
            if (!span) return false

            const { index, length } = span
            q.deleteText(index, length, 'user')
            insertPlainUserText(q, index, replacement)
            flashHighlight(q, index, replacement.length)
            try {
              q.setSelection(index + replacement.length, 0, 'silent')
            } catch {
              /* */
            }
            return true
          },
          getContent: () => {
            const q = quillRef.current?.getEditor()
            // Misma serialización que react-quill-new con useSemanticHTML por defecto (getSemanticHTML),
            // para no forzar setEditorContents en cada tecla y perder selección / formatos.
            try {
              return q?.getSemanticHTML?.() ?? q?.root?.innerHTML ?? ''
            } catch {
              return q?.root?.innerHTML ?? ''
            }
          },
          getPlainText: () => {
            const q = quillRef.current?.getEditor()
            if (!q) return ''
            return readPlain(q)
          },
          getSelectionPlain: () => {
            const q = quillRef.current?.getEditor()
            if (!q) return null
            const range = q.getSelection(true)
            if (!range || range.length <= 0) return null
            const start = range.index
            const end = range.index + range.length
            const text = q.getText(start, range.length)
            if (!text.trim()) return null
            return { start, end, text }
          },
          replacePlainRange: (start: number, end: number, replacement: string) => {
            const q = quillRef.current?.getEditor()
            if (!q) return false
            const len = end - start
            if (len < 0 || start < 0) return false
            q.deleteText(start, len, 'user')
            insertPlainUserText(q, start, replacement)
            flashHighlight(q, start, replacement.length)
            return true
          },
          replaceSelectionWithText: (replacement: string) => {
            const q = quillRef.current?.getEditor()
            if (!q) return false
            const range = q.getSelection(true)
            if (!range || range.length <= 0) return false
            const start = range.index
            const end = range.index + range.length
            q.deleteText(start, end - start, 'user')
            insertPlainUserText(q, start, replacement)
            flashHighlight(q, start, replacement.length)
            return true
          },
          focusPlaceholderInDocument: (placeholder: string) => {
            const q = quillRef.current?.getEditor()
            if (!q) return false
            const token = (placeholder || '').trim()
            if (!token) return false

            q.focus()

            let text = readPlain(q)
            let idx = text.indexOf(token)
            let matchLen = token.length

            if (idx === -1) {
              const html = valueRef.current || ''
              if (html.includes(token)) {
                try {
                  q.setContents(q.clipboard.convert({ html }), 'silent')
                  const nextHtml = q.getSemanticHTML()
                  lastEmittedHtmlRef.current = nextHtml
                  onChangeRef.current(nextHtml)
                  text = readPlain(q)
                  idx = text.indexOf(token)
                } catch {
                  /* */
                }
              }
            }

            if (idx === -1) return false

            q.setSelection(idx, matchLen, 'silent')

            const runScrollAndFlash = () => {
              try {
                scrollQuillRangeIntoView(q, idx, matchLen)
              } catch {
                /* */
              }
              flashHighlight(q, idx, matchLen, { jump: true })
            }
            requestAnimationFrame(() => {
              requestAnimationFrame(runScrollAndFlash)
            })

            return true
          },
        }
        try {
          const tb = editor.getModule('toolbar')
          quillRichTextDebug('API lista; Quill↔toolbar', {
            viewportEditorChrome,
            hasToolbarModule: Boolean(tb),
            toolbarSameRef: Boolean(
              toolbarContainerEl && tb?.container === toolbarContainerEl
            ),
            editorConnected: Boolean(editor.root?.isConnected),
            toolbarHostConnected: Boolean(toolbarContainerEl?.isConnected),
          })
        } catch (e) {
          quillRichTextDebug('API lista; no se pudo inspeccionar toolbar', e)
        }
        onEditorReady?.()
        return true
      } catch (err) {
        // El editor aún no está listo, intentaremos de nuevo en el próximo tick
        return false
      }
    }
    if (tryAttach()) return () => { editorApiRef.current = null }
    const id = setTimeout(() => {
      tryAttach()
    }, 100)
    return () => {
      clearTimeout(id)
      editorApiRef.current = null
    }
  }, [mounted, editorApiRef, onEditorReady, showQuill, toolbarContainerEl, viewportEditorChrome])

  const historyModule = useMemo(
    () => ({
      delay: 500,
      maxStack: 100,
      userOnly: true,
    }),
    []
  )

  /**
   * Handlers para toolbar externa: `resolveRangeForToolbar` usa `savedRange` cuando la selección
   * viva queda colapsada tras el foco; `formatText`/`formatLine` no dependen de `getSelection(true)`.
   */
  const toolbarHandlers = useMemo(() => {
    const beginToolbarHandlerWave = (label: string): boolean => {
      toolbarHandlerWaveRef.current += 1
      if (toolbarHandlerWaveRef.current > 1) {
        toolbarHandlerWaveRef.current -= 1
        quillRichTextDebug('toolbar: dedup (segundo listener mismo evento; ignorado)', {
          label,
          wave: toolbarHandlerWaveRef.current,
        })
        return false
      }
      return true
    }
    const endToolbarHandlerWave = () => {
      queueMicrotask(() => {
        toolbarHandlerWaveRef.current = Math.max(0, toolbarHandlerWaveRef.current - 1)
      })
    }
    /**
     * Quill, tras un handler, llama `this.update(range)` con un `range` capturado justo después de
     * `focus()` y **antes** de que restauremos la selección — suele estar colapsado y deja mal
     * `ql-active` y el valor del siguiente clic (negrita no se “quita”; el select de header parece “solo texto”).
     * Volvemos a pintar la toolbar con el rango real una vez que ha corrido esa `update` interna.
     */
    const refreshToolbarAfterQuillPaint = (q: any, r: QuillRange | null) => {
      if (!r || typeof r.index !== 'number') return
      queueMicrotask(() => {
        try {
          q.getModule('toolbar')?.update?.({ index: r.index, length: r.length })
        } catch {
          /* */
        }
      })
    }
    const clearToolbarPending = () => {
      toolbarPendingRangeRef.current = null
    }
    const syncInline = function (this: { quill: any }, format: string, value: boolean) {
      if (!beginToolbarHandlerWave(`inline:${format}`)) return
      try {
        const q = this.quill
        const r = resolveRangeForToolbar(q, toolbarPendingRangeRef, lastQuillRangeRef)
        if (!r) {
          quillRichTextDebug('toolbar: inline sin rango', { format, value })
          clearToolbarPending()
          return
        }
        if (r.length > 0) {
          q.formatText(r.index, r.length, { [format]: value } as Record<string, boolean>, 'user')
        } else {
          q.setSelection(r.index, 0, 'silent')
          q.format(format, value, 'user')
        }
        q.setSelection(r.index, r.length, 'silent')
        let fmtAtRange: Record<string, unknown> = {}
        try {
          fmtAtRange = q.getFormat(r) ?? {}
        } catch {
          /* */
        }
        quillRichTextDebug('toolbar: inline aplicado', {
          format,
          value,
          index: r.index,
          length: r.length,
          formatEnRango: fmtAtRange[format],
        })
        refreshToolbarAfterQuillPaint(q, r)
        clearToolbarPending()
      } finally {
        endToolbarHandlerWave()
      }
    }
    return {
      image: function () {
        if (!beginToolbarHandlerWave('image')) return
        try {
          toolbarPendingRangeRef.current = null
          openPhotoDialogRef.current()
        } finally {
          endToolbarHandlerWave()
        }
      },
      pageBreak: function (this: { quill: any }) {
        if (!beginToolbarHandlerWave('pageBreak')) return
        try {
          const q = this.quill
          const r = resolveRangeForToolbar(q, toolbarPendingRangeRef, lastQuillRangeRef)
          let index = 0
          if (r && typeof r.index === 'number') {
            index = r.index
          } else {
            try {
              index = Math.max(0, q.getLength() - 1)
            } catch {
              index = 0
            }
          }
          q.insertEmbed(index, 'pageBreak', true, 'user')
          q.setSelection(index + 1, 0, 'silent')
          refreshToolbarAfterQuillPaint(q, r ?? { index, length: 0 })
          clearToolbarPending()
        } catch (e) {
          quillRichTextDebug('toolbar: pageBreak', e)
          clearToolbarPending()
        } finally {
          endToolbarHandlerWave()
        }
      },
      header: function (this: { quill: any }, value: string | false) {
        if (!beginToolbarHandlerWave('header')) return
        try {
          const q = this.quill
          const r = resolveRangeForToolbar(q, toolbarPendingRangeRef, lastQuillRangeRef)
          if (!r) {
            quillRichTextDebug('toolbar: header sin rango', { value })
            toolbarPendingRangeRef.current = null
            return
          }
          const headerVal =
            value === false || value === '' ? false : Number.isNaN(Number(value)) ? value : Number(value)
          const lineLen = Math.max(r.length, 1)
          quillRichTextDebug('toolbar: header', { value, headerVal, index: r.index, length: r.length })
          q.formatLine(r.index, lineLen, { header: headerVal } as Record<string, string | number | false>, 'user')
          q.setSelection(r.index, r.length, 'silent')
          refreshToolbarAfterQuillPaint(q, r)
          toolbarPendingRangeRef.current = null
        } finally {
          endToolbarHandlerWave()
        }
      },
      align: function (this: { quill: any }, value: string | false) {
        if (!beginToolbarHandlerWave('align')) return
        try {
          const q = this.quill
          const r = resolveRangeForToolbar(q, toolbarPendingRangeRef, lastQuillRangeRef)
          if (!r) {
            quillRichTextDebug('toolbar: align sin rango', { value })
            toolbarPendingRangeRef.current = null
            return
          }
          const alignVal = value === false || value === '' ? false : value
          const lineLen = Math.max(r.length, 1)
          quillRichTextDebug('toolbar: align', { value: alignVal, index: r.index, length: r.length })
          q.formatLine(r.index, lineLen, { align: alignVal } as Record<string, string | false>, 'user')
          q.setSelection(r.index, r.length, 'silent')
          refreshToolbarAfterQuillPaint(q, r)
          toolbarPendingRangeRef.current = null
        } finally {
          endToolbarHandlerWave()
        }
      },
      list: function (this: { quill: any }, value: string) {
        if (!beginToolbarHandlerWave('list')) return
        try {
          const q = this.quill
          const r = resolveRangeForToolbar(q, toolbarPendingRangeRef, lastQuillRangeRef)
          if (!r) {
            quillRichTextDebug('toolbar: list sin rango', { value })
            toolbarPendingRangeRef.current = null
            return
          }
          const formats = q.getFormat(r)
          const lineLen = Math.max(r.length, 1)
          let listVal: string | false = value
          if (value === 'check') {
            if (formats.list === 'checked' || formats.list === 'unchecked') {
              listVal = false
            } else {
              listVal = 'unchecked'
            }
          }
          quillRichTextDebug('toolbar: list', { value, listVal, index: r.index, length: r.length })
          q.formatLine(r.index, lineLen, { list: listVal } as Record<string, string | false>, 'user')
          q.setSelection(r.index, r.length, 'silent')
          refreshToolbarAfterQuillPaint(q, r)
          toolbarPendingRangeRef.current = null
        } finally {
          endToolbarHandlerWave()
        }
      },
      clean: function (this: { quill: any }) {
        if (!beginToolbarHandlerWave('clean')) return
        try {
          const q = this.quill
          const r = resolveRangeForToolbar(q, toolbarPendingRangeRef, lastQuillRangeRef)
          if (!r) {
            quillRichTextDebug('toolbar: clean sin rango')
            toolbarPendingRangeRef.current = null
            return
          }
          if (r.length === 0) {
            q.setSelection(r.index, 0, 'silent')
            const formats = q.getFormat()
            Object.keys(formats).forEach((name) => {
              if (q.scroll.query(name, Scope.INLINE) != null) {
                q.format(name, false, 'user')
              }
            })
          } else {
            q.removeFormat(r.index, r.length, 'user')
          }
          quillRichTextDebug('toolbar: clean', { index: r.index, length: r.length })
          q.setSelection(r.index, r.length, 'silent')
          refreshToolbarAfterQuillPaint(q, r)
          toolbarPendingRangeRef.current = null
        } finally {
          endToolbarHandlerWave()
        }
      },
      bold: function (this: { quill: any }, value: boolean) {
        syncInline.call(this, 'bold', value)
      },
      italic: function (this: { quill: any }, value: boolean) {
        syncInline.call(this, 'italic', value)
      },
      underline: function (this: { quill: any }, value: boolean) {
        syncInline.call(this, 'underline', value)
      },
      strike: function (this: { quill: any }, value: boolean) {
        syncInline.call(this, 'strike', value)
      },
      font: function (this: { quill: any }, value: string | false) {
        if (!beginToolbarHandlerWave('font')) return
        try {
          const q = this.quill
          const r = resolveRangeForToolbar(q, toolbarPendingRangeRef, lastQuillRangeRef)
          if (!r) {
            quillRichTextDebug('toolbar: font sin rango', { value })
            clearToolbarPending()
            return
          }
          const fontVal = value === false || value === '' ? false : value
          if (r.length > 0) {
            q.formatText(r.index, r.length, { font: fontVal } as Record<string, string | false>, 'user')
          } else {
            q.setSelection(r.index, 0, 'silent')
            q.format('font', fontVal, 'user')
          }
          q.setSelection(r.index, r.length, 'silent')
          refreshToolbarAfterQuillPaint(q, r)
          clearToolbarPending()
        } finally {
          endToolbarHandlerWave()
        }
      },
      size: function (this: { quill: any }, value: string | false) {
        if (!beginToolbarHandlerWave('size')) return
        try {
          const q = this.quill
          const r = resolveRangeForToolbar(q, toolbarPendingRangeRef, lastQuillRangeRef)
          if (!r) {
            quillRichTextDebug('toolbar: size sin rango', { value })
            clearToolbarPending()
            return
          }
          const sizeVal = value === false || value === '' ? false : value
          if (r.length > 0) {
            q.formatText(r.index, r.length, { size: sizeVal } as Record<string, string | false>, 'user')
          } else {
            q.setSelection(r.index, 0, 'silent')
            q.format('size', sizeVal, 'user')
          }
          q.setSelection(r.index, r.length, 'silent')
          refreshToolbarAfterQuillPaint(q, r)
          clearToolbarPending()
        } finally {
          endToolbarHandlerWave()
        }
      },
    }
  }, [])

  const handleQuillSelectionChange = useCallback(
    (range: { index: number; length?: number } | null) => {
      // Solo rangos con texto: si guardamos length 0, un blur antes del clic pisa la selección real.
      if (range && typeof range.index === 'number' && (range.length ?? 0) > 0) {
        lastQuillRangeRef.current = {
          index: range.index,
          length: range.length as number,
        }
      }
    },
    []
  )

  /**
   * Ratón: el foco sale del editor antes del `click` de Quill; `getSelection` a menudo llega vacío o en subrango.
   * `pointerdown` en **document** (capture) corre antes que la mayoría de handlers y congela el rango.
   * Ctrl+B no pasa por la toolbar → por eso el teclado sí iba bien.
   */
  useEffect(() => {
    if (!viewportEditorChrome || !toolbarContainerEl) return
    const snap = (ev: Event) => {
      const target = ev.target
      if (!(target instanceof Node) || !toolbarContainerEl.contains(target)) return
      try {
        const q = quillRef.current?.getEditor()
        if (!q) return
        let r = q.getSelection(false) as QuillRange | null
        const last = lastQuillRangeRef.current
        if ((!r || r.length === 0) && last && last.length > 0) {
          r = last
        } else if (r && r.length > 0 && last && last.length > r.length) {
          r = last
        }
        if (r && r.length > 0) {
          const frozen = { index: r.index, length: r.length }
          lastQuillRangeRef.current = frozen
          toolbarPendingRangeRef.current = frozen
          quillRichTextDebug('toolbar: snapshot pointerdown', frozen)
        }
      } catch {
        /* */
      }
    }
    document.addEventListener('pointerdown', snap, true)
    return () => document.removeEventListener('pointerdown', snap, true)
  }, [viewportEditorChrome, toolbarContainerEl])

  // --- Modules: con viewport, `container` es HTMLElement ya poblado por `addControls` en el padre ---
  const modules = useMemo(() => {
    if (readOnly) return { toolbar: false as const, history: historyModule }
    if (viewportEditorChrome) {
      if (!toolbarContainerEl) return { toolbar: false as const, history: historyModule }
      return {
        toolbar: {
          container: toolbarContainerEl,
          handlers: toolbarHandlers,
        },
        history: historyModule,
      }
    }
    return {
      toolbar: {
        container: DOCUMENT_EDITOR_QUILL_TOOLBAR_GROUPS,
        handlers: toolbarHandlers,
      },
      history: historyModule,
    }
  }, [readOnly, viewportEditorChrome, toolbarContainerEl, historyModule, toolbarHandlers])

  const handlePhotoCapture = (photoBase64: string) => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor()
      const range = quill.getSelection(true)
      quill.insertEmbed(range.index, 'image', photoBase64, 'user')
      quill.setSelection(range.index + 1)
    }
    setPhotoDialogOpen(false)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (result && quillRef.current) {
        const quill = quillRef.current.getEditor()
        const range = quill.getSelection(true)
        quill.insertEmbed(range.index, 'image', result, 'user')
        quill.setSelection(range.index + 1)
      }
    }
    reader.readAsDataURL(file)
    setPhotoDialogOpen(false)
    
    // Limpiar input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!mounted) {
    return (
      <div className="w-full min-h-[300px] border rounded-lg p-4 flex items-center justify-center">
        <p className="text-muted-foreground">Cargando editor...</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        /* Contenedor del editor: ancho de hoja, márgenes e interlineado (sin paginación visual en pantalla). */
        .rich-text-editor-wrap {
          width: 100%;
          background: hsl(var(--muted) / 0.45);
        }
        .rich-text-editor {
          width: 100% !important;
          max-width: ${paperSpec.widthMm}mm !important;
          margin-left: auto !important;
          margin-right: auto !important;
          display: block !important;
          min-height: 300px !important;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.06);
        }
        .rich-text-editor .ql-container {
          min-height: ${paperSpec.heightMm}mm !important;
          font-size: 11pt;
          line-height: 1.5 !important;
          width: 100% !important;
          display: block !important;
          border: none !important;
          border-radius: 0 0 0.5rem 0.5rem;
          background: hsl(var(--background)) !important;
        }
        .rich-text-editor .ql-editor {
          box-sizing: border-box !important;
          position: relative !important;
          min-height: ${paperSpec.heightMm}mm !important;
          width: 100% !important;
          padding: 25mm 20mm 25mm 20mm !important;
          padding-bottom: 30mm !important;
          font-family: inherit;
        }
        /* Quill Snow fija left/right en 15px; alinear con márgenes de la “hoja” (padding del editor) */
        .rich-text-editor .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
          left: 25mm !important;
          right: 20mm !important;
          top: 25mm !important;
        }
        .rich-text-editor .ql-editor .${NELAI_QUILL_PAGE_BREAK_CLASS} {
          display: block !important;
          box-sizing: border-box !important;
          margin: 18px 0 !important;
          min-height: 28px !important;
          height: auto !important;
          padding: 12px 0 !important;
          border: none !important;
          border-top: 2px dashed hsl(var(--border)) !important;
          background: hsl(var(--muted) / 0.12) !important;
          position: relative !important;
        }
        .rich-text-editor .ql-editor .${NELAI_QUILL_PAGE_BREAK_CLASS}::after {
          content: 'Salto de página';
          position: absolute;
          left: 50%;
          top: 0;
          transform: translate(-50%, -55%);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: hsl(var(--muted-foreground));
          background: hsl(var(--background));
          padding: 0 8px;
          pointer-events: none;
        }
        /* Toolbar horizontal compacta como Google Docs */
        .rich-text-editor .ql-toolbar {
          border: none !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
          padding: 0.5rem 1rem !important;
          background: hsl(var(--background)) !important;
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 0 !important;
        }
        .rich-text-editor .ql-toolbar .ql-formats {
          margin-right: 0.5rem !important;
        }
        .rich-text-editor .ql-toolbar button {
          padding: 0.35rem 0.5rem !important;
        }
        .rich-text-editor .ql-toolbar .ql-picker {
          padding: 0.25rem 0.5rem !important;
        }
        .rich-text-editor .ql-snow {
          width: 100% !important;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border)) !important;
        }
        .rich-text-editor .ql-snow .ql-toolbar {
          border-radius: 0.5rem 0.5rem 0 0 !important;
        }
        .rich-text-editor .ql-snow .ql-toolbar,
        .rich-text-editor .ql-snow .ql-container,
        .rich-text-editor .ql-snow .ql-editor {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        /* Encabezados con mejor jerarquía visual */
        .rich-text-editor .ql-editor h1 { font-size: 1.75rem; font-weight: 600; margin: 1rem 0 0.5rem; }
        .rich-text-editor .ql-editor h2 { font-size: 1.35rem; font-weight: 600; margin: 0.75rem 0 0.5rem; }
        .rich-text-editor .ql-editor h3 { font-size: 1.15rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        /* Fuentes (whitelist registerQuillDocumentFormats) */
        .rich-text-editor .ql-editor .ql-font-arial { font-family: Arial, Helvetica, sans-serif; }
        .rich-text-editor .ql-editor .ql-font-georgia { font-family: Georgia, 'Times New Roman', serif; }
        .rich-text-editor .ql-editor .ql-font-times-new-roman { font-family: 'Times New Roman', Times, serif; }
        .rich-text-editor .ql-editor .ql-font-courier-new { font-family: 'Courier New', Courier, monospace; }
        .rich-text-editor .ql-editor .ql-font-verdana { font-family: Verdana, Geneva, sans-serif; }
        .rich-text-editor .ql-editor .ql-font-serif { font-family: Georgia, 'Times New Roman', serif; }
        .rich-text-editor .ql-editor .ql-font-monospace { font-family: 'Segoe UI Mono', Consolas, monospace; }
        /* Tamaños (whitelist + small/large/huge de Quill) */
        .rich-text-editor .ql-editor .ql-size-small { font-size: 0.85em; }
        .rich-text-editor .ql-editor .ql-size-12px { font-size: 12px; }
        .rich-text-editor .ql-editor .ql-size-14px { font-size: 14px; }
        .rich-text-editor .ql-editor .ql-size-large { font-size: 1.35em; }
        .rich-text-editor .ql-editor .ql-size-18px { font-size: 18px; }
        .rich-text-editor .ql-editor .ql-size-huge { font-size: 2em; }
        /* Highlight suave para texto modificado por IA */
        .rich-text-editor .ql-editor span[style*="background"] {
          border-radius: 2px;
          padding: 1px 0;
          transition: background-color 0.8s ease;
        }
        /* Toolbar externa: ocultar hueco vacío si Quill dejara un toolbar en el bloque del editor */
        .document-editor-quill-body-only .ql-snow .ql-toolbar {
          display: none !important;
        }
        .document-editor-quill-body-only .ql-snow {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 auto !important;
          min-height: 0 !important;
        }
        .document-editor-quill-body-only .ql-container {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          overflow-y: auto !important;
        }
        /*
         * Toolbar externa: Quill Snow fija stroke/fill en #444 (quill.snow.css).
         * Con --background oscuro eso casi no se ve → parece una franja vacía.
         */
        .document-editor-quill-toolbar-host {
          background: hsl(var(--background)) !important;
          color: hsl(var(--foreground)) !important;
          overflow: visible !important;
        }
        .document-editor-quill-toolbar-host .ql-toolbar.ql-snow {
          border: none !important;
          border-bottom: 1px solid hsl(var(--border)) !important;
          padding: 0.4rem 0.5rem !important;
          background: hsl(var(--background)) !important;
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          overflow: visible !important;
        }
        .document-editor-quill-toolbar-host .ql-picker {
          position: relative;
        }
        .document-editor-quill-toolbar-host .ql-picker.ql-expanded {
          z-index: 45;
        }
        .document-editor-quill-toolbar-host .ql-toolbar .ql-formats {
          margin-right: 0.5rem !important;
        }
        .document-editor-quill-toolbar-host .ql-snow .ql-stroke {
          stroke: hsl(var(--foreground)) !important;
        }
        .document-editor-quill-toolbar-host .ql-snow .ql-stroke-miter {
          stroke: hsl(var(--foreground)) !important;
        }
        .document-editor-quill-toolbar-host .ql-snow .ql-fill,
        .document-editor-quill-toolbar-host .ql-snow .ql-stroke.ql-fill {
          fill: hsl(var(--foreground)) !important;
        }
        .document-editor-quill-toolbar-host .ql-snow .ql-empty {
          fill: none !important;
        }
        .document-editor-quill-toolbar-host .ql-toolbar button:hover .ql-stroke,
        .document-editor-quill-toolbar-host .ql-toolbar button:focus .ql-stroke,
        .document-editor-quill-toolbar-host .ql-toolbar button.ql-active .ql-stroke {
          stroke: hsl(var(--primary)) !important;
        }
        .document-editor-quill-toolbar-host .ql-toolbar button:hover .ql-fill,
        .document-editor-quill-toolbar-host .ql-toolbar button:focus .ql-fill,
        .document-editor-quill-toolbar-host .ql-toolbar button.ql-active .ql-fill {
          fill: hsl(var(--primary)) !important;
        }
        .document-editor-quill-toolbar-host .ql-picker-label {
          color: hsl(var(--foreground)) !important;
        }
        .document-editor-quill-toolbar-host .ql-toolbar button.ql-pageBreak {
          width: 30px;
          position: relative;
        }
        .document-editor-quill-toolbar-host .ql-toolbar button.ql-pageBreak::after {
          content: '↧';
          font-size: 15px;
          line-height: 1;
          opacity: 0.9;
        }
        .rich-text-editor .ql-toolbar button.ql-pageBreak {
          width: 30px;
        }
        .rich-text-editor .ql-toolbar button.ql-pageBreak::after {
          content: '↧';
          font-size: 15px;
          line-height: 1;
          opacity: 0.9;
        }
        .document-editor-quill-toolbar-host .ql-picker-options {
          z-index: 50 !important;
          background: hsl(var(--popover)) !important;
          color: hsl(var(--popover-foreground)) !important;
          border: 1px solid hsl(var(--border)) !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18) !important;
        }
        .document-editor-quill-toolbar-host .ql-picker-item {
          color: hsl(var(--popover-foreground)) !important;
        }
        /* Aislar botones de la toolbar de estilos globales tipo Tailwind/shadcn */
        .document-editor-quill-toolbar-host .ql-toolbar button {
          box-sizing: border-box !important;
          display: inline-block !important;
          width: auto !important;
          height: auto !important;
          min-height: 1.75rem !important;
          min-width: 1.75rem !important;
          padding: 0.2rem 0.35rem !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          cursor: pointer !important;
        }
        .document-editor-quill-toolbar-host .ql-toolbar .ql-picker-label {
          display: inline-flex !important;
          align-items: center !important;
        }
      `}</style>
      <div
        ref={(el) => {
          if (surfaceRef) (surfaceRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        }}
        className={cn(
          'rich-text-editor-root w-full rounded-lg border border-border overflow-hidden flex flex-col min-h-0',
          viewportEditorChrome && 'flex-1',
          className
        )}
      >
        <div
          className={cn(
            'rich-text-editor-wrap overflow-x-auto px-2 py-4 sm:px-4 sm:py-6',
            viewportEditorChrome &&
              'flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden py-3'
          )}
        >
          <div
            className={cn(
              'rich-text-editor min-h-[350px] bg-background rounded-lg border border-border',
              viewportEditorChrome && 'document-editor-quill-body-only flex-1 flex flex-col min-h-0'
            )}
          >
            {showQuill ? (
              <ReactQuill
                ref={quillRef}
                theme="snow"
                defaultValue={value || ''}
                onChange={handleQuillChange}
                onChangeSelection={handleQuillSelectionChange}
                modules={modules}
                placeholder={placeholder}
                readOnly={readOnly}
              />
            ) : (
              <div className="flex min-h-[280px] flex-1 items-center justify-center text-sm text-muted-foreground">
                Preparando barra de formato…
              </div>
            )}
          </div>
        </div>
        {!viewportEditorChrome && (
          <div className="doc-stats-bar flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-background/95 backdrop-blur-sm px-3 py-2 text-[11px] text-muted-foreground supports-[backdrop-filter]:bg-background/80">
            <span className="leading-snug">
              <strong className="text-foreground">{paperSpec.label}</strong> · márgenes ~25 / 20 / 25 mm ·
              interlineado <strong className="text-foreground">1,5</strong> · paginación en vivo
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground/90">
              {docStats.chars.toLocaleString('es-MX')} caracteres · ≈ {docStats.pages} página
              {docStats.pages === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {/* Input oculto para seleccionar archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Dialog para seleccionar método de imagen */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Imagen</DialogTitle>
            <DialogDescription>
              Selecciona cómo deseas agregar la imagen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  fileInputRef.current?.click()
                }}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <ImageIcon className="h-6 w-6" />
                <span>Desde Archivo</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPhotoDialogOpen(false)
                  setCameraDialogOpen(true)
                }}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <Camera className="h-6 w-6" />
                <span>Desde Cámara</span>
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={() => setPhotoDialogOpen(false)}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para capturar foto desde cámara */}
      <Dialog open={cameraDialogOpen} onOpenChange={setCameraDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <PhotoCapture
            onCapture={(photoBase64) => {
              handlePhotoCapture(photoBase64)
              setCameraDialogOpen(false)
            }}
            onCancel={() => setCameraDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
