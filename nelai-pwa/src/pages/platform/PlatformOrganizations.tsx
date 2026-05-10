import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { hasWorkspaceApiBase } from '@/config/saasConfig'
import { fetchPlatformOrganizations } from '@/services/workspace/platformAdminApi'

export default function PlatformOrganizations() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchPlatformOrganizations>>['organizations'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      if (!hasWorkspaceApiBase()) {
        setError('Configura VITE_API_BASE_URL o VITE_API_USE_SAME_ORIGIN=true.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const o = await fetchPlatformOrganizations({ take: 100 })
        if (!cancel) setRows(o.organizations)
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : 'Error al listar organizaciones')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizaciones</CardTitle>
        <CardDescription>Tenants recientes (plan, uso, Stripe).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {loading && !rows ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : rows && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay filas.</p>
        ) : rows ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Usuarios</TableHead>
                  <TableHead className="text-right">Tope usuarios (plan)</TableHead>
                  <TableHead className="text-right">API keys</TableHead>
                  <TableHead className="text-right">Eventos uso</TableHead>
                  <TableHead className="text-right">LLM tokens (mes)</TableHead>
                  <TableHead className="text-right">Cupo LLM</TableHead>
                  <TableHead>Stripe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium max-w-[240px] truncate" title={o.name}>
                      {o.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{o.plan}</Badge>
                    </TableCell>
                    <TableCell>{o.kind === 'personal' ? 'Personal' : 'Equipo'}</TableCell>
                    <TableCell className="text-right tabular-nums">{o._count.users}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {o.maxUsersPerOrg == null
                        ? '—'
                        : o.maxUsersPerOrg === 0
                          ? '∞'
                          : o.maxUsersPerOrg.toLocaleString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o._count.apiKeys}</TableCell>
                    <TableCell className="text-right tabular-nums">{o._count.usageEvents}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {(o.llmTokensThisMonth ?? 0).toLocaleString('es-ES')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {o.llmTokenLimit == null ? '—' : o.llmTokenLimit === 0 ? '∞' : o.llmTokenLimit.toLocaleString('es-ES')}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                      {o.stripeCustomerId ? `cus…${o.stripeCustomerId.slice(-6)}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

