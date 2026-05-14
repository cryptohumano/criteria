import { useContext } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, HelpCircle, LogOut, Shield, Sparkles, Wallet } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ActiveAccountSwitcher } from '@/components/ActiveAccountSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import Identicon from '@polkadot/react-identicon'
import { KeyringContext, useKeyringContext } from '@/contexts/KeyringContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import {
  getPrimaryNavItems,
  getSettingsNavItem,
  isWalletNavActive,
  WALLET_NAV,
} from '@/config/dashboardNavigation'
import type { HeaderCallbacks } from '@/components/layout/Header'
import { cn } from '@/lib/utils'

function SidebarLogoutButton() {
  const keyringContext = useContext(KeyringContext)

  if (!keyringContext?.isUnlocked || !keyringContext.lock) {
    return null
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full justify-start gap-2 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      onClick={() => keyringContext.lock()}
      title="Cerrar sesión del monedero local"
    >
      <LogOut className="h-4 w-4 shrink-0" />
      Cerrar monedero local
    </Button>
  )
}

/**
 * Navegación lateral del dashboard (shadcn `Sidebar`): cabecera con toggle/marca (escritorio), menú,
 * wallet colapsable, pie con cuenta, tema y (opcional) ayuda/tutorial en escritorio.
 */
export function AppSidebar({
  onHelpClick,
  onReplayTutorialClick,
}: Partial<HeaderCallbacks> = {}) {
  const { state } = useSidebar()
  const location = useLocation()
  const pathname = location.pathname
  const primary = getPrimaryNavItems()
  const settings = getSettingsNavItem()
  const walletOpenDefault = isWalletNavActive(pathname)

  const { activeAccount } = useActiveAccount()
  const { accounts } = useKeyringContext()
  const { session, signOut } = useWorkspaceSession()

  const showAccountSection = accounts.length > 0
  const railAccountAddress = activeAccount ?? accounts[0]?.address ?? null
  const baseUrl = import.meta.env.BASE_URL || '/'
  // Nota: `public/favicon.svg` incluye un <image> embebido; en algunos navegadores puede no renderizarse
  // de forma consistente cuando se usa dentro de un <img>. Para UI interna, preferimos el PNG del manifest.
  const logoSrc = `${baseUrl}web-app-manifest-192x192.png`

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-sidebar-border border-r">
      <SidebarHeader className="border-b border-sidebar-border gap-0 py-3">
        {/* Sheet móvil: solo marca */}
        <div className="flex items-center gap-2 px-2 md:hidden group-data-[collapsible=icon]:justify-center">
          <div className="flex h-10 w-10 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 items-center justify-center overflow-hidden rounded-xl bg-sidebar-accent shrink-0 ring-1 ring-sidebar-border">
            <img src={logoSrc} alt="" className="h-full w-full object-cover" />
          </div>
        </div>
        {/* Escritorio: toggle + logo (expandido); en rail ancho fijo solo el toggle centrado */}
        <div
          className={cn(
            'hidden md:flex md:items-center',
            state === 'collapsed' ? 'justify-center px-0' : 'gap-2 px-2',
          )}
        >
          <SidebarTrigger
            className="h-8 w-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title="Mostrar u ocultar menú lateral"
          />
          {state === 'expanded' ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border">
              <img src={logoSrc} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      {/* Una sola columna con scroll: evita que el footer consuma todo el flex y deje la navegación en altura 0 */}
      <SidebarContent className="gap-0 px-0 pb-4">
        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="px-4 text-[11px] uppercase tracking-wider text-sidebar-foreground/55">
            Menú
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <SidebarMenu className="gap-0.5">
              {primary.map((item) => {
                const active = item.match(pathname)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="h-9 px-2"
                      tooltip={state === 'collapsed' ? item.name : undefined}
                    >
                      <Link
                        to={item.href}
                        {...(item.href === '/documents' ? { 'data-tour-id': 'tour-nav-documents' as const } : {})}
                      >
                        <item.icon className="text-sidebar-foreground/85" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}

              {/* Wallet en modo rail: el CollapsibleTrigger se oculta en `icon` por shadcn. */}
              {state === 'collapsed' ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isWalletNavActive(pathname)}
                    className="h-9 px-2"
                    tooltip={state === 'collapsed' ? 'Wallet' : undefined}
                  >
                    <Link to="/accounts">
                      <Wallet className="text-sidebar-foreground/85" />
                      <span>Wallet</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Collapsible defaultOpen={walletOpenDefault} className="group/collapsible px-2">
          <SidebarGroup className="py-0">
            <SidebarGroupLabel asChild className="px-0">
              <CollapsibleTrigger className="flex h-9 w-full items-center rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent/80 focus-visible:ring-2 [&>svg]:size-4">
                <Wallet className="text-sidebar-foreground/85" />
                <span className="text-sm font-medium">Wallet</span>
                <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="pb-1 pt-1">
                <SidebarMenu className="ml-1 border-l border-sidebar-border pl-2 gap-0.5">
                  {WALLET_NAV.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(item.href + '/'))
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} size="sm" className="h-8 px-2">
                          <Link to={item.href}>
                            <item.icon />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
              <div className="px-1 pt-2 group-data-[collapsible=icon]:hidden">
                <SidebarLogoutButton />
              </div>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarGroup className="py-1">
          <SidebarGroupContent className="px-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={settings.match(pathname)}
                  className="h-9 px-2"
                  tooltip={state === 'collapsed' ? settings.name : undefined}
                >
                  <Link to={settings.href}>
                    <settings.icon className="text-sidebar-foreground/85" />
                    <span>{settings.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAccountSection ? (
          <SidebarGroup className="py-2">
            <SidebarGroupLabel className="px-4 text-[11px] uppercase tracking-wider text-sidebar-foreground/55">
              Cuenta
            </SidebarGroupLabel>
            <SidebarGroupContent className="space-y-3 px-3 [&_.text-muted-foreground]:text-sidebar-foreground/65">
              {railAccountAddress ? (
                <div className="hidden group-data-[collapsible=icon]:block">
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname.startsWith('/accounts')} className="h-9 px-2">
                        <Link to="/accounts" title="Cuentas">
                          <Identicon value={railAccountAddress} size={18} theme="polkadot" />
                          <span className="sr-only">Cuentas</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </div>
              ) : null}
              <div className="group-data-[collapsible=icon]:hidden">
                <ActiveAccountSwitcher triggerClassName="w-full min-w-0 max-w-none h-9 border-sidebar-border bg-sidebar-accent/15" />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            {isSaaSWorkspaceMode() && session ? (
              <>
                <div className="text-xs font-semibold text-sidebar-foreground truncate">
                  {session.organization.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-sidebar-border bg-sidebar-accent/30 px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground/70">
                    {session.organization.plan.toUpperCase()}
                  </span>
                  <span className="rounded-full border border-sidebar-border bg-sidebar-accent/30 px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground/70">
                    {session.organization.kind === 'team' ? 'EQUIPO' : 'PERSONAL'}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-sidebar-foreground/65 truncate">
                  {session.user.displayName || session.user.email}
                </div>
                <div className="text-[11px] text-sidebar-foreground/65 truncate">
                  {session.user.email}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs font-medium text-sidebar-foreground truncate">
                  {session?.user?.displayName || 'Usuario'}
                </div>
                <div className="text-[11px] text-sidebar-foreground/65 truncate">{session?.user?.email || ''}</div>
              </>
            )}
          </div>
          {/* Rail: acciones rápidas (igual que shadcn: icon buttons con tooltip) */}
          <div className="hidden group-data-[collapsible=icon]:flex flex-col gap-2">
            {isSaaSWorkspaceMode() && session?.user.platformRole === 'superadmin' ? (
              <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Plataforma">
                <Link to="/platform">
                  <Shield className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            {isSaaSWorkspaceMode() && session ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => signOut()}
                title="Salir (plataforma)"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            ) : null}
            {onReplayTutorialClick ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex"
                onClick={() => onReplayTutorialClick()}
                title="Reproducir tutorial"
                aria-label="Reproducir tutorial"
                data-tour-id="replay-tutorial"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            ) : null}
            {onHelpClick ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex"
                onClick={() => onHelpClick()}
                title="Ayuda"
                aria-label="Ayuda"
                data-tour-id="help-button"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            ) : null}
            <ThemeToggle className="h-8 w-8 shrink-0 border-0 bg-transparent hover:bg-sidebar-accent" />
          </div>

          <div className="group-data-[collapsible=icon]:hidden flex items-center justify-end gap-1">
            <div className="hidden items-center gap-1 md:flex">
              {onReplayTutorialClick ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => onReplayTutorialClick()}
                  title="Reproducir tutorial"
                  aria-label="Reproducir tutorial"
                  data-tour-id="replay-tutorial"
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
              ) : null}
              {onHelpClick ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => onHelpClick()}
                  title="Ayuda"
                  aria-label="Ayuda"
                  data-tour-id="help-button"
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
              ) : null}
            </div>
            <ThemeToggle className="h-9 w-9 shrink-0 border-0 bg-transparent hover:bg-sidebar-accent" />
          </div>
        </div>

        {isSaaSWorkspaceMode() && session ? (
          <div className="mt-3 space-y-2 group-data-[collapsible=icon]:hidden">
            {session.user.platformRole === 'superadmin' ? (
              <Button asChild variant="secondary" size="sm" className="w-full justify-start gap-2">
                <Link to="/platform" title="Panel de plataforma (superadmin)">
                  <Shield className="h-4 w-4 shrink-0" />
                  Plataforma
                </Link>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => signOut()}
              title="Cerrar sesión en la plataforma"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Salir (plataforma)
            </Button>
          </div>
        ) : null}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
