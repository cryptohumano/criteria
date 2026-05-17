import { Link } from 'react-router-dom'
import { PERANTO_APP_URL } from '@/content/productPageContent'
import { getAppReleaseLabel } from '@/config/appRelease'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ProductPageLayoutProps {
  children: React.ReactNode
  hero: React.ReactNode
  className?: string
}

/** Layout de /producto: hero oscuro (marca Peranto) + cuerpo ancho completo. */
export function ProductPageLayout({ children, hero, className }: ProductPageLayoutProps) {
  return (
    <div className={cn('product-page min-h-[100dvh] flex flex-col', className)}>
      <header className="product-page-header sticky top-0 z-40 border-b border-white/10 bg-[#0a0f1a]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-col">
            <Link to="/producto" className="text-lg font-semibold tracking-tight text-white hover:text-white/90">
              CriterIA
            </Link>
            <a
              href={PERANTO_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium uppercase tracking-[0.2em] text-teal-400/90 transition-colors hover:text-teal-300"
            >
              Un producto de Peranto
            </a>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-white/75 sm:flex">
            <a href="#caracteristicas" className="transition-colors hover:text-white">
              Características
            </a>
            <a href="#plataforma" className="transition-colors hover:text-white">
              En uso
            </a>
            <a href="#planes" className="transition-colors hover:text-white">
              Planes
            </a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="hidden border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white sm:inline-flex"
              asChild
            >
              <Link to="/register">Crear cuenta</Link>
            </Button>
            <Button size="sm" className="border-0 bg-teal-600 text-white shadow-none hover:bg-teal-500" asChild>
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <ThemeToggle className="border border-white/15 text-white/90 hover:text-white" />
          </div>
        </div>
      </header>

      <section className="product-page-hero border-b border-white/10 bg-[#0a0f1a] text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">{hero}</div>
      </section>

      <main className="flex-1 bg-background">{children}</main>

      <footer className="border-t border-border/60 bg-background py-8 text-center text-xs text-muted-foreground">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/90">
          {getAppReleaseLabel()}
        </p>
        <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
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
          <span aria-hidden className="text-border">
            ·
          </span>
          <a
            href={PERANTO_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            Peranto
          </a>
        </nav>
      </footer>
    </div>
  )
}
