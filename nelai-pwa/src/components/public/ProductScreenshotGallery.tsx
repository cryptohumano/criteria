import { useState } from 'react'
import { ImageIcon, ZoomIn } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { productAssetUrl, type ProductScreenshot } from '@/content/productPageContent'

function ScreenshotCard({
  shot,
  onOpen,
}: {
  shot: ProductScreenshot
  onOpen: () => void
}) {
  const [failed, setFailed] = useState(false)
  const src = productAssetUrl(shot.src)

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left',
        'transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="relative aspect-[16/10] w-full bg-muted/40">
        {!failed ? (
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <ImageIcon className="h-10 w-10 opacity-40" aria-hidden />
            <span className="text-xs leading-snug">{shot.caption}</span>
            <span className="text-[10px] text-muted-foreground/70">
              Añade la captura en <code className="font-mono">public/{shot.src}</code>
            </span>
          </div>
        )}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ZoomIn className="h-3 w-3" aria-hidden />
          Ampliar captura
        </span>
      </div>
      <p className="border-t border-border/60 px-3 py-2.5 text-xs leading-snug text-muted-foreground sm:text-sm">
        {shot.caption}
      </p>
    </button>
  )
}

export function ProductScreenshotGallery({ shots }: { shots: ProductScreenshot[] }) {
  const [active, setActive] = useState<ProductScreenshot | null>(null)
  const activeSrc = active ? productAssetUrl(active.src) : null

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shots.map((shot) => (
          <ScreenshotCard key={shot.id} shot={shot} onOpen={() => setActive(shot)} />
        ))}
      </div>

      <Dialog open={active != null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-[min(92vw,56rem)]">
          {active ? (
            <>
              <DialogHeader className="space-y-1 border-b border-border px-4 py-3 sm:px-5">
                <DialogTitle className="text-left text-base font-semibold leading-snug pr-8">
                  {active.caption}
                </DialogTitle>
                <DialogDescription className="sr-only">{active.alt}</DialogDescription>
              </DialogHeader>
              <div className="max-h-[min(70vh,640px)] overflow-auto bg-muted/30 p-2 sm:p-3">
                {activeSrc ? (
                  <img
                    src={activeSrc}
                    alt={active.alt}
                    className="mx-auto max-h-[min(68vh,600px)] w-full rounded-lg object-contain"
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
