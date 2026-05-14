import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'

type Step = {
  id: string
  title: string
  body: string
  selector: string
}

function measureRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!Number.isFinite(r.left) || !Number.isFinite(r.top) || r.width <= 0 || r.height <= 0) return null
  return r
}

/** Atenúa el resto de la pantalla dejando un hueco que deja pasar clics al elemento destacado. */
function DimmingPanels({
  rect,
  pad,
  onDimClick,
}: {
  rect: DOMRect | null
  pad: number
  onDimClick: () => void
}) {
  const dim = 'fixed z-[80] bg-black/55 pointer-events-auto'
  if (!rect) {
    return (
      <div
        className="pointer-events-auto fixed inset-0 z-[80] bg-black/55"
        onClick={onDimClick}
        aria-hidden
      />
    )
  }
  const l = Math.max(0, rect.left - pad)
  const t = Math.max(0, rect.top - pad)
  const r = Math.min(window.innerWidth, rect.right + pad)
  const b = Math.min(window.innerHeight, rect.bottom + pad)
  return (
    <>
      <div className={dim} style={{ top: 0, left: 0, right: 0, height: t }} onClick={onDimClick} aria-hidden />
      <div className={dim} style={{ top: t, left: 0, width: l, height: b - t }} onClick={onDimClick} aria-hidden />
      <div className={dim} style={{ top: t, left: r, right: 0, height: b - t }} onClick={onDimClick} aria-hidden />
      <div className={dim} style={{ top: b, left: 0, right: 0, bottom: 0 }} onClick={onDimClick} aria-hidden />
    </>
  )
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
    const i = steps.findIndex((s) => s.id === initialStepId)
    return i >= 0 ? i : 0
  }, [initialStepId, steps])

  const [idx, setIdx] = useState(initialIndex)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const step = steps[idx] || null

  useEffect(() => {
    if (!open) return
    setIdx(initialIndex)
  }, [open, initialIndex])

  const remeasure = useCallback(() => {
    if (!open || !step) {
      setTargetRect(null)
      return
    }
    setTargetRect(measureRect(step.selector))
  }, [open, step])

  useLayoutEffect(() => {
    remeasure()
  }, [remeasure, idx])

  useEffect(() => {
    if (!open || !step) return
    const el = document.querySelector(step.selector) as HTMLElement | null
    el?.scrollIntoView?.({ block: 'center', inline: 'center' })
    const t0 = window.requestAnimationFrame(() => remeasure())
    const t1 = window.setTimeout(remeasure, 80)
    const t2 = window.setTimeout(remeasure, 320)
    const ro = new ResizeObserver(() => remeasure())
    if (el) ro.observe(el)
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      window.cancelAnimationFrame(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      ro.disconnect()
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [open, step, remeasure])

  if (!open || !step) return null

  const pad = 10
  const rect = targetRect
  const left = rect ? Math.max(8, rect.left - pad) : 24
  const top = rect ? Math.max(8, rect.top - pad) : 24
  const width = rect ? rect.width + pad * 2 : 280
  const height = rect ? rect.height + pad * 2 : 120

  const tooltipTop = rect ? Math.min(window.innerHeight - 220, rect.bottom + 14) : 180
  const tooltipLeft = rect ? Math.min(window.innerWidth - 360, Math.max(16, rect.left)) : 24

  const canPrev = idx > 0
  const canNext = idx < steps.length - 1

  const handleDimClick = () => onOpenChange(false)

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      <DimmingPanels rect={rect} pad={pad} onDimClick={handleDimClick} />

      {rect ? (
        <div
          className="pointer-events-none fixed z-[81] rounded-xl ring-2 ring-white/90"
          style={{
            left,
            top,
            width,
            height,
          }}
          aria-hidden
        />
      ) : null}

      <div
        className="pointer-events-auto fixed z-[82] w-[340px] max-w-[calc(100vw-32px)] rounded-xl border bg-background p-4 shadow-2xl"
        style={{ left: tooltipLeft, top: tooltipTop }}
        role="dialog"
        aria-label="Tutorial"
        onClick={(e) => e.stopPropagation()}
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
              className={`h-8 rounded-md border px-3 text-sm ${!canPrev ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted'}`}
              disabled={!canPrev}
              onClick={() => canPrev && setIdx((v) => Math.max(0, v - 1))}
            >
              Atrás
            </button>
            <button
              type="button"
              className={`h-8 rounded-md border px-3 text-sm ${!canNext ? '' : 'hover:bg-muted'}`}
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
