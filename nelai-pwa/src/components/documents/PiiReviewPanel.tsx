import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { PiiMatch, PiiReviewRow } from '@/services/privacy/piiTypes'
import { anonymizeDocAndMessageWithMatches, anonymizeWithMatches } from '@/services/privacy/piiAnonymize'
import { combineManualAndAuto } from '@/services/privacy/manualSelectionMerge'
import { Shield, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const MAX_MANUAL_SPAN = 6000

export type PiiReviewVariant = 'pdf' | 'send'

export type PiiReviewConfirmPayload =
  | { scope: 'pdf'; sanitized: string; rows: PiiReviewRow[] }
  | { scope: 'send'; docSan: string; msgSan: string; rows: PiiReviewRow[] }

export interface PiiReviewPanelProps {
  /** Si es false, no se reinicia el estado interno hasta el próximo true. */
  active: boolean
  variant: PiiReviewVariant
  title: string
  description: string
  rows: PiiReviewRow[]
  sanitizedPreview: string
  pdfSelection?: { rawText: string; matches: PiiMatch[] }
  sendSelection?: { docPlain: string; msgPlain: string; docMatches: PiiMatch[]; msgMatches: PiiMatch[] }
  showInsertInEditor?: boolean
  insertInEditor: boolean
  onInsertInEditorChange: (v: boolean) => void
  onConfirm: (payload: PiiReviewConfirmPayload) => void
  onDismiss: () => void
  confirmLabel?: string
  className?: string
}

function getTextOffsetsFromSelection(root: HTMLElement | null): { start: number; end: number } | null {
  if (!root) return null
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const r = document.createRange()
  r.selectNodeContents(root)
  r.setEnd(range.startContainer, range.startOffset)
  const start = r.toString().length
  const end = start + range.toString().length
  if (end <= start) return null
  return { start, end }
}

export function PiiReviewPanel({
  active,
  variant,
  title,
  description,
  rows,
  sanitizedPreview: _unusedSanitizedPreview,
  pdfSelection,
  sendSelection,
  showInsertInEditor,
  insertInEditor,
  onInsertInEditorChange,
  onConfirm,
  onDismiss,
  confirmLabel = 'Confirmar y continuar',
  className,
}: PiiReviewPanelProps) {
  const hasAutoRows = Boolean(
    (variant === 'pdf' && pdfSelection && pdfSelection.matches.length > 0) ||
      (variant === 'send' && sendSelection && sendSelection.docMatches.length + sendSelection.msgMatches.length > 0)
  )

  const showManualPanel = Boolean(
    (variant === 'pdf' && pdfSelection?.rawText) || (variant === 'send' && sendSelection)
  )

  const selectionCount = useMemo(() => {
    if (variant === 'pdf' && pdfSelection) return pdfSelection.matches.length
    if (variant === 'send' && sendSelection)
      return sendSelection.docMatches.length + sendSelection.msgMatches.length
    return rows.length
  }, [variant, pdfSelection, sendSelection, rows.length])

  const [included, setIncluded] = useState<boolean[]>([])
  const [manualPdf, setManualPdf] = useState<PiiMatch[]>([])
  const [manualDoc, setManualDoc] = useState<PiiMatch[]>([])
  const [manualMsg, setManualMsg] = useState<PiiMatch[]>([])

  const pdfOriginalRef = useRef<HTMLPreElement>(null)
  const sendDocRef = useRef<HTMLPreElement>(null)
  const sendMsgRef = useRef<HTMLPreElement>(null)
  const lastSendTargetRef = useRef<'doc' | 'msg'>('doc')

  useEffect(() => {
    if (!active) return
    const n = selectionCount > 0 ? selectionCount : 0
    setIncluded(Array.from({ length: n }, () => true))
    setManualPdf([])
    setManualDoc([])
    setManualMsg([])
  }, [active, selectionCount])

  const toggleRow = (index: number) => {
    setIncluded((prev) => {
      const next = [...prev]
      if (index < 0 || index >= next.length) return prev
      next[index] = !next[index]
      return next
    })
  }

  const selectAll = (value: boolean) => {
    setIncluded((prev) => prev.map(() => value))
  }

  const addManualPdf = () => {
    if (!pdfSelection) return
    const off = getTextOffsetsFromSelection(pdfOriginalRef.current)
    if (!off) {
      toast.message('Selecciona texto en el original', {
        description: 'Marca un fragmento en el cuadro y vuelve a pulsar el botón.',
      })
      return
    }
    const len = off.end - off.start
    if (len > MAX_MANUAL_SPAN) {
      toast.error(`La selección supera ${MAX_MANUAL_SPAN} caracteres`)
      return
    }
    const text = pdfSelection.rawText.slice(off.start, off.end)
    if (!text.trim()) return
    const m: PiiMatch = { kind: 'MANUAL', start: off.start, end: off.end, text }
    setManualPdf((prev) => {
      if (prev.some((p) => p.start === m.start && p.end === m.end)) return prev
      return [...prev, m]
    })
    window.getSelection()?.removeAllRanges()
    toast.success('Fragmento añadido para sanitizar')
  }

  const addManualSend = () => {
    if (!sendSelection) return
    const ref = lastSendTargetRef.current === 'doc' ? sendDocRef : sendMsgRef
    const plain = lastSendTargetRef.current === 'doc' ? sendSelection.docPlain : sendSelection.msgPlain
    const off = getTextOffsetsFromSelection(ref.current)
    if (!off) {
      toast.message('Selecciona texto en documento o mensaje', {
        description: 'Haz clic en el bloque correspondiente, selecciona texto y pulsa el botón.',
      })
      return
    }
    const len = off.end - off.start
    if (len > MAX_MANUAL_SPAN) {
      toast.error(`La selección supera ${MAX_MANUAL_SPAN} caracteres`)
      return
    }
    const text = plain.slice(off.start, off.end)
    if (!text.trim()) return
    const m: PiiMatch = { kind: 'MANUAL', start: off.start, end: off.end, text }
    if (lastSendTargetRef.current === 'doc') {
      setManualDoc((prev) => {
        if (prev.some((p) => p.start === m.start && p.end === m.end)) return prev
        return [...prev, m]
      })
    } else {
      setManualMsg((prev) => {
        if (prev.some((p) => p.start === m.start && p.end === m.end)) return prev
        return [...prev, m]
      })
    }
    window.getSelection()?.removeAllRanges()
    toast.success('Fragmento añadido para sanitizar')
  }

  const handleConfirmClick = () => {
    if (variant === 'pdf' && pdfSelection) {
      const expected = pdfSelection.matches.length
      const inc = included.length === expected ? included : Array.from({ length: expected }, () => true)
      const autoPart =
        pdfSelection.matches.length > 0 ? pdfSelection.matches.filter((_, i) => !!inc[i]) : []
      const merged = combineManualAndAuto(manualPdf, autoPart)
      const { sanitized, rows: outRows } = anonymizeWithMatches(pdfSelection.rawText, merged)
      onConfirm({ scope: 'pdf', sanitized, rows: outRows })
      return
    }

    if (variant === 'send' && sendSelection) {
      const ds = [...sendSelection.docMatches].sort((a, b) => a.start - b.start)
      const ms = [...sendSelection.msgMatches].sort((a, b) => a.start - b.start)
      const expected = ds.length + ms.length
      const inc = included.length === expected ? included : Array.from({ length: expected }, () => true)
      const docAuto = ds.length ? ds.filter((_, i) => !!inc[i]) : []
      const msgAuto = ms.length ? ms.filter((_, i) => !!inc[ds.length + i]) : []
      const docMerged = combineManualAndAuto(manualDoc, docAuto)
      const msgMerged = combineManualAndAuto(manualMsg, msgAuto)
      const { docSan, msgSan, rows: outRows } = anonymizeDocAndMessageWithMatches(
        sendSelection.docPlain,
        sendSelection.msgPlain,
        docMerged,
        msgMerged
      )
      onConfirm({ scope: 'send', docSan, msgSan, rows: outRows })
    }
  }

  return (
    <div className={cn('flex flex-col min-h-0 h-full bg-background', className)}>
      <div className="shrink-0 border-b bg-muted/30 px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
            <Shield className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-left text-base font-semibold leading-tight text-foreground">{title}</h3>
            <p className="text-left text-xs leading-relaxed text-muted-foreground">{description}</p>
            {hasAutoRows ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Desmarca las filas que <strong className="text-foreground">no</strong> quieras sustituir; la vista previa
                se actualiza al instante.
              </p>
            ) : null}
            {showManualPanel ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                También puedes <strong className="text-foreground">seleccionar texto en el original</strong> y pulsar
                «Añadir…» para crear un placeholder{' '}
                <code className="text-[10px] bg-muted px-0.5 rounded">CRITERIA_MANUAL_*</code> aunque no lo haya
                detectado el sistema.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 space-y-4">
        {rows.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Sustituciones propuestas ({rows.length})
              </p>
              {hasAutoRows ? (
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => selectAll(true)}>
                    Todas
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => selectAll(false)}>
                    Ninguna
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="max-h-48 sm:max-h-56 overflow-y-auto rounded-md border bg-background">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur border-b">
                  <tr>
                    {hasAutoRows ? (
                      <th className="p-2 font-semibold w-10 text-center" title="Aplicar sustitución">
                        ✓
                      </th>
                    ) : null}
                    <th className="p-2 font-semibold w-[4.5rem]">Tipo</th>
                    <th className="p-2 font-semibold">Original</th>
                    <th className="p-2 font-semibold">Placeholder</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.placeholder}-${i}`} className="border-b border-border/60 last:border-0">
                      {hasAutoRows ? (
                        <td className="p-2 align-middle text-center">
                          <Checkbox
                            checked={!!included[i]}
                            onCheckedChange={() => toggleRow(i)}
                            aria-label={`Aplicar sustitución ${i + 1}`}
                          />
                        </td>
                      ) : null}
                      <td className="p-2 align-top text-muted-foreground whitespace-nowrap">
                        {r.kind}
                        {r.source ? (
                          <span className="block text-[9px] normal-case opacity-70">
                            {r.source === 'document' ? 'doc' : r.source === 'pdf_import' ? 'pdf' : 'msg'}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2 align-top break-all font-mono text-destructive/90">{r.original}</td>
                      <td className="p-2 align-top break-all font-mono text-primary">{r.placeholder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-3 text-sm text-amber-50/95 leading-relaxed">
            <p className="font-semibold text-amber-100">Sin coincidencias automáticas</p>
            <p className="text-muted-foreground text-[13px]">
              No hubo patrones reconocidos; el texto es el del PDF o del editor. Puedes igualmente{' '}
              <strong className="text-foreground">marcar fragmentos a mano</strong> en el bloque de original más abajo.
            </p>
          </div>
        )}

        {showManualPanel && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Selección manual</p>
            <p className="text-[10px] text-muted-foreground leading-snug">
              El resaltado debe hacerse sobre el <strong className="text-foreground">texto original</strong> (no sobre
              la vista previa sanitizada), para que las posiciones coincidan con el documento.
            </p>
            {variant === 'pdf' && pdfSelection ? (
              <>
                <div className="max-h-[55vh] overflow-y-auto overflow-x-auto rounded-md border bg-background">
                  <pre
                    ref={pdfOriginalRef}
                    className="select-text cursor-text whitespace-pre-wrap break-words p-2 font-mono text-[11px] leading-relaxed text-foreground"
                  >
                    {pdfSelection.rawText}
                  </pre>
                </div>
                <Button type="button" variant="secondary" size="sm" className="h-8 text-[11px]" onClick={addManualPdf}>
                  Añadir texto seleccionado
                </Button>
              </>
            ) : null}
            {variant === 'send' && sendSelection ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground">Documento (original)</p>
                    <div className="max-h-[45vh] overflow-y-auto overflow-x-auto rounded-md border bg-background">
                      <pre
                        ref={sendDocRef}
                        onMouseDown={() => {
                          lastSendTargetRef.current = 'doc'
                        }}
                        className="select-text cursor-text whitespace-pre-wrap break-words p-2 font-mono text-[10px] leading-relaxed"
                      >
                        {sendSelection.docPlain || '(vacío)'}
                      </pre>
                    </div>
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-[10px] font-medium text-muted-foreground">Mensaje (original)</p>
                    <div className="max-h-[45vh] overflow-y-auto overflow-x-auto rounded-md border bg-background">
                      <pre
                        ref={sendMsgRef}
                        onMouseDown={() => {
                          lastSendTargetRef.current = 'msg'
                        }}
                        className="select-text cursor-text whitespace-pre-wrap break-words p-2 font-mono text-[10px] leading-relaxed"
                      >
                        {sendSelection.msgPlain}
                      </pre>
                    </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 text-[11px] sm:col-span-2"
                  onClick={addManualSend}
                >
                  Añadir texto seleccionado (último bloque enfocado: doc. o mens.)
                </Button>
              </div>
            ) : null}
            {(manualPdf.length > 0 || manualDoc.length > 0 || manualMsg.length > 0) && (
              <ul className="space-y-1.5 text-[10px]">
                {variant === 'pdf'
                  ? manualPdf.map((m, i) => (
                      <li
                        key={`${m.start}-${m.end}-${i}`}
                        className="flex items-start justify-between gap-2 rounded border bg-background/80 px-2 py-1.5"
                      >
                        <span className="min-w-0 break-all font-mono text-muted-foreground">
                          {m.text.slice(0, 120)}
                          {m.text.length > 120 ? '…' : ''}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                          aria-label="Quitar"
                          onClick={() => setManualPdf((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))
                  : null}
                {variant === 'send' &&
                  manualDoc.map((m, i) => (
                    <li
                      key={`doc-${m.start}-${m.end}-${i}`}
                      className="flex items-start justify-between gap-2 rounded border bg-background/80 px-2 py-1.5"
                    >
                      <span className="text-[9px] text-primary font-semibold shrink-0">Doc</span>
                      <span className="min-w-0 flex-1 break-all font-mono text-muted-foreground">
                        {m.text.slice(0, 100)}
                        {m.text.length > 100 ? '…' : ''}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        aria-label="Quitar"
                        onClick={() => setManualDoc((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                {variant === 'send' &&
                  manualMsg.map((m, i) => (
                    <li
                      key={`msg-${m.start}-${m.end}-${i}`}
                      className="flex items-start justify-between gap-2 rounded border bg-background/80 px-2 py-1.5"
                    >
                      <span className="text-[9px] text-primary font-semibold shrink-0">Msg</span>
                      <span className="min-w-0 flex-1 break-all font-mono text-muted-foreground">
                        {m.text.slice(0, 100)}
                        {m.text.length > 100 ? '…' : ''}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        aria-label="Quitar"
                        onClick={() => setManualMsg((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {showInsertInEditor ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <Checkbox
              id="pii-insert-editor-panel"
              checked={insertInEditor}
              onCheckedChange={(c) => onInsertInEditorChange(c === true)}
            />
            <Label htmlFor="pii-insert-editor-panel" className="text-xs leading-snug cursor-pointer">
              Insertar texto sanitizado en el documento (recomendado). Si lo desmarcas, el texto solo se añadirá al
              próximo mensaje que envíes a la IA.
            </Label>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t bg-background px-4 py-3 sm:px-5 flex flex-row justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDismiss}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleConfirmClick}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
