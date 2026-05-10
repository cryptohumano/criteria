import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, LogOut, Shield } from 'lucide-react'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { useWorkspaceSession } from '@/contexts/WorkspaceSessionContext'
import { cn } from '@/lib/utils'

interface WorkspacePlatformBarProps {
  /** Tarjeta vertical para el panel lateral (evita filas horizontales rotas en ~16rem). */
  forSidebar?: boolean
}

/** Organización, plan y cierre de sesión B2B (independiente del bloqueo del keyring local). */
export function WorkspacePlatformBar({ forSidebar = false }: WorkspacePlatformBarProps) {
  const { session, signOut } = useWorkspaceSession()
  if (!isSaaSWorkspaceMode() || !session) return null

  if (forSidebar) {
    return (
      <div
        className={cn(
          'rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 space-y-3 text-sm text-sidebar-foreground',
        )}
      >
        <div className="flex gap-2 min-w-0">
          <Building2 className="h-4 w-4 shrink-0 text-sidebar-foreground/80 mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            <Link to="/organization" className="font-medium hover:underline block truncate">
              {session.organization.name}
            </Link>
            <Badge
              variant="outline"
              className="text-[10px] uppercase border-sidebar-border text-sidebar-foreground"
            >
              {session.organization.plan}
            </Badge>
            <p className="text-xs text-sidebar-foreground/70 break-all leading-snug">{session.user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {session.user.platformRole === 'superadmin' ? (
            <Button variant="secondary" size="sm" className="h-8 text-xs shrink-0" asChild>
              <Link to="/platform" title="Panel de plataforma (superadmin)">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Plataforma
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => signOut()}
            title="Cerrar sesión en la plataforma"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Salir (plataforma)
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs sm:text-sm border rounded-md px-2 py-1 bg-muted/50 max-w-full min-w-0">
      <Building2 className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
      <Link
        to="/organization"
        className="truncate max-w-[120px] sm:max-w-[200px] font-medium hover:underline shrink min-w-0"
      >
        {session.organization.name}
      </Link>
      <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase shrink-0">
        {session.organization.plan}
      </Badge>
      <span className="text-muted-foreground truncate max-w-[100px] hidden lg:inline shrink min-w-0">
        {session.user.email}
      </span>
      {session.user.platformRole === 'superadmin' ? (
        <Button variant="secondary" size="sm" className="h-7 text-[10px] shrink-0" asChild>
          <Link to="/platform" title="Panel de plataforma (superadmin)">
            <Shield className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Plataforma</span>
          </Link>
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 ml-auto shrink-0"
        onClick={() => signOut()}
        title="Cerrar sesión en la plataforma"
      >
        <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
      </Button>
    </div>
  )
}
