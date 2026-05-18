import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  MessageCircle,
  Pin,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ResearchEvidenceLogEntry } from '@/types/documents'
import {
  GROUNDING_EVIDENCE_URL,
  formatResearchEvidenceUrlDisplay,
} from '@/utils/researchEvidenceLog'
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
      className="min-h-[2.5rem] max-h-28 w-full resize-y bg-background text-xs"
      placeholder="Añade una nota sobre esta fuente…"
    />
  )
}

const ORIGIN_LABELS: Record<ResearchEvidenceLogEntry['origin'], string> = {
  user_message: 'Usuario',
  assistant_message: 'Asistente',
  user_attachment: 'Adjunto',
  document_scan: 'Documento',
  grounding_queries: 'Consultas web',
}

const ORIGIN_BADGE_CLASS: Record<ResearchEvidenceLogEntry['origin'], string> = {
  user_message: 'border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100',
  assistant_message: 'border-violet-500/30 bg-violet-500/10 text-violet-900 dark:text-violet-100',
  user_attachment: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  document_scan: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
  grounding_queries: 'border-orange-500/30 bg-orange-500/10 text-orange-900 dark:text-orange-100',
}

export interface ResearchEvidenceLogTableProps {
  entries: ResearchEvidenceLogEntry[]
  onPersistUserComment: (entryId: string, userComment: string) => Promise<void>
  pinnedIds?: string[]
  onTogglePin?: (entryId: string) => void
}

function formatWebQueries(e: ResearchEvidenceLogEntry): string {
  const q = e.webSearchQueries
  if (q?.length) return q.join(' · ')
  if (e.origin === 'grounding_queries' && e.snippet?.trim()) return e.snippet
  return ''
}

function formatEntryDate(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(ms))
  } catch {
    return new Date(ms).toLocaleString()
  }
}

function DetailBlock({
  icon: Icon,
  label,
  children,
  variant = 'muted',
}: {
  icon: typeof FileText
  label: string
  children: ReactNode
  variant?: 'muted' | 'prompt'
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon
          className={cn('h-3.5 w-3.5 shrink-0', variant === 'prompt' && 'text-primary')}
          aria-hidden
        />
        {label}
      </div>
      <div
        className={cn(
          'rounded-md border px-2.5 py-2 text-[11px] leading-relaxed [overflow-wrap:anywhere]',
          variant === 'prompt'
            ? 'border-primary/20 bg-primary/[0.06] text-foreground/90'
            : 'border-border/60 bg-muted/30 text-muted-foreground'
        )}
      >
        {children}
      </div>
    </div>
  )
}

