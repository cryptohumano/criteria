import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { DASHBOARD_MAIN_GUTTER, Header, type HeaderCallbacks } from '@/components/layout/Header'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useDocumentEditorLayout } from '@/contexts/DocumentEditorLayoutContext'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Unlock } from '@/components/auth/Unlock'
import { Lock } from 'lucide-react'
import { HelpCenterDialog } from '@/components/help/HelpCenterDialog'
import { SpotlightTour } from '@/components/help/SpotlightTour'

type TourKind =
  | null
  | 'documents-workspace'
  | 'documents-list'
  | 'documents-wallet-home'
  | 'wallet'

type TourStep = {
  id: string
  title: string
  body: string
  selector: string
}

function tourStorageSeen(primaryKey: string, legacyKey: string): boolean {
  try {
    return localStorage.getItem(primaryKey) === '1' || localStorage.getItem(legacyKey) === '1'
  } catch {
    return true
  }
}

const WALLET_SPOTLIGHT_STEPS: TourStep[] = [
  {
    id: 'wallet-why',
    title: 'Por qué existe la wallet',
    body:
      'CriterIA usa una wallet local (Substrate) para firmar y dar autoría verificable.\n\nPor seguridad, al recargar la app se bloquea y debes desbloquearla para crear o firmar documentos.',
    selector: '[data-tour-id="wallet-banner"]',
  },
  {
    id: 'wallet-unlock',
    title: 'Desbloquear (cuando lo necesites)',
    body:
      'Pulsa «Desbloquear» e ingresa tu contraseña (o WebAuthn).\n\nAl desbloquear, el aviso desaparece y ya puedes trabajar con documentos.',
    selector: '[data-tour-id="wallet-unlock"]',
  },
  {
    id: 'help-center',
    title: 'Ayuda siempre disponible',
    body:
      'Si tienes dudas, abre Ayuda (icono «?») para ver tutoriales cortos: wallet, perfiles del agente, exportar Markdown, etc.',
    selector: '[data-tour-id="help-button"]',
  },
]

const DOCUMENTS_WORKSPACE_REST: TourStep[] = [
  {
    id: 'docs-section',
    title: 'Tu centro de documentos',
    body:
      'Aquí están las acciones principales: crear un documento, analizar un contrato o un texto académico, y el enlace al listado completo.',
    selector: '[data-tour-id="tour-documents-section"]',
  },
  {
    id: 'docs-create',
    title: 'Crear documento',
    body:
      'Abre el asistente para elegir editor local (PDF en este dispositivo) o Etherpad colaborativo, según cómo quieras trabajar.',
    selector: '[data-tour-id="tour-create-document"]',
  },
  {
    id: 'docs-secondary',
    title: 'Análisis guiados',
    body:
      '«Analizar contrato» y «Analizar documento académico» abren el editor local con el perfil del agente adecuado (Legal MX o académico).',
    selector: '[data-tour-id="tour-documents-secondary-actions"]',
  },
  {
    id: 'docs-list-link',
    title: 'Listado de documentos',
    body:
      '«Ver todos mis documentos» lleva al listado: filtros, descargas de PDF y acceso a cada ficha.',
    selector: '[data-tour-id="tour-documents-list-link"]',
  },
  {
    id: 'docs-identity',
    title: 'Identidad digital',
    body:
      'Vincula tu cuenta de la organización con tu llave local (DID) para trazabilidad y verificación cuando lo necesites.',
    selector: '[data-tour-id="tour-digital-identity"]',
  },
]

const DOCUMENTS_LIST_SECOND: TourStep = {
  id: 'docs-page-new',
  title: 'Crear desde el listado',
  body:
    'Este botón abre el flujo «Nuevo documento» (local o Etherpad). Aquí también verás tablas, filtros y acciones sobre cada PDF o pad.',
  selector: '[data-tour-id="tour-documents-page-create"]',
}

const DOCUMENTS_WALLET_HOME_SECOND: TourStep = {
  id: 'home-docs-card',
  title: 'Documentos',
  body:
    'Tarjeta de acceso rápido al listado y creación. En modo local, la wallet ya desbloqueada permite generar y firmar PDFs en el dispositivo.',
  selector: '[data-tour-id="tour-home-documents-card"]',
}

