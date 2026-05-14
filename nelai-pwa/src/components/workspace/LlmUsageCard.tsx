import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { hasWorkspaceApiBase } from '@/config/saasConfig'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { fetchLlmUsage, type LlmUsageResponse } from '@/services/workspace/usageApi'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('es-ES')
}

/**
 * Muestra consumo de tokens de IA del mes (proxy con clave de plataforma), si hay backend SaaS.
 */
export function LlmUsageCard() {
  const { session } = useWorkspaceSession()
  const planKey = session?.organization?.plan ?? ''
  const [data, setData] = useState<LlmUsageResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSaaSWorkspaceMode() || !hasWorkspaceApiBase()) {
      setLoading(false)
      return
    }
    let cancel = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const d = await fetchLlmUsage()
        if (!cancel) setData(d)
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'No se pudo cargar el uso')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [planKey])

  if (!isSaaSWorkspaceMode() || !hasWorkspaceApiBase()) {
    return null
  }

  if (loading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Uso de IA (plataforma)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando…</p>
        </CardContent>
      </Card>
    )
  }

  if (err) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>{err}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  if (data.trialExpired) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>
          Tu periodo de prueba terminó. Contrata un plan en Ajustes → Facturación para seguir usando IA y Etherpad en
          equipo.
        </AlertDescription>
      </Alert>
    )
  }

  const pct =
    data.unlimited || data.monthlyTokenLimit <= 0
      ? 0
      : Math.min(100, (data.usedTokensThisMonth / data.monthlyTokenLimit) * 100)

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Uso de IA (plataforma)
        </CardTitle>
        <CardDescription>
          Periodo{' '}
          {data.periodSource === 'stripe'
            ? 'de facturación'
            : data.periodSource === 'rolling-fortnight'
              ? 'quincenal (rodante)'
              : 'calendario'}
          :{' '}
          {new Date(data.periodStart).toLocaleDateString('es-ES', { timeZone: 'UTC' })}
          {data.periodEnd
            ? ` → ${new Date(data.periodEnd).toLocaleDateString('es-ES', { timeZone: 'UTC' })}`
            : ' → …'}{' '}
          (UTC). Plan:{' '}
          <span className="font-medium text-foreground">{data.plan}</span>
          {data.maxUsersPerOrg != null && data.maxUsersPerOrg > 0
            ? ` · hasta ${data.maxUsersPerOrg} usuario(s)`
            : data.maxUsersPerOrg === 0
              ? ' · usuarios sin tope (catálogo)'
              : null}
          {data.quotaEnforced ? ' · cupo activo' : ' · sin bloqueo estricto (entorno de desarrollo)'}
          {data.plan === 'trial' && data.trialEndsAt ? (
            <>
              {' '}
              · Fin trial:{' '}
              {new Date(data.trialEndsAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.noDatabase ? (
          <p className="text-sm text-muted-foreground">
            Sin base de datos en el servidor: no hay registro de uso. Configura <code className="text-xs">DATABASE_URL</code> en
            el proceso de la API.
          </p>
        ) : data.unlimited ? (
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{formatTokens(data.usedTokensThisMonth)}</span> tokens en este
            periodo
            (sin tope de plan).
          </p>
        ) : (
          <>
            <div className="flex justify-between text-sm gap-2">
              <span className="text-muted-foreground">Consumo</span>
              <span className="tabular-nums font-medium">
                {formatTokens(data.usedTokensThisMonth)} / {formatTokens(data.monthlyTokenLimit)} tokens
              </span>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {pct >= 90
                ? 'Cerca del límite. Tras alcanzarlo, las peticiones con clave del servidor pueden devolver error 402 hasta el próximo periodo.'
                : 'Solo cuentan las peticiones a Gemini vía proxy con la clave del sistema (no BYOK en el dispositivo).'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
