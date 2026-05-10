import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { HelpCircle, Sparkles } from 'lucide-react'

/**
 * Barra superior mínima tipo shadcn: el trigger vive fuera del sidebar.
 */
export function Header({
  onHelpClick,
  onReplayTutorialClick,
}: {
  onHelpClick?: () => void
  onReplayTutorialClick?: () => void
}) {
  return (
    <header className="glass-header border-b md:static sticky top-0 z-20 safe-area-inset-top shrink-0">
      <div className="flex items-center px-3 py-2 sm:py-3 gap-2">
        <SidebarTrigger className="h-9 w-9 shrink-0" />
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
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
          className="h-9 w-9"
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