function EvidenceLogRow({
  entry: e,
  pinned,
  onTogglePin,
  onPersistUserComment,
  copyUrl,
}: {
  entry: ResearchEvidenceLogEntry
  pinned: boolean
  onTogglePin?: (entryId: string) => void
  onPersistUserComment: (entryId: string, userComment: string) => Promise<void>
  copyUrl: (url: string) => void
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const isGroundingOnly = e.origin === 'grounding_queries' || e.url === GROUNDING_EVIDENCE_URL
  const queriesText = formatWebQueries(e)
  const showTitle =
    !isGroundingOnly &&
    Boolean(e.title?.trim()) &&
    e.origin !== 'user_message' &&
    e.origin !== 'user_attachment'
  const hasExpandableDetail =
    Boolean(queriesText) ||
    Boolean(e.snippet?.trim()) ||
    Boolean(e.indexedFromUserPrompt?.trim()) ||
    e.chatHistoryIndex !== undefined

  const colSpan = onTogglePin ? 4 : 3

  const primaryLabel = isGroundingOnly
    ? queriesText || 'Consultas web (sin URL externa)'
    : showTitle
      ? e.title!
      : formatResearchEvidenceUrlDisplay(e.url, e.title)

  return (
    <>
      <TableRow
        className={cn(
          'group/entry border-b border-border/50 hover:bg-muted/30',
          pinned && 'bg-primary/[0.05] hover:bg-primary/[0.08]',
          pinned && 'shadow-[inset_3px_0_0_0_hsl(var(--primary))]'
        )}
      >
        {onTogglePin ? (
          <TableCell className="w-11 px-2 py-3 align-top">
            {isGroundingOnly ? (
              <span className="sr-only">No anclable</span>
            ) : (
              <Button
                type="button"
                variant={pinned ? 'secondary' : 'ghost'}
                size="icon"
                className={cn('h-8 w-8 shrink-0', pinned && 'text-primary')}
                onClick={() => onTogglePin(e.id)}
                title={pinned ? 'Quitar del agente' : 'Priorizar en el agente'}
                aria-label={pinned ? 'Quitar fuente del agente' : 'Usar fuente en el agente'}
                aria-pressed={pinned}
              >
                <Pin className={cn('h-4 w-4', pinned && 'fill-current')} />
              </Button>
            )}
          </TableCell>
        ) : null}

        <TableCell className="min-w-0 px-3 py-3 align-top">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-start gap-2">
              <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground line-clamp-2">
                {primaryLabel}
              </p>
              <Badge
                variant="outline"
                className={cn('shrink-0 text-[10px] font-normal', ORIGIN_BADGE_CLASS[e.origin])}
              >
                {ORIGIN_LABELS[e.origin] ?? e.origin}
              </Badge>
            </div>

            {!isGroundingOnly ? (
              <div className="flex min-w-0 items-center gap-1">
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={e.url}
                  className="min-w-0 flex-1 truncate text-xs text-primary underline decoration-primary/40 underline-offset-2 hover:opacity-90"
                >
                  {formatResearchEvidenceUrlDisplay(e.url, e.title)}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  title="Copiar URL"
                  onClick={() => copyUrl(e.url)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  title="Abrir enlace"
                  asChild
                >
                  <a href={e.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            ) : queriesText ? (
              <p className="text-xs text-muted-foreground line-clamp-2 [overflow-wrap:anywhere]">
                {queriesText}
              </p>
            ) : null}

            {showTitle ? (
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {formatResearchEvidenceUrlDisplay(e.url, e.title)}
              </p>
            ) : null}

            <div className="pt-1">
              <EvidenceCommentField
                entryId={e.id}
                value={e.userComment ?? ''}
                onPersist={onPersistUserComment}
              />
            </div>
          </div>
        </TableCell>

        <TableCell className="hidden w-[7.5rem] shrink-0 px-3 py-3 align-top text-right sm:table-cell">
          <time
            className="block text-[11px] tabular-nums text-muted-foreground whitespace-nowrap"
            dateTime={new Date(e.createdAt).toISOString()}
            title={new Date(e.createdAt).toLocaleString()}
          >
            {formatEntryDate(e.createdAt)}
          </time>
          {e.chatHistoryIndex !== undefined ? (
            <span className="mt-1 block text-[10px] text-muted-foreground/80 tabular-nums">
              Msg #{e.chatHistoryIndex}
            </span>
          ) : null}
        </TableCell>

        <TableCell className="w-10 px-1 py-3 align-top">
          {hasExpandableDetail ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 text-muted-foreground',
                detailOpen && 'text-foreground'
              )}
              aria-label="Ver detalle de la fuente"
              aria-expanded={detailOpen}
              onClick={() => setDetailOpen((open) => !open)}
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', detailOpen && 'rotate-180')}
              />
            </Button>
          ) : (
            <span className="inline-block h-8 w-8" aria-hidden />
          )}
        </TableCell>
      </TableRow>

      {hasExpandableDetail && detailOpen ? (
        <TableRow className="border-b border-border/50 hover:bg-transparent">
          <TableCell colSpan={colSpan} className="p-0 pb-3 pt-0">
            <div className="mx-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                  {queriesText && !isGroundingOnly ? (
                    <DetailBlock icon={Search} label="Consultas web">
                      {queriesText}
                    </DetailBlock>
                  ) : null}

                  {e.snippet?.trim() ? (
                    <DetailBlock icon={FileText} label="Referencia">
                      {e.snippet}
                    </DetailBlock>
                  ) : null}

                  {e.indexedFromUserPrompt?.trim() ? (
                    <DetailBlock icon={MessageCircle} label="Prompt del usuario" variant="prompt">
                      {e.indexedFromUserPrompt}
                    </DetailBlock>
                  ) : null}

                  <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground sm:col-span-2 sm:hidden">
                    <time dateTime={new Date(e.createdAt).toISOString()}>
                      {formatEntryDate(e.createdAt)}
                    </time>
                    {e.chatHistoryIndex !== undefined ? (
                      <span className="tabular-nums">Msg #{e.chatHistoryIndex}</span>
                    ) : null}
                  </div>
                </div>
              </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

export function ResearchEvidenceLogTable({
  entries,
  onPersistUserComment,
  pinnedIds = [],
  onTogglePin,
}: ResearchEvidenceLogTableProps) {
  const copyUrl = useCallback((url: string) => {
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Enlace copiado al portapapeles'))
      .catch(() => toast.error('No se pudo copiar el enlace'))
  }, [])

  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b bg-muted/50">
            {onTogglePin ? (
              <TableHead className="w-11 px-2" scope="col">
                <span className="sr-only">Anclar en el agente</span>
                <Pin className="mx-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              </TableHead>
            ) : null}
            <TableHead scope="col" className="px-3 text-xs font-semibold">
              Fuente
            </TableHead>
            <TableHead
              scope="col"
              className="hidden w-[7.5rem] px-3 text-right text-xs font-semibold sm:table-cell"
            >
              Registro
            </TableHead>
            <TableHead className="w-10 px-1" scope="col">
              <span className="sr-only">Detalle</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {entries.map((e) => (
            <EvidenceLogRow
              key={e.id}
              entry={e}
              pinned={pinnedIds.includes(e.id)}
              onTogglePin={onTogglePin}
              onPersistUserComment={onPersistUserComment}
              copyUrl={copyUrl}
            />
          ))}
        </TableBody>
      </Table>

      {entries.length > 0 ? (
        <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">
          {entries.length} entrada{entries.length === 1 ? '' : 's'} · Expande una fila para consultas web,
          referencia y prompt
        </p>
      ) : null}
    </div>
  )
}
