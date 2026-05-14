import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { HelpCircle, Sparkles } from 'lucide-react'

export type HeaderCallbacks = {
  onHelpClick?: () => void
  onReplayTutorialClick?: () => void
}

/**
 * Barra superior en móvil (sheet + sticky): trigger y acciones.
 */
export function Header({ onHelpClick, onReplayTutorialClick }: HeaderCallbacks) {
  const { isMobile } = useSidebar()

  return (
    <header className="relative z-30 shrink-0 overflow-visible border-b bg-background pt-[env(safe-area-inset-top,0px)] max-md:sticky max-md:top-0 max-md:bg-background/95 max-md:backdrop-blur-md md:backdrop-blur-none">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center gap-2 px-5 py-2 sm:px-6 sm:py-3 md:gap-3 md:px-8 md:py-3 lg:px-10 xl:px-12 2xl:px-14">
        {isMobile ? <SidebarTrigger className="h-9 w-9 shrink-0" /> : null}
        <div className="min-w-0 flex-1" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onReplayTutorialClick?.()}
          title="Reproducir tutorial"
          aria-label="Reproducir tutorial"
          data-tour-id="replay-tutorial"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => onHelpClick?.()}
          title="Ayuda"
          aria-label="Ayuda"
          data-tour-id="help-button"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}

/** Caja horizontal del contenido: padding algo más generoso en escritorio para no “pegar” al rail. */
export const DASHBOARD_MAIN_GUTTER =
  'mx-auto w-full max-w-7xl min-w-0 px-5 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-14' as const
