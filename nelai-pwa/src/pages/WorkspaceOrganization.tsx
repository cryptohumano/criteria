import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWorkspaceSession } from '@/contexts/WorkspaceSessionContext'
import { Badge } from '@/components/ui/badge'

export default function WorkspaceOrganization() {
  const { session } = useWorkspaceSession()

  if (!session) return null

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-bold">Organización</h1>
      <Card>
        <CardHeader>
          <CardTitle>{session.organization.name}</CardTitle>
          <CardDescription>Identificador interno (demo): {session.organization.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Plan</span>
            <Badge variant="secondary">{session.organization.plan}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Cuenta</span>
            <Badge variant="outline">
              {session.organization.kind === 'personal' ? 'Personal (B2C)' : 'Equipo (B2B)'}
            </Badge>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Rol en org</span>
            <Badge variant="outline">{session.user.orgRole}</Badge>
            {session.user.platformRole === 'superadmin' ? (
              <Badge>Plataforma: superadmin</Badge>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground">Tu usuario</p>
            <p className="font-medium">{session.user.displayName}</p>
            <p className="text-muted-foreground">{session.user.email}</p>
          </div>
          <p className="text-muted-foreground pt-2 border-t">
            Aquí conectarás facturación (Stripe), límites por plan y miembros del equipo cuando el backend
            esté enlazado a base de datos.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
