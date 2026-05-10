import * as React from 'react'

/** Debe coincidir con el breakpoint `md` de Tailwind y el sidebar de shadcn (768px). */
const MOBILE_BREAKPOINT = 768

/**
 * Vista “compacta” según **ancho de viewport**, no por user-agent ni modo standalone PWA.
 * Así una PWA instalada en escritorio usa el mismo chrome que la web en pantalla grande.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < MOBILE_BREAKPOINT
  })

  React.useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
