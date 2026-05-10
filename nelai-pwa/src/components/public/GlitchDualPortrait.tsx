import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface GlitchDualPortraitProps {
  photoSrc: string
  asciiSrc: string
  alt: string
  className?: string
}

/**
 * Alterna retrato (foto) y versión ASCII solo con fundido; sin brusquedas ni “glitch”.
 */
export function GlitchDualPortrait({ photoSrc, asciiSrc, alt, className }: GlitchDualPortraitProps) {
  const [layer, setLayer] = useState<'photo' | 'ascii'>('photo')

  useEffect(() => {
    const id = window.setInterval(
      () => setLayer((prev) => (prev === 'photo' ? 'ascii' : 'photo')),
      5500,
    )
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-muted/20 shadow-lg ring-1 ring-border/60',
        className,
      )}
    >
      <div className="relative aspect-[3/4] w-full sm:aspect-[4/5]">
        <img
          src={photoSrc}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-[700ms] ease-in-out',
            layer === 'photo' ? 'z-10 opacity-100' : 'z-0 opacity-0',
          )}
        />
        <img
          src={asciiSrc}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-[700ms] ease-in-out',
            layer === 'ascii' ? 'z-10 opacity-100' : 'z-0 opacity-0',
          )}
        />
      </div>
    </div>
  )
}
