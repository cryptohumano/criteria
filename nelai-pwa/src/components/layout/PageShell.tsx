import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const widthClass = {
  /** Alineado con el ancho por defecto del área principal (listas, dashboards). */
  default: 'mx-auto w-full min-w-0 max-w-7xl',
  /** Formularios y flujos centrados. */
  medium: 'mx-auto w-full min-w-0 max-w-3xl',
  /** Texto legal, verificación, lectura estrecha. */
  narrow: 'mx-auto w-full min-w-0 max-w-2xl',
  /** Vistas que aprovechan ancho extra (tablas densas). */
  wide: 'mx-auto w-full min-w-0 max-w-[90rem]',
  /** Sin tope de ancho (contenido controla su propio max-width). */
  fluid: 'w-full min-w-0',
} as const

export type PageShellWidth = keyof typeof widthClass

type PageShellProps = {
  children: ReactNode
  /** Por defecto coincide con el contenedor del `MainLayout`. */
  width?: PageShellWidth
  className?: string
}

export function PageShell({ children, width = 'default', className }: PageShellProps) {
  return <div className={cn(widthClass[width], className)}>{children}</div>
}
