import { useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'

export type HeadingOutlineItem = { level: 1 | 2 | 3; text: string }

/** Extrae títulos H1–H3 del HTML del documento (orden de aparición). */
export function extractHeadingOutline(html: string): HeadingOutlineItem[] {
  const safe = (html || '').trim() || '<p></p>'
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(safe, 'text/html')
  } catch {
    return []
  }
  return Array.from(doc.body.querySelectorAll('h1, h2, h3')).map((el) => {
    const n = Number(el.tagName.slice(1)) as 1 | 2 | 3
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220)
    return { level: (n >= 1 && n <= 3 ? n : 1) as 1 | 2 | 3, text: text || 'Sin título' }
  })
}

function scrollToHeadingInEditor(surface: HTMLElement | null, index: number): void {
  if (!surface || index < 0) return
  const editor = surface.querySelector('.ql-editor')
  if (!editor) return
  const headings = editor.querySelectorAll('h1, h2, h3')
  const el = headings.item(index)
  if (!(el instanceof HTMLElement)) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  try {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  } catch {
    /* */
  }
}

export interface DocumentHeadingOutlineProps {
  html: string
  /** Nodo que envuelve el editor (contiene `.ql-editor`). */
  editorSurfaceRef: React.RefObject<HTMLElement | null>
  className?: string
  /** Si se llama al elegir un ítem (p. ej. cerrar sheet / sidebar). */
  onNavigate?: () => void
  /** Muestra el título “Mapa del documento” (desactivar si el chrome padre ya lo indica). */
  showHeading?: boolean
}

export function DocumentHeadingOutline({
  html,
  editorSurfaceRef,
  className,
  onNavigate,
  showHeading = true,
}: DocumentHeadingOutlineProps) {
  const items = useMemo(() => extractHeadingOutline(html), [html])

  const handlePick = useCallback(
    (ix: number) => {
      scrollToHeadingInEditor(editorSurfaceRef.current, ix)
      onNavigate?.()
    },
    [editorSurfaceRef, onNavigate]
  )

  return (
    <nav className={cn('flex flex-col gap-2', className)} aria-label="Índice del documento">
      {showHeading ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mapa del documento</p>
      ) : null}
      {items.length === 0 ? (
        <p className="text-xs leading-snug text-muted-foreground">
          Aún no hay títulos. Usa el desplegable de encabezado (Título 1–3) para estructurar el texto; aparecerán aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item, ix) => (
            <li key={`${ix}-${item.level}-${item.text.slice(0, 24)}`}>
              <button
                type="button"
                className={cn(
                  'w-full rounded-md px-2 py-1.5 text-left text-xs leading-snug text-foreground transition-colors hover:bg-muted',
                  item.level === 2 && 'pl-3 text-[11px]',
                  item.level === 3 && 'pl-5 text-[11px] text-muted-foreground'
                )}
                onClick={() => handlePick(ix)}
              >
                <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">H{item.level}</span>
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
