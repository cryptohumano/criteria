import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  FileText,
  Bot,
  Users,
  Fingerprint,
  Loader2,
  PlusCircle,
  List,
  Scale,
  GraduationCap,
  Info,
} from 'lucide-react'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { getAllDocuments } from '@/utils/documentStorage'
import { hasWorkspaceApiBase } from '@/config/saasConfig'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { fetchLlmUsage, type LlmUsageResponse } from '@/services/workspace/usageApi'
import { DigitalIdentityModal } from '@/components/workspace/DigitalIdentityModal'
import { cn } from '@/lib/utils'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('es-ES')
}

const tipSurface =
  'max-w-xs border bg-popover px-3 py-2 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-md sm:max-w-sm'

function InfoTip({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            className,
          )}
          aria-label={label}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className={tipSurface}>
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

export default function WorkspaceHome() {
  const { session } = useWorkspaceSession()
  const { isUnlocked, storedAccountsStatus, accounts } = useKeyringContext()
  const { activeAccount, activeAccountData } = useActiveAccount()
  const [identityOpen, setIdentityOpen] = useState(false)

  const walletLockedWithVault = storedAccountsStatus !== 'none' && !isUnlocked

  const [docLoading, setDocLoading] = useState(true)
  const [docCounts, setDocCounts] = useState<{ total: number; collaborative: number; local: number } | null>(null)

  const loadDocs = useCallback(async () => {
    if (walletLockedWithVault) {
      setDocCounts(null)
      setDocLoading(false)
      return
    }
    setDocLoading(true)
    try {
      const docs = await getAllDocuments()
      let collaborative = 0
      let local = 0
      for (const d of docs) {
        if (d.category === 'etherpad') collaborative += 1
        else local += 1
      }
      setDocCounts({ total: docs.length, collaborative, local })
    } catch {
      setDocCounts({ total: 0, collaborative: 0, local: 0 })
    } finally {
      setDocLoading(false)
    }
  }, [walletLockedWithVault])

  useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  const [usage, setUsage] = useState<LlmUsageResponse | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageErr, setUsageErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isSaaSWorkspaceMode() || !hasWorkspaceApiBase() || !session) {
      setUsage(null)
      setUsageErr(null)
      setUsageLoading(false)
      return
    }
    let cancel = false
    ;(async () => {
      setUsageLoading(true)
      setUsageErr(null)
      try {
        const d = await fetchLlmUsage()
        if (!cancel) setUsage(d)
      } catch (e) {
        if (!cancel) setUsageErr(e instanceof Error ? e.message : 'No se pudo cargar el uso')
      } finally {
        if (!cancel) setUsageLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [session?.organization.id, session?.organization.plan])

  if (!session) return null

  const tokenPct =
    usage && !usage.unlimited && usage.monthlyTokenLimit > 0
      ? Math.min(100, (usage.usedTokensThisMonth / usage.monthlyTokenLimit) * 100)
      : 0

  const maxSeats = usage?.maxUsersPerOrg
  const usedSeats = usage?.memberCount
  const seatsLine =
    usage == null
      ? null
      : maxSeats == null || maxSeats === undefined
        ? `${usedSeats ?? '—'} miembro(es)`
        : maxSeats === 0
          ? `${usedSeats ?? 0} miembro(es) · sin tope de asientos`
          : `${usedSeats ?? 0} / ${maxSeats} asientos usados`

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4 md:space-y-5">
        <DigitalIdentityModal
          open={identityOpen}
          onOpenChange={setIdentityOpen}
          session={session}
          substrateAddress={activeAccount}
          activeAccountData={activeAccountData}
        />

        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="sr-only">Espacio de trabajo</h1>
              <p className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {session.organization.name}
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                <span className="text-foreground/90">{session.user.displayName}</span>
                {' · '}
                Plan <span className="font-medium text-foreground/90">{session.organization.plan}</span>
              </p>
            </div>
            <InfoTip label="Qué encontrarás en esta página">
              <span className="block space-y-2">
                <span>
                  Abajo tienes acciones para documentos y un resumen compacto (documentos en este navegador, tokens de
                  IA del tenant, asientos de equipo).
                </span>
                <span>Verificación, organización y wallet siguen en el menú lateral.</span>
              </span>
            </InfoTip>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 self-start sm:self-center"
            onClick={() => setIdentityOpen(true)}
            data-tour-id="tour-digital-identity"
          >
            <Fingerprint className="h-4 w-4" />
            Identidad digital
          </Button>
        </header>

        <section
          aria-label="Trabajar con documentos"
          className="rounded-lg border border-primary/20 bg-primary/5 p-4 shadow-sm md:p-5"
          data-tour-id="tour-documents-section"
        >
          {accounts.length === 0 ? (
            <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
              Primera vez: al abrir analizar o crear documento te pediremos una identidad local (llave Substrate) en
              este navegador — necesaria para autoría, privacidad entre documentos y firmas. Puedes gestionarla luego en{' '}
              <Link to="/accounts" className="font-medium text-foreground underline-offset-2 hover:underline">
                Cuentas
              </Link>
              .
            </p>
          ) : null}
          <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">Documentos</h2>
                <InfoTip label="Diferencia entre acciones">
                  <span className="block space-y-2">
                    <span>
                      <strong className="text-foreground">Crear documento</strong> abre la elección entre editor local
                      (Quill) y colaborativo (Etherpad).
                    </span>
                    <span>
                      <strong className="text-foreground">Analizar contrato</strong> abre el editor local con perfil
                      Legal MX y la pestaña Privacidad del agente para revisar datos personales antes de enviar a la IA.
                    </span>
                    <span>
                      <strong className="text-foreground">Académico</strong> abre el mismo editor con perfil académico y
                      el panel del agente listo para pegar texto o adjuntar archivos.
                    </span>
                  </span>
                </InfoTip>
              </div>
              <div
                className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-2 lg:grid-cols-3"
                data-tour-id="tour-documents-secondary-actions"
              >
                <Button asChild size="default" className="w-full gap-2 lg:col-span-1">
                  <Link to="/documents/new" data-tour-id="tour-create-document">
                    <PlusCircle className="h-4 w-4 shrink-0" />
                    Crear documento
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="w-full gap-2">
                  <Link to="/documents/new-local?intent=contract">
                    <Scale className="h-4 w-4 shrink-0" />
                    Analizar contrato
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full gap-2 sm:col-span-2 lg:col-span-1">
                  <Link to="/documents/new-local?intent=academic">
                    <GraduationCap className="h-4 w-4 shrink-0" />
                    Analizar documento académico
                  </Link>
                </Button>
              </div>
              <Button asChild variant="link" size="sm" className="h-auto px-0 py-0 text-muted-foreground">
                <Link to="/documents" className="inline-flex items-center gap-1.5" data-tour-id="tour-documents-list-link">
                  <List className="h-3.5 w-3.5" />
                  Ver todos mis documentos
                </Link>
              </Button>
            </div>
        </section>

        <section aria-label="Resumen" className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Resumen</h2>
            <InfoTip label="Sobre estas cifras">
              <span className="block space-y-2">
                <span>
                  Los documentos se cuentan en este navegador (IndexedDB). Tokens: consumo del tenant vía proxy de
                  plataforma en el periodo del plan.
                </span>
                <span>Asientos: miembros actuales de la organización en servidor frente al tope del plan.</span>
              </span>
            </InfoTip>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="h-3.5 w-3.5" />
                  Documentos
                </CardTitle>
                <InfoTip label="Almacén local" className="h-6 w-6">
                  PDFs y borradores asociados a cuentas de este dispositivo. Si la billetera está bloqueada, el conteo no
                  está disponible.
                </InfoTip>
              </CardHeader>
              <CardContent className="space-y-2 pb-4 pt-0">
                {walletLockedWithVault ? (
                  <p className="text-xs text-muted-foreground">Billetera bloqueada.</p>
                ) : docLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cargando…
                  </div>
                ) : docCounts ? (
                  <>
                    <p className="text-2xl font-semibold tabular-nums">{docCounts.total}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {docCounts.collaborative} colab. · {docCounts.local} locales
                    </p>
                  </>
                ) : null}
                <Button asChild variant="outline" size="sm" className="h-8 w-full text-xs">
                  <Link to="/documents">Listado</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
                  <Bot className="h-3.5 w-3.5" />
                  Tokens IA
                </CardTitle>
                <InfoTip label="Uso de IA" className="h-6 w-6">
                  Peticiones al modelo a través del proxy con clave del sistema, en el periodo de facturación o calendario
                  del plan.
                </InfoTip>
              </CardHeader>
              <CardContent className="space-y-2 pb-4 pt-0">
                {!hasWorkspaceApiBase() ? (
                  <p className="text-xs text-muted-foreground">Sin API.</p>
                ) : usageLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cargando…
                  </div>
                ) : usageErr ? (
                  <p className="text-xs text-destructive">{usageErr}</p>
                ) : usage?.noDatabase ? (
                  <p className="text-xs text-muted-foreground">Sin DB en servidor.</p>
                ) : usage?.unlimited ? (
                  <p className="text-xs">
                    <span className="font-semibold tabular-nums">{formatTokens(usage.usedTokensThisMonth)}</span>
                    <span className="text-muted-foreground"> · sin tope</span>
                  </p>
                ) : usage ? (
                  <>
                    <div className="flex justify-between gap-1 text-[11px]">
                      <span className="text-muted-foreground">Consumo</span>
                      <span className="tabular-nums font-medium">
                        {formatTokens(usage.usedTokensThisMonth)} / {formatTokens(usage.monthlyTokenLimit)}
                      </span>
                    </div>
                    <Progress value={tokenPct} className="h-1.5" />
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="h-3.5 w-3.5" />
                  Asientos
                </CardTitle>
                <InfoTip label="Asientos de equipo" className="h-6 w-6">
                  Usuarios vinculados a la organización en la base de datos de la plataforma, comparados con el máximo
                  permitido por el plan contratado.
                </InfoTip>
              </CardHeader>
              <CardContent className="space-y-2 pb-4 pt-0">
                {!hasWorkspaceApiBase() ? (
                  <p className="text-xs text-muted-foreground">Sin API.</p>
                ) : usageLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cargando…
                  </div>
                ) : usageErr ? (
                  <p className="text-xs text-destructive">{usageErr}</p>
                ) : seatsLine ? (
                  <p className="text-base font-semibold tabular-nums leading-snug">{seatsLine}</p>
                ) : null}
                <Button asChild variant="outline" size="sm" className="h-8 w-full text-xs">
                  <Link to="/organization">Organización</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </TooltipProvider>
  )
}
