import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getGuideContentWithLLM, type GuideResult } from '@/services/criteria/guideAgent'
import type { GuideActionType } from '@/config/guideAgent'
import { Info, Loader2 } from 'lucide-react'
import { MarkdownContent } from '@/components/ui/markdown-content'

interface GuideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionType: GuideActionType
  fieldsToPublish?: string[]
  onAcknowledged: () => void
  hasGeolocation?: boolean
  hasPersonalData?: boolean
  /** Resumen de qué datos se subirán (ej: "tipo: médico, severidad: alta") */
  payloadSummary?: string
}

export function GuideModal({
  open,
  onOpenChange,
  actionType,
  fieldsToPublish = [],
  onAcknowledged,
  hasGeolocation,
  hasPersonalData,
  payloadSummary,
}: GuideModalProps) {
  const [result, setResult] = useState<GuideResult | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchedForOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      fetchedForOpenRef.current = false
      return
    }
    // Solo una llamada por apertura (evita 429 por re-renders)
    if (fetchedForOpenRef.current) return
    fetchedForOpenRef.current = true

    setLoading(true)
    setResult(null)
    getGuideContentWithLLM({
      actionType,
      fieldsToPublish,
      hasGeolocation,
      hasPersonalData,
      payloadSummary,
    })
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }, [open])

  const handleAcknowledged = () => {
    onAcknowledged()
    onOpenChange(false)
  }

  const display = result ?? {
    title: 'Antes de continuar',
    content: 'Cargando...',
    sections: undefined,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2">
              {loading ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <Info className="h-5 w-5 text-primary" />
              )}
            </div>
            <DialogTitle>{display.title}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Explicación sobre qué datos serán públicos y privados
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Preparando guía...</p>
          ) : display.sections ? (
            <div className="space-y-4">
              {display.sections.map((section, i) => (
                <div key={i}>
                  <h4 className="font-semibold text-sm mb-1">{section.heading}</h4>
                  <MarkdownContent content={section.body} size="sm" className="text-muted-foreground" />
                </div>
              ))}
            </div>
          ) : (
            <MarkdownContent content={display.content} size="sm" className="text-muted-foreground" />
          )}
          <Button onClick={handleAcknowledged} className="w-full mt-4" disabled={loading}>
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
