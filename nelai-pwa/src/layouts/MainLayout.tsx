import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useDocumentEditorLayout } from '@/contexts/DocumentEditorLayoutContext'
import { useWorkspaceSession } from '@/contexts/WorkspaceSessionContext'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Unlock } from '@/components/auth/Unlock'
import { Lock } from 'lucide-react'
import { HelpCenterDialog } from '@/components/help/HelpCenterDialog'
import { SpotlightTour } from '@/components/help/SpotlightTour'

export default function MainLayout() {
  const isMobile = useIsMobile()
  const { isUnlocked, storedAccountsStatus } = useKeyringContext()
  const { session } = useWorkspaceSession()
  const location = useLocation()
  const layoutCtx = useDocumentEditorLayout()
  const [dashboardSidebarOpen, setDashboardSidebarOpen] = useState(true)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpInitialTutorialId, setHelpInitialTutorialId] = useState<string | null>(null)
  const [tourOpen, setTourOpen] = useState(false)

  const showAppChrome = (isSaaSWorkspaceMode() && !!session) || isUnlocked

  const replaySpotlightTour = useCallback(() => {
    setHelpInitialTutorialId('00_WALLET_Y_POR_QUE.md')
    setHelpOpen(true)
    setTourOpen(true)
  }, [])

  // Si el usuario desbloquea desde el diálogo, cerrarlo automáticamente.
  // Debe declararse antes de cualquier return condicional para no romper el orden de hooks.
  useEffect(() => {
    if (unlockOpen && isUnlocked) setUnlockOpen(false)
  }, [unlockOpen, isUnlocked])

  // Tour: primera visita (en este dispositivo) para explicar por qué existe la wallet.
  useEffect(() => {
    if (!showAppChrome) return
    // Solo en modo app (cuando se ve el chrome), y solo si no se ha visto antes.
    const key = 'criteria.help.tour.wallet.v1.seen'
    try {
      // Migración: antes se llamaba `nelai.help...`
      const legacyKey = 'nelai.help.tour.wallet.v1.seen'
      const seen = localStorage.getItem(key) === '1' || localStorage.getItem(legacyKey) === '1'
      if (seen) return
      // Si hay vault o está en unknown/error, mostrar el tutorial de wallet.
      if (storedAccountsStatus !== 'none') {
        setHelpInitialTutorialId('00_WALLET_Y_POR_QUE.md')
        setHelpOpen(true)
        setTourOpen(true)
        localStorage.setItem(key, '1')
        localStorage.setItem(legacyKey, '1')
      }
    } catch {
      // ignore
    }
  }, [showAppChrome, storedAccountsStatus])

  const p = location.pathname.replace(/\/$/, '') || '/'
  const isDocumentEditor =
    p === '/documents/new-etherpad' ||
    p === '/documents/new-local' ||
    /^\/documents\/[^/]+\/edit(-quill)?$/.test(p)

  const sidebarOpen = isDocumentEditor ? (layoutCtx?.sidebarOpen ?? false) : dashboardSidebarOpen

  const onSidebarOpenChange = useCallback(
    (open: boolean) => {
      if (isDocumentEditor) {
        layoutCtx?.setSidebarOpen(open)
      } else {
        setDashboardSidebarOpen(open)
      }
    },
    [isDocumentEditor, layoutCtx],
  )

  const mainInnerClass = cn(
    // `min-w-0` es clave: evita que el contenido “ignore” el layout flex cuando hay sidebar.
    'flex-1 min-h-0 min-w-0 overflow-y-auto',
    !isDocumentEditor ? 'p-4 md:p-6 lg:p-8' : 'p-0',
    isMobile && showAppChrome && 'pb-28',
  )

  const mainInnerStyle: CSSProperties = {
    scrollBehavior: 'smooth',
    paddingBottom:
      isMobile && showAppChrome
        ? 'calc(1rem + env(safe-area-inset-bottom, 0px) + 5rem)'
        : undefined,
    WebkitOverflowScrolling: 'touch',
  }

  if (!showAppChrome) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-background flex flex-col">
          <Outlet />
        </div>
      </AuthGuard>
    )
  }

  const shouldShowUnlockNudge =
    isSaaSWorkspaceMode() &&
    !!session &&
    !isUnlocked &&
    // Si sabemos que NO hay cuentas, no molestamos con unlock (es onboarding/crear).
    storedAccountsStatus !== 'none'

  return (
    <AuthGuard>
      <SidebarProvider open={sidebarOpen} onOpenChange={onSidebarOpenChange}>
        {!isDocumentEditor && <AppSidebar />}
        <SidebarInset className="flex flex-1 flex-col">
          {!isDocumentEditor && (
            <Header
              onHelpClick={() => {
                setHelpInitialTutorialId(null)
                setHelpOpen(true)
              }}
              onReplayTutorialClick={replaySpotlightTour}
            />
          )}
          {shouldShowUnlockNudge && (
            <div className="border-b bg-muted/40">
              <div
                className="mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8 py-2 flex items-center gap-2 text-sm"
                data-tour-id="wallet-banner"
              >
                <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">Wallet bloqueada.</span>{' '}
                  <span className="text-muted-foreground">
                    Para crear/firmar documentos necesitas desbloquear tus cuentas de Substrate en este dispositivo.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUnlockOpen(true)}
                  data-tour-id="wallet-unlock"
                >
                  Desbloquear
                </Button>
              </div>
            </div>
          )}
          <div className={cn(mainInnerClass, 'flex-1 min-h-0')} style={mainInnerStyle}>
            {/* En escritorio, muchas pages tenían `container/max-w` propios y se sentían “estáticas”.
                Este wrapper da una jerarquía consistente y responsiva al sidebar. */}
            {!isDocumentEditor ? (
              <div className="mx-auto w-full max-w-6xl min-w-0">
                <Outlet />
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </SidebarInset>
        {isMobile && <BottomNav />}
      </SidebarProvider>

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent
          className={
            '!flex max-h-[min(90dvh,760px)] w-[min(96vw,56rem)] max-w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(88dvh,720px)] lg:max-w-4xl'
          }
        >
          <div className="shrink-0 border-b px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14">
            <DialogHeader className="space-y-0 text-left">
              <DialogTitle>Desbloquear wallet</DialogTitle>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
            <Unlock variant="dialog" />
          </div>
        </DialogContent>
      </Dialog>

      <HelpCenterDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        initialTutorialId={helpInitialTutorialId}
        onReplaySpotlight={replaySpotlightTour}
      />

      <SpotlightTour
        open={tourOpen}
        onOpenChange={setTourOpen}
        initialStepId="wallet-why"
        steps={[
          {
            id: 'wallet-why',
            title: 'Por qué existe la wallet',
            body:
              'CriterIA usa una wallet local (Substrate) para firmar y dar autoría verificable.\\n\\nPor seguridad, al recargar la app se bloquea y debes desbloquearla para crear/firmar documentos.',
            selector: '[data-tour-id=\"wallet-banner\"]',
          },
          {
            id: 'wallet-unlock',
            title: 'Desbloquear (cuando lo necesites)',
            body:
              'Pulsa “Desbloquear” e ingresa tu contraseña (o WebAuthn).\\n\\nAl desbloquear, el aviso desaparece y ya puedes trabajar con documentos.',
            selector: '[data-tour-id=\"wallet-unlock\"]',
          },
          {
            id: 'help-center',
            title: 'Ayuda siempre disponible',
            body:
              'Si tienes dudas, abre Ayuda (icono “?”) para ver tutoriales cortos: wallet, perfiles del agente, exportar Markdown, etc.',
            selector: '[data-tour-id=\"help-button\"]',
          },
        ]}
      />
    </AuthGuard>
  )
}
