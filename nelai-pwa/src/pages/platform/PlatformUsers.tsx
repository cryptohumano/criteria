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
import { fetchPlatformUsers, type PlatformUserRow } from '@/services/workspace/platformAdminApi'

export default function PlatformUsers() {
  const [rows, setRows] = useState<PlatformUserRow[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
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
        const u = await fetchPlatformUsers({ take: 200 })
        if (!cancel) {
          setRows(u.users)
          setTotal(u.total)
        }
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : 'Error al listar usuarios')
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
        <CardTitle>Usuarios</CardTitle>
        <CardDescription>
          Listado de usuarios (primeros {total != null ? total : '…'}; muestra correo solo para superadmin).
        </CardDescription>
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
                  <TableHead>Correo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Organización</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Rol org</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Alta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-sm max-w-[240px] truncate" title={u.email}>
                      {u.email}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{u.displayName || '—'}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={u.organization.name}>
                      {u.organization.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.organization.plan}</Badge>
                    </TableCell>
                    <TableCell>{u.orgRole}</TableCell>
                    <TableCell>
                      {u.platformRole === 'superadmin' ? <Badge>superadmin</Badge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
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

