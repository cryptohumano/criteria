import { useEffect, useMemo, useState } from 'react'

type Step = {
  id: string
  title: string
  body: string
  selector: string
}

function getRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!Number.isFinite(r.x) || r.width <= 0 || r.height <= 0) return null
  return r
}

export function SpotlightTour({
  open,
  onOpenChange,
  steps,
  initialStepId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  steps: Step[]
  initialStepId?: string | null
}) {
  const initialIndex = useMemo(() => {
    if (!initialStepId) return 0
    const idx = steps.findIndex((s) => s.id === initialStepId)
    return idx >= 0 ? idx : 0
  }, [initialStepId, steps])

  const [idx, setIdx] = useState(initialIndex)
  const step = steps[idx] || null

  useEffect(() => {
    if (!open) return
    setIdx(initialIndex)
  }, [open, initialIndex])

  const rect = useMemo(() => (step ? getRect(step.selector) : null), [step])

  useEffect(() => {
    if (!open) return
    if (!step) return
    const el = document.querySelector(step.selector) as HTMLElement | null
    el?.scrollIntoView?.({ block: 'center', inline: 'center' })
  }, [open, step?.selector])

  if (!open || !step) return null

  const pad = 10
  const left = rect ? Math.max(8, rect.left - pad) : 24
  const top = rect ? Math.max(8, rect.top - pad) : 24
  const width = rect ? rect.width + pad * 2 : 280
  const height = rect ? rect.height + pad * 2 : 120

  const tooltipTop = rect ? Math.min(window.innerHeight - 220, rect.bottom + 14) : 180
  const tooltipLeft = rect ? Math.min(window.innerWidth - 360, Math.max(16, rect.left)) : 24

  const canPrev = idx > 0
  const canNext = idx < steps.length - 1

  return (
    <div className="fixed inset-0 z-[80]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/55"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />

      {/* Highlight box: el truco es el boxShadow gigante que deja “hueco” alrededor */}
      <div
        className="absolute rounded-xl ring-2 ring-white/90"
        style={{
          left,
          top,
          width,
          height,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip */}
      <div
        className="absolute w-[340px] max-w-[calc(100vw-32px)] rounded-xl border bg-background p-4 shadow-2xl"
        style={{ left: tooltipLeft, top: tooltipTop }}
        role="dialog"
        aria-label="Tutorial"
      >
        <div className="text-sm font-semibold">{step.title}</div>
        <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{step.body}</div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4"
            onClick={() => onOpenChange(false)}
          >
            Omitir
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`h-8 px-3 rounded-md border text-sm ${!canPrev ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}
              disabled={!canPrev}
              onClick={() => canPrev && setIdx((v) => Math.max(0, v - 1))}
            >
              Atrás
            </button>
            <button
              type="button"
              className={`h-8 px-3 rounded-md border text-sm ${!canNext ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}
              disabled={!canNext}
              onClick={() => {
                if (!canNext) onOpenChange(false)
                else setIdx((v) => Math.min(steps.length - 1, v + 1))
              }}
            >
              {canNext ? 'Siguiente' : 'Listo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

