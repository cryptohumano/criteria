import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, FileText, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ResearchEvidenceLogEntry } from '@/types/documents'
import { formatResearchEvidenceUrlDisplay } from '@/utils/researchEvidenceLog'
import { toast } from 'sonner'

function EvidenceCommentField({
  entryId,
  value,
  onPersist,
}: {
  entryId: string
  value: string
  onPersist: (id: string, comment: string) => void | Promise<void>
}) {
  const [local, setLocal] = useState(value ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal(value ?? '')
  }, [entryId, value])

  const flush = useCallback(
    (text: string) => {
      void Promise.resolve(onPersist(entryId, text)).catch((e) =>
        console.error('[ResearchEvidenceLogTable] guardar nota', e)
      )
    },
    [entryId, onPersist]
  )

  const schedule = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        flush(text)
      }, 650)
    },
    [flush]
  )

  return (
    <Textarea
      value={local}
      onChange={(e) => {
        const t = e.target.value
        setLocal(t)
        schedule(t)
      }}
      onBlur={() => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current)
          debounceRef.current = null
        }
        flush(local)
      }}
      rows={2}
      className="min-h-[2.5rem] max-h-24 w-full resize-y bg-background text-xs"
      placeholder="Nota…"
    />
  )
}

export interface ResearchEvidenceLogTableProps {
  entries: ResearchEvidenceLogEntry[]
  onPersistUserComment: (entryId: string, userComment: string) => Promise<void>
}

/** Anchos fijos en % (colgroup + table-fixed): las clases Tailwind en `<col>` suelen no aplicarse y desalinean cabecera/celdas. */
const COLGROUP_STYLE = (
  <colgroup>
    <col style={{ width: '10%' }} />
    <col style={{ width: '22%' }} />
    <col style={{ width: '13%' }} />
    <col style={{ width: '13%' }} />
    <col style={{ width: '14%' }} />
    <col style={{ width: '12%' }} />
    <col style={{ width: '5%' }} />
    <col style={{ width: '11%' }} />
  </colgroup>
)

export function ResearchEvidenceLogTable({ entries, onPersistUserComment }: ResearchEvidenceLogTableProps) {
  const copyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }, [])

  const cell = 'border-b border-border/60 px-3 py-2 align-top'
  const headBase =
    'border-b border-border bg-muted/90 px-3 py-2.5 text-xs font-medium text-foreground backdrop-blur-sm'

  return (
    <div className="rounded-lg border border-border/80 bg-background/90 shadow-sm">
    <table className="table-fixed w-full min-w-[1080px] border-collapse text-left text-xs">
      {COLGROUP_STYLE}
      <thead className="sticky top-0 z-20 shadow-[0_1px_0_hsl(var(--border))]">
        <tr>
          <th scope="col" className={`${headBase} text-left whitespace-nowrap`}>
            Origen
          </th>
          <th scope="col" className={`${headBase} text-left`}>
            Enlace
          </th>
          <th scope="col" className={`${headBase} text-left`}>
            Título
          </th>
          <th scope="col" className={`${headBase} border-r border-r-border/60 text-left align-bottom`}>
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                Referencia
              </span>
              <span className="pl-5 text-[10px] font-normal leading-tight text-muted-foreground">
                Línea de contexto en la respuesta del asistente
              </span>
            </span>
          </th>
          <th scope="col" className={`${headBase} border-l-2 border-l-primary/30 text-left align-bottom`}>
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                Prompt
              </span>
              <span className="pl-5 text-[10px] font-normal leading-tight text-muted-foreground">
                Mensaje del usuario que originó la indexación
              </span>
            </span>
          </th>
          <th scope="col" className={`${headBase} text-left`}>
            Tu nota
          </th>
          <th scope="col" className={`${headBase} text-right whitespace-nowrap tabular-nums`}>
            Msg
          </th>
          <th scope="col" className={`${headBase} text-left whitespace-nowrap`}>
            Fecha
          </th>
        </tr>
      </thead>
      <tbody className="bg-background/40">
        {entries.map((e) => (
          <tr key={e.id} className="hover:bg-muted/25">
            <td className={`${cell} whitespace-nowrap text-muted-foreground`}>{e.origin}</td>
            <td className={`${cell} min-w-0`}>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 border-border/80"
                  title="Copiar URL"
                  onClick={() => void copyUrl(e.url)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={e.url}
                  className="min-w-0 flex-1 truncate text-primary underline decoration-primary/50 underline-offset-2 hover:opacity-90"
                >
                  {formatResearchEvidenceUrlDisplay(e.url, e.title)}
                </a>
              </div>
            </td>
            <td className={`${cell} break-words text-muted-foreground`}>
              {e.origin === 'user_message' || e.origin === 'user_attachment' ? '—' : (e.title ?? '—')}
            </td>
            <td
              className={`${cell} border-r border-r-border/50 break-words text-muted-foreground`}
              title={e.snippet || undefined}
            >
              <div className="flex gap-2">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/55" aria-hidden />
                <div className="min-w-0 flex-1 rounded-md border border-border/50 bg-muted/25 px-2 py-1.5 text-[11px] leading-snug line-clamp-3 [overflow-wrap:anywhere]">
                  {e.snippet?.trim() ? e.snippet : '—'}
                </div>
              </div>
            </td>
            <td
              className={`${cell} border-l-2 border-l-primary/25 break-words`}
              title={e.indexedFromUserPrompt || undefined}
            >
              <div className="flex gap-2">
                <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
                <div className="min-w-0 flex-1 rounded-md border border-primary/20 bg-primary/[0.07] px-2 py-1.5 text-[11px] leading-snug text-foreground/90 line-clamp-3 [overflow-wrap:anywhere]">
                  {e.indexedFromUserPrompt?.trim() ? e.indexedFromUserPrompt : '—'}
                </div>
              </div>
            </td>
            <td className={`${cell} min-w-0`}>
              <EvidenceCommentField entryId={e.id} value={e.userComment ?? ''} onPersist={onPersistUserComment} />
            </td>
            <td className={`${cell} text-right tabular-nums text-muted-foreground`}>
              {e.chatHistoryIndex !== undefined ? e.chatHistoryIndex : '—'}
            </td>
            <td className={`${cell} whitespace-nowrap text-muted-foreground`}>
              {new Date(e.createdAt).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}
