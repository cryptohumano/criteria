import { Link } from 'react-router-dom'
import { getAppReleaseLabel } from '@/config/appRelease'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

interface PublicPageShellProps {
  children: React.ReactNode
  /** Título opcional bajo el logo (p. ej. nombre de la página legal) */
  pageTitle?: string
  /** Enlace “atrás” a la izquierda (por defecto: página de producto) */
  backTo?: { href: string; label: string }
  className?: string
}

const DEFAULT_BACK = { href: '/producto', label: 'Producto' } as const

export function PublicPageShell({ children, pageTitle, backTo = DEFAULT_BACK, className }: PublicPageShellProps) {
  return (
    <div className={cn('min-h-[100dvh] bg-background flex flex-col', className)}>
      <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="sm" className="shrink-0 -ml-2 gap-1.5 text-muted-foreground" asChild>
            <Link to={backTo.href}>
              <ArrowLeft className="h-4 w-4" />
              {backTo.label}
            </Link>
          </Button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <Link to="/producto" className="inline-flex flex-col items-center sm:items-start">
              <span className="text-lg font-bold tracking-tight text-primary">CriterIA</span>
              {pageTitle ? (
                <span className="text-xs font-medium text-muted-foreground truncate max-w-[12rem] sm:max-w-none">
                  {pageTitle}
                </span>
              ) : null}
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/90">
          {getAppReleaseLabel()}
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link to="/producto" className="underline-offset-4 hover:underline">
            Producto
          </Link>
          <span aria-hidden className="text-border">
            ·
          </span>
          <Link to="/legal/terminos" className="underline-offset-4 hover:underline">
            Términos
          </Link>
          <span aria-hidden className="text-border">
            ·
          </span>
          <Link to="/legal/privacidad" className="underline-offset-4 hover:underline">
            Privacidad
          </Link>
          <span aria-hidden className="text-border">
            ·
          </span>
          <Link to="/login" className="underline-offset-4 hover:underline">
            Entrar
          </Link>
        </nav>
      </footer>
    </div>
  )
}
