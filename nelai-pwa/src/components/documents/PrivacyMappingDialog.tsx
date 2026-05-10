import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { PiiReviewRow } from '@/services/privacy/piiTypes'
import { Shield } from 'lucide-react'

export function sourceLabel(source?: PiiReviewRow['source']) {
  if (source === 'document') return 'Documento'
  if (source === 'message') return 'Tu mensaje'
  if (source === 'pdf_import') return 'PDF importado'
  return '—'
}

export function PrivacySubstitutionTable({ rows }: { rows: PiiReviewRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay sustituciones registradas (sin placeholders <code className="text-xs bg-muted px-1 rounded">CRITERIA_*</code>
        ).
      </p>
    )
  }
  return (
    <ScrollArea className="h-full min-h-[10rem] max-h-[min(55vh,28rem)] rounded-md border bg-background">
      <table className="w-full text-left text-[11px]">
        <thead className="sticky top-0 bg-muted/90 backdrop-blur border-b z-[1]">
          <tr>
            <th className="p-2 font-semibold w-[5.5rem]">Origen</th>
            <th className="p-2 font-semibold w-[4.5rem]">Patrón</th>
            <th className="p-2 font-semibold">Texto original</th>
            <th className="p-2 font-semibold">Placeholder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.placeholder}-${i}`} className="border-b border-border/60 last:border-0 align-top">
              <td className="p-2 text-muted-foreground whitespace-nowrap">{sourceLabel(r.source)}</td>
              <td className="p-2 text-muted-foreground font-mono text-[10px]">{r.kind}</td>
              <td className="p-2 break-all font-mono text-destructive/90">{r.original}</td>
              <td className="p-2 break-all font-mono text-primary">{r.placeholder}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  )
}

export interface PrivacyMappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  rows: PiiReviewRow[]
}

export function PrivacyMappingDialog({
  open,
  onOpenChange,
  title = 'Mapeo original → placeholder',
  description = 'Valores detectados por patrones y el placeholder enviado a la IA en su lugar. No es un catálogo formal de tipos de PII; solo el registro de esta sesión.',
  rows,
}: PrivacyMappingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden sm:max-w-xl max-h-[min(90vh,40rem)] flex flex-col">
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/30 shrink-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <Shield className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-left text-base leading-tight">{title}</DialogTitle>
              <DialogDescription className="text-left text-xs leading-relaxed">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 flex-1 min-h-0 flex flex-col gap-3">
          <PrivacySubstitutionTable rows={rows} />
        </div>

        <div className="p-4 sm:p-5 border-t bg-background shrink-0 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
