import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2 } from 'lucide-react'
import type { MountainLog } from '@/types/mountainLogs'

interface DummyDataSummaryProps {
  avisoSalida: NonNullable<MountainLog['avisoSalida']>
}

export function DummyDataSummary({ avisoSalida }: DummyDataSummaryProps) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          Datos Demo Cargados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-muted-foreground text-xs">Guía/Líder</p>
            <p className="font-semibold">{avisoSalida.guia.nombres} {avisoSalida.guia.apellidos}</p>
            <p className="text-xs text-muted-foreground">{avisoSalida.guia.profesion}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Destino</p>
            <p className="font-semibold">{avisoSalida.actividad.lugarDestino}</p>
            <p className="text-xs text-muted-foreground">{avisoSalida.actividad.regionDestino}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Actividad</p>
            <Badge variant="outline">{avisoSalida.actividad.tipoActividad === 'alta_montana' ? 'Alta Montaña' : avisoSalida.actividad.tipoActividad}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Fechas</p>
            <p className="font-semibold">
              {new Date(avisoSalida.actividad.fechaSalida).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              {avisoSalida.actividad.fechaRegreso && 
                ` - ${new Date(avisoSalida.actividad.fechaRegreso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
              }
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Badge variant="secondary">{avisoSalida.participantes.length} Participantes</Badge>
          <Badge variant="secondary">{avisoSalida.contactosEmergencia.length} Contactos Emergencia</Badge>
          {avisoSalida.participantesConEnfermedades.length > 0 && (
            <Badge variant="secondary">{avisoSalida.participantesConEnfermedades.length} con Enfermedades</Badge>
          )}
          <Badge variant="secondary">Lista de Chequeo Completa</Badge>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          💡 Los datos se han llenado en todas las secciones. Navega entre las pestañas para verlos.
        </p>
      </CardContent>
    </Card>
  )
}
