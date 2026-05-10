import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Terminal } from 'lucide-react'

import { hasWorkspaceApiBase } from '@/config/saasConfig'
import { fetchPlatformStats, type PlatformStats } from '@/services/workspace/platformAdminApi'

function StatCard({ title, value, hint }: { title: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value.toLocaleString('es-ES')}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}

export default function PlatformOverview() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (!hasWorkspaceApiBase()) {
        setError('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true para usar el panel.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const { stats } = await fetchPlatformStats()
        if (!cancel) setStats(stats)
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : 'Error al cargar estadísticas')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  if (error && !stats) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>No se pudo cargar el panel</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Resumen</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Métricas de plataforma (PostgreSQL). Usa la navegación lateral para ver usuarios, organizaciones y claves.
        </p>
      </div>

      {error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !stats ? (
        <p className="text-sm text-muted-foreground">Cargando métricas…</p>
      ) : stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Organizaciones" value={stats.organizations} />
          <StatCard title="Usuarios" value={stats.users} />
          <StatCard title="Sesiones activas (tabla)" value={stats.sessions} />
          <StatCard title="Claves API" value={stats.apiKeys} hint={`${stats.apiKeysActive} activas · ${stats.apiKeysRevoked} revocadas`} />
          <StatCard title="Eventos de uso (total)" value={stats.usageEvents} hint={`Últimas 24h: ${stats.usageEvents24h.toLocaleString('es-ES')}`} />
        </div>
      ) : null}
    </div>
  )
}

