import { Link, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useWorkspaceSession } from '@/contexts/WorkspaceSessionContext'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ArrowLeft, BarChart3, Building2, Shield, Users, KeyRound, LogOut } from 'lucide-react'

/**
 * Layout del panel de superadmin: no exige billetera local; solo sesión SaaS con `platformRole: superadmin`.
 */
export default function PlatformAdminLayout() {
  const { session, isHydrated, isSessionSynced, signOut } = useWorkspaceSession()
  const location = useLocation()

  if (!isSaaSWorkspaceMode()) {
    return <Navigate to="/" replace />
  }
  if (!isHydrated || !isSessionSynced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Sincronizando sesión con el servidor…
          <span className="block mt-2 text-xs text-muted-foreground/80">
            Necesario para aplicar <code className="text-xs">superadmin</code> sin depender de datos
            viejos en el navegador.
          </span>
        </p>
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: { pathname: '/platform' } }} />
  }
  if (session.user.platformRole !== 'superadmin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center max-w-md mx-auto">
        <h1 className="text-lg font-semibold mb-2">Sin acceso al panel de plataforma</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Esta vista es solo para cuentas con rol <strong>superadmin</strong>. Si te acaban de asignar el
          rol en base de datos, <strong>cierra sesión</strong> (barra de organización) e inicia sesión
          otra vez.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="default">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    )
  }

  const nav = [
    { to: '/platform', label: 'Resumen', icon: BarChart3 },
    { to: '/platform/organizations', label: 'Organizaciones', icon: Building2 },
    { to: '/platform/users', label: 'Usuarios', icon: Users },
    { to: '/platform/llm', label: 'IA / Claves', icon: KeyRound },
  ] as const

  const isActive = (to: string) => {
    if (to === '/platform') return location.pathname === '/platform'
    return location.pathname.startsWith(to)
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="p-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <div className="font-semibold leading-tight truncate">Plataforma</div>
              <div className="text-xs text-muted-foreground truncate">superadmin</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navegación</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((n) => (
                  <SidebarMenuItem key={n.to}>
                    <SidebarMenuButton asChild isActive={isActive(n.to)}>
                      <Link to={n.to}>
                        <n.icon className="h-4 w-4" />
                        <span>{n.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <div className="text-xs text-muted-foreground truncate">{session.user.email}</div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-1" />
                App
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut()} className="flex-1">
              <LogOut className="h-4 w-4 mr-1" />
              Salir
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="border-b border-border flex items-center gap-2 px-4 py-3">
          <SidebarTrigger />
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold tracking-tight truncate">Dashboard</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
