import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Home,
  FileText,
  Settings,
  Menu,
  X,
  ChevronDown,
  Wallet,
} from 'lucide-react'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ActiveAccountSwitcher } from '@/components/ActiveAccountSwitcher'
import { BalanceDisplay } from '@/components/BalanceDisplay'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  getPrimaryNavItems,
  getSettingsNavItem,
  isWalletNavActive,
  WALLET_NAV,
} from '@/config/dashboardNavigation'

type NavRow =
  | { kind: 'link'; name: string; href: string; description: string; icon: typeof Home }

function buildMobileNavRows(): NavRow[] {
  const primary = getPrimaryNavItems()
  return primary.map((p) => ({
    kind: 'link' as const,
    name: p.name,
    href: p.href,
    description:
      p.href === '/'
        ? isSaaSWorkspaceMode()
          ? 'Espacio de trabajo'
          : 'Resumen y accesos'
        : p.href === '/documents'
          ? 'Contratos y borradores'
          : p.href === '/verify'
            ? 'Verificar procedencia'
            : p.href === '/organization'
              ? 'Plan y tenant'
              : '',
    icon: p.icon,
  }))
}

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const pathname = location.pathname
  const rows = buildMobileNavRows()
  const settings = getSettingsNavItem()
  const walletActive = isWalletNavActive(pathname)

  const handleNavigation = (href: string) => {
    navigate(href)
    setIsOpen(false)
  }

  return (
    <>
      <div
        className={cn(
          'fixed bottom-4 right-4 md:hidden z-30 pointer-events-auto fab-navigation fab-dim',
        )}
        style={{
          bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
          right: 'max(1rem, env(safe-area-inset-right, 1rem))',
        }}
      >
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              data-tour-id="tour-mobile-nav-fab"
              size="lg"
              className="h-14 w-14 rounded-full transition-all duration-200"
              aria-label="Abrir menú de navegación"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom-above-fab"
            className="h-[70vh] rounded-t-2xl overflow-y-auto sheet-solid-bg"
            style={{
              bottom: 'calc(max(1rem, env(safe-area-inset-bottom, 1rem)) + 5rem)',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
            }}
          >
            <SheetHeader>
              <SheetTitle>Navegación</SheetTitle>
              <SheetDescription>Documentos, wallet Substrate y más</SheetDescription>
            </SheetHeader>
            <div className="mt-4 mb-4">
              <div className="text-sm font-medium mb-2 px-1">Balance</div>
              <div className="p-2 bg-muted rounded-lg">
                <BalanceDisplay showIcon={true} />
              </div>
            </div>
            <div className="mt-4 mb-4">
              <div className="text-sm font-medium mb-2 px-1">Cuenta activa</div>
              <ActiveAccountSwitcher />
            </div>
            <div className="mt-4 mb-4 px-1">
              <div className="text-sm font-medium mb-2">Tema</div>
              <ThemeToggle />
            </div>
            <div className="mt-6 space-y-2 pb-4">
              {rows.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80 text-foreground',
                    )}
                  >
                    <item.icon
                      className={cn(
                        'h-6 w-6 flex-shrink-0',
                        isActive ? 'text-primary-foreground' : 'text-muted-foreground',
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn('font-medium', isActive ? 'text-primary-foreground' : 'text-foreground')}
                      >
                        {item.name}
                      </div>
                      {item.description ? (
                        <div
                          className={cn(
                            'text-sm mt-0.5',
                            isActive ? 'text-primary-foreground/80' : 'text-muted-foreground',
                          )}
                        >
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                  </button>
                )
              })}

              <Collapsible defaultOpen={walletActive}>
                <CollapsibleTrigger
                  className={cn(
                    'group flex w-full items-center justify-between gap-4 p-4 rounded-lg text-left transition-colors',
                    walletActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-foreground',
                  )}
                >
                  <span className="flex items-center gap-4">
                    <Wallet
                      className={cn(
                        'h-6 w-6 flex-shrink-0',
                        walletActive ? 'text-primary-foreground' : 'text-muted-foreground',
                      )}
                    />
                    <span className="font-medium">Wallet (Substrate)</span>
                  </span>
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pl-2 pt-1">
                  {WALLET_NAV.map((w) => {
                    const isActive =
                      pathname === w.href || pathname.startsWith(w.href + '/')
                    return (
                      <button
                        key={w.href}
                        type="button"
                        onClick={() => handleNavigation(w.href)}
                        className={cn(
                          'w-full flex flex-col items-start gap-0.5 rounded-md p-3 text-left text-sm',
                          isActive
                            ? 'bg-primary/90 text-primary-foreground'
                            : 'bg-background border hover:bg-accent',
                        )}
                      >
                        <span className="font-medium">{w.name}</span>
                        <span
                          className={cn(
                            'text-xs',
                            isActive ? 'text-primary-foreground/90' : 'text-muted-foreground',
                          )}
                        >
                          {w.description}
                        </span>
                      </button>
                    )
                  })}
                </CollapsibleContent>
              </Collapsible>

              <button
                type="button"
                onClick={() => handleNavigation(settings.href)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg transition-colors text-left',
                  settings.match(pathname)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-foreground',
                )}
              >
                <settings.icon
                  className={cn(
                    'h-6 w-6 flex-shrink-0',
                    settings.match(pathname) ? 'text-primary-foreground' : 'text-muted-foreground',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{settings.name}</div>
                  <div
                    className={cn(
                      'text-sm mt-0.5',
                      settings.match(pathname) ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    Ajustes y preferencias
                  </div>
                </div>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
