/**
 * Vista previa del PDF generado con el mismo pipeline que al guardar (generatePDF + convertQuillHTMLToPDF).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { generatePDF } from '@/services/pdf/PDFGenerator'
import type { PaperFormatId } from '@/constants/paperFormat'
import { normalizePaperFormat } from '@/constants/paperFormat'
import { ensurePdfjsWorker, pdfjs } from '@/utils/pdfjsWorker'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const DEBOUNCE_MS = 550

export type DocumentEditorPdfPreviewProps = {
  html: string
  title: string
  subtitle: string
  author: string
  paperFormat: PaperFormatId
  className?: string
}

export function DocumentEditorPdfPreview({
  html,
  title,
  subtitle,
  author,
  paperFormat,
  className,
}: DocumentEditorPdfPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const generationRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runPreview = useCallback(async () => {
    const trimmed = (html || '').trim()
    if (!trimmed) {
      setError(null)
      setPageCount(0)
      setLoading(false)
      if (containerRef.current) containerRef.current.innerHTML = ''
      return
    }

    const gen = ++generationRef.current
    setLoading(true)
    setError(null)

    try {
      const paper = normalizePaperFormat(paperFormat)
      const { pdfBase64 } = await generatePDF({
        metadata: {
          title: title || 'Sin título',
          description: subtitle || '',
          author: author || 'criterIA',
          createdAt: new Date().toISOString(),
          paperFormat: paper,
        },
        content: {
          title: title || 'Sin título',
          subtitle: subtitle || undefined,
          sections: [{ title: 'Contenido', content: trimmed, isTable: false }],
        },
      })

      if (gen !== generationRef.current) return

      ensurePdfjsWorker()
      const binary = atob(pdfBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const pdf = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise
      if (gen !== generationRef.current) return

      setPageCount(pdf.numPages)
      const host = containerRef.current
      if (!host) return
      host.innerHTML = ''

      const scale = 1.22

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        if (gen !== generationRef.current) return
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        await page.render({ canvasContext: ctx, viewport }).promise
        if (gen !== generationRef.current) return

        const wrap = document.createElement('div')
        wrap.className =
          'mx-auto mb-4 max-w-full overflow-hidden rounded-md border border-border bg-white shadow-sm last:mb-0'
        wrap.appendChild(canvas)
        host.appendChild(wrap)
      }
    } catch (e) {
      if (gen !== generationRef.current) return
      setError(e instanceof Error ? e.message : 'Error al generar la vista previa')
      setPageCount(0)
      if (containerRef.current) containerRef.current.innerHTML = ''
    } finally {
      if (gen === generationRef.current) setLoading(false)
    }
  }, [html, title, subtitle, author, paperFormat])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void runPreview()
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      generationRef.current += 1
    }
  }, [runPreview])

  return (
    <section
      className={cn(
        'mt-6 flex min-h-[120px] flex-col gap-2 border-t border-border pt-4',
        className
      )}
      aria-label="Vista previa del PDF"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Vista previa PDF</span>
        <span className="tabular-nums">
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Generando…
            </span>
          ) : error ? (
            <span className="text-destructive">{error}</span>
          ) : pageCount > 0 ? (
            `${pageCount} página${pageCount === 1 ? '' : 's'} · misma composición que al guardar`
          ) : (
            'Sin contenido'
          )}
        </span>
      </div>
      <div
        ref={containerRef}
        className="max-h-[min(52vh,640px)] overflow-y-auto rounded-md border border-dashed border-border/80 bg-muted/20 p-3"
      />
    </section>
  )
}