const TUTORIAL_WALLET_SPOTLIGHT = '00_WALLET_Y_POR_QUE.md'
const TUTORIAL_DOCS_SPOTLIGHT = '06_GUIA_SPOTLIGHT_DOCUMENTOS_INICIO.md'
const TUTORIAL_EDITOR_SPOTLIGHT = '07_GUIA_SPOTLIGHT_EDITOR_ETHERPAD.md'
const TUTORIAL_QUILL_SPOTLIGHT = '08_GUIA_SPOTLIGHT_EDITOR_QUILL.md'

/** Solo ruta Etherpad colaborativa (`…/edit`), no el editor local Quill (`…/edit-quill`). */
function isEtherpadDocumentEditPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/'
  return /^\/documents\/[^/]+\/edit$/.test(p)
}

/** Editor local Quill: documento existente o flujo «nuevo local». */
function isQuillEditorPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/'
  if (p === '/documents/new-local') return true
  return /^\/documents\/[^/]+\/edit-quill$/.test(p)
}

export default function MainLayout() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { isUnlocked, storedAccountsStatus } = useKeyringContext()
  const { session } = useWorkspaceSession()
  const location = useLocation()
  const layoutCtx = useDocumentEditorLayout()
  const [dashboardSidebarOpen, setDashboardSidebarOpen] = useState(true)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpInitialTutorialId, setHelpInitialTutorialId] = useState<string | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourKind, setTourKind] = useState<TourKind>(null)
  const [tourSeq, setTourSeq] = useState(0)

  const showAppChrome = (isSaaSWorkspaceMode() && !!session) || isUnlocked

  const bumpTourSeq = useCallback(() => setTourSeq((n) => n + 1), [])

  const markDocumentsIntroSeen = useCallback(() => {
    try {
      localStorage.setItem('criteria.help.tour.documentsIntro.v1.seen', '1')
      localStorage.setItem('nelai.help.tour.documentsIntro.v1.seen', '1')
    } catch {
      /* ignore */
    }
    bumpTourSeq()
  }, [bumpTourSeq])

  const markWalletTourSeen = useCallback(() => {
    try {
      localStorage.setItem('criteria.help.tour.wallet.v1.seen', '1')
      localStorage.setItem('nelai.help.tour.wallet.v1.seen', '1')
    } catch {
      /* ignore */
    }
    bumpTourSeq()
  }, [bumpTourSeq])

  const replaySpotlightTour = useCallback(
    (tutorialId?: string | null) => {
      const id = typeof tutorialId === 'string' ? tutorialId.trim() : ''
      const effectiveId = id || undefined

      if (effectiveId) {
        const hasGuided =
          effectiveId === TUTORIAL_WALLET_SPOTLIGHT ||
          effectiveId === TUTORIAL_DOCS_SPOTLIGHT ||
          effectiveId === TUTORIAL_EDITOR_SPOTLIGHT ||
          effectiveId === TUTORIAL_QUILL_SPOTLIGHT
        if (!hasGuided) {
          toast.info('Este tutorial no tiene reproducción guiada en pantalla.')
          return
        }
      }

      const path = location.pathname.replace(/\/$/, '') || '/'

      if (effectiveId === TUTORIAL_DOCS_SPOTLIGHT) {
        setHelpOpen(false)
        const openWorkspace = () => {
          setTourKind('documents-workspace')
          setTourOpen(true)
        }
        const openList = () => {
          setTourKind('documents-list')
          setTourOpen(true)
        }
        const openWalletHome = () => {
          setTourKind('documents-wallet-home')
          setTourOpen(true)
        }
        if (path === '/documents') {
          openList()
          return
        }
        if (path === '/' || path === '') {
          if (isSaaSWorkspaceMode() && session) {
            openWorkspace()
            return
          }
          if (!isSaaSWorkspaceMode() && isUnlocked) {
            openWalletHome()
            return
          }
        }
        navigate('/')
        window.setTimeout(() => {
          if (isSaaSWorkspaceMode() && session) openWorkspace()
          else if (!isSaaSWorkspaceMode() && isUnlocked) openWalletHome()
          else {
            toast.info('Inicia sesión o desbloquea la wallet para ver este recorrido en inicio.')
          }
        }, 400)
        return
      }

      if (effectiveId === TUTORIAL_EDITOR_SPOTLIGHT) {
        setHelpOpen(false)
        if (!isEtherpadDocumentEditPath(location.pathname)) {
          toast.info('Abre un documento colaborativo Etherpad', {
            description: 'Ve a Documentos, abre un pad y entra al editor (ruta …/edit).',
          })
          return
        }
        window.dispatchEvent(new CustomEvent('criteria-replay-editor-spotlight'))
        return
      }

      if (effectiveId === TUTORIAL_QUILL_SPOTLIGHT) {
        setHelpOpen(false)
        if (!isQuillEditorPath(location.pathname)) {
          toast.info('Abre el editor local (Quill)', {
            description: 'Nuevo documento local o un documento con «…/edit-quill».',
          })
          return
        }
        window.dispatchEvent(new CustomEvent('criteria-replay-quill-spotlight'))
        return
      }

      setHelpInitialTutorialId('00_WALLET_Y_POR_QUE.md')
      setHelpOpen(true)
      setTourKind('wallet')
      setTourOpen(true)
    },
    [location.pathname, navigate, session, isUnlocked],
  )

  useEffect(() => {
    if (unlockOpen && isUnlocked) setUnlockOpen(false)
  }, [unlockOpen, isUnlocked])

  const p = location.pathname.replace(/\/$/, '') || '/'
  const isDocumentEditor =
    p === '/documents/new-etherpad' ||
    p === '/documents/new-local' ||
    /^\/documents\/[^/]+\/edit(-quill)?$/.test(p)

  const unlockTourEligible =
    isSaaSWorkspaceMode() &&
    !!session &&
    !isUnlocked &&
    storedAccountsStatus !== 'none'

  // Primero tour de documentos (inicio o listado); después, si aplica, tour de wallet bloqueada.
  useEffect(() => {
    if (!showAppChrome) return
    if (tourOpen) return

    const docsSeen = tourStorageSeen(
      'criteria.help.tour.documentsIntro.v1.seen',
      'nelai.help.tour.documentsIntro.v1.seen',
    )
    const walletSeen = tourStorageSeen('criteria.help.tour.wallet.v1.seen', 'nelai.help.tour.wallet.v1.seen')
    const path = location.pathname.replace(/\/$/, '') || '/'

    if (!docsSeen) {
      if (isSaaSWorkspaceMode() && session) {
        if (path === '/' || path === '') {
          setTourKind('documents-workspace')
          setTourOpen(true)
          return
        }
        if (path === '/documents') {
          setTourKind('documents-list')
          setTourOpen(true)
          return
        }
      } else if (!isSaaSWorkspaceMode() && isUnlocked) {
        if (path === '/' || path === '') {
          setTourKind('documents-wallet-home')
          setTourOpen(true)
          return
        }
        if (path === '/documents') {
          setTourKind('documents-list')
          setTourOpen(true)
          return
        }
      }
    }

    if (!walletSeen && unlockTourEligible) {
      setHelpInitialTutorialId('00_WALLET_Y_POR_QUE.md')
      setHelpOpen(true)
      setTourKind('wallet')
      setTourOpen(true)
    }
  }, [
    showAppChrome,
    tourOpen,
    session,
    isUnlocked,
    storedAccountsStatus,
    tourSeq,
    location.pathname,
    unlockTourEligible,
  ])

  const spotlightSteps = useMemo((): TourStep[] => {
    switch (tourKind) {
      case 'documents-workspace': {
        const nav: TourStep = isMobile
          ? {
              id: 'docs-nav-mobile',
              title: 'Menú en el móvil',
              body:
                'Pulsa el botón flotante abajo a la derecha para abrir Inicio, Documentos, Ajustes y la sección Wallet.',
              selector: '[data-tour-id="tour-mobile-nav-fab"]',
            }
          : {
              id: 'docs-nav-sidebar',
              title: 'Documentos en el menú',
              body:
                'Desde «Documentos» en la barra lateral accedes al listado completo: filtros, descargas y edición de cada ficha.',
              selector: '[data-tour-id="tour-nav-documents"]',
            }
        return [nav, ...DOCUMENTS_WORKSPACE_REST]
      }
      case 'documents-list': {
        const nav: TourStep = isMobile
          ? {
              id: 'docs-list-nav-mobile',
              title: 'Menú en el móvil',
              body: 'Usa el botón flotante para cambiar de sección; «Documentos» está en ese menú.',
              selector: '[data-tour-id="tour-mobile-nav-fab"]',
            }
          : {
              id: 'docs-list-nav-sidebar',
              title: 'Navegación',
              body: 'El enlace Documentos del menú lateral te trae aquí cuando estés en otra parte de la app.',
              selector: '[data-tour-id="tour-nav-documents"]',
            }
        return [nav, DOCUMENTS_LIST_SECOND]
      }
      case 'documents-wallet-home': {
        const nav: TourStep = isMobile
          ? {
              id: 'wallet-home-nav-m',
              title: 'Menú móvil',
              body: 'Abre el menú flotante para ir a Documentos, Wallet y el resto de secciones.',
              selector: '[data-tour-id="tour-mobile-nav-fab"]',
            }
          : {
              id: 'wallet-home-nav-d',
              title: 'Documentos',
              body: 'En el menú lateral, Documentos concentra tus PDF y borradores en este dispositivo.',
              selector: '[data-tour-id="tour-nav-documents"]',
            }
        return [nav, DOCUMENTS_WALLET_HOME_SECOND]
      }
      case 'wallet':
        return unlockTourEligible
          ? [...WALLET_SPOTLIGHT_STEPS]
          : WALLET_SPOTLIGHT_STEPS.filter((s) => s.id === 'help-center')
      default:
        return []
    }
  }, [tourKind, isMobile, unlockTourEligible])

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
    'flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden',
    !isDocumentEditor ? 'py-5 md:py-8 lg:py-10' : 'p-0',
  )

  const mainInnerStyle: CSSProperties = {
    scrollBehavior: 'smooth',
    ...(isMobile && showAppChrome
      ? {
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px) + 5rem)',
          WebkitOverflowScrolling: 'touch' as const,
        }
      : {}),
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
    storedAccountsStatus !== 'none'

  const helpHeaderProps: HeaderCallbacks = {
    onHelpClick: () => {
      setHelpInitialTutorialId(null)
      setHelpOpen(true)
    },
    onReplayTutorialClick: replaySpotlightTour,
  }

  return (
    <AuthGuard>
      <SidebarProvider open={sidebarOpen} onOpenChange={onSidebarOpenChange}>
        {isDocumentEditor ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
            <AppSidebar {...helpHeaderProps} />
            <SidebarInset
              id="shell-document-editor-main"
              className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <div className={cn(mainInnerClass, 'flex min-h-0 min-w-0 flex-1')} style={mainInnerStyle}>
                <Outlet />
              </div>
            </SidebarInset>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
            <AppSidebar {...helpHeaderProps} />
            <SidebarInset id="shell-dashboard-main" className="flex flex-1 flex-col">
              <div className="md:hidden">
                <Header {...helpHeaderProps} />
              </div>
              {shouldShowUnlockNudge && (
                <div className="shrink-0 border-b border-border bg-muted/30">
                  <div
                    className={cn(
                      DASHBOARD_MAIN_GUTTER,
                      'flex items-center gap-2 py-2 text-sm',
                    )}
                    data-tour-id="wallet-banner"
                  >
                    <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">Wallet bloqueada.</span>{' '}
                      <span className="text-muted-foreground">
                        Para crear/firmar documentos necesitas desbloquear tus cuentas de Substrate en este
                        dispositivo.
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
                <div className={DASHBOARD_MAIN_GUTTER}>
                  <Outlet />
                </div>
              </div>
            </SidebarInset>
          </div>
        )}
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
        onOpenChange={(v) => {
          setTourOpen(v)
          if (!v) {
            if (tourKind === 'wallet') markWalletTourSeen()
            else if (
              tourKind === 'documents-workspace' ||
              tourKind === 'documents-list' ||
              tourKind === 'documents-wallet-home'
            ) {
              markDocumentsIntroSeen()
            }
            setTourKind(null)
          }
        }}
        initialStepId={spotlightSteps[0]?.id ?? 'wallet-why'}
        steps={spotlightSteps}
      />
    </AuthGuard>
  )
}
