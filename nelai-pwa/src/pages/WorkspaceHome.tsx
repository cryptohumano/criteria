import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, ShieldCheck, Building2, Wallet } from 'lucide-react'
import { useWorkspaceSession } from '@/contexts/WorkspaceSessionContext'

export default function WorkspaceHome() {
  const { session } = useWorkspaceSession()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Espacio de trabajo</h1>
        <p className="text-muted-foreground mt-1">
          {session?.organization.name} — plan {session?.organization.plan}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Hola, {session?.user.displayName}. Desde aquí accedes a documentos legales asistidos por IA y a
          la verificación de procedencia. El almacén local de firmas Substrate solo hace falta cuando vayas
          a firmar documentos con tu llave o a usar envío en cadena: configúralo desde Cuentas cuando lo
          necesites.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </CardTitle>
            <CardDescription>Contratos y borradores con asistente</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/documents">Ir a documentos</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Verificación
            </CardTitle>
            <CardDescription>Procedencia y firmas</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full">
              <Link to="/verify">Verificar</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organización
            </CardTitle>
            <CardDescription>Datos del tenant (demo)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/organization">Ver detalles</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Wallet
            </CardTitle>
            <CardDescription>Cuentas y firma en cadena</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/accounts">Gestionar cuentas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
