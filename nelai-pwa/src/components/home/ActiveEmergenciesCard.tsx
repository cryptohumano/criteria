/**
 * Componente: Card de Emergencias Activas
 * Muestra emergencias activas con información crítica
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, MapPin, Clock, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Emergency } from '@/types/emergencies'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale/es'

interface ActiveEmergenciesCardProps {
  emergencies: Emergency[]
}

export function ActiveEmergenciesCard({ emergencies }: ActiveEmergenciesCardProps) {
  const formatTime = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { 
        addSuffix: true,
        locale: es 
      })
    } catch {
      return 'Tiempo desconocido'
    }
  }

  const getSeverityBadgeVariant = (severity: Emergency['severity']) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      case 'low':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getStatusBadgeVariant = (status: Emergency['status']) => {
    switch (status) {
      case 'acknowledged':
        return 'default'
      case 'in_progress':
        return 'default'
      case 'submitted':
        return 'secondary'
      case 'pending':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getSeverityLabel = (severity: Emergency['severity']) => {
    switch (severity) {
      case 'critical':
        return 'Crítica'
      case 'high':
        return 'Alta'
      case 'medium':
        return 'Media'
      case 'low':
        return 'Baja'
      default:
        return severity
    }
  }

  const getStatusLabel = (status: Emergency['status']) => {
    switch (status) {
      case 'acknowledged':
        return 'Reconocida'
      case 'in_progress':
        return 'En Proceso'
      case 'submitted':
        return 'Enviada'
      case 'pending':
        return 'Pendiente'
      default:
        return status
    }
  }

  if (emergencies.length === 0) {
    return null
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Emergencias Activas ({emergencies.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {emergencies.slice(0, 3).map((emergency) => (
          <div
            key={emergency.emergencyId}
            className="p-3 border rounded-lg bg-background space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">
                    {emergency.type === 'medical' ? 'Médica' :
                     emergency.type === 'rescue' ? 'Rescate' :
                     emergency.type === 'weather' ? 'Clima' :
                     emergency.type === 'equipment' ? 'Equipo' :
                     emergency.type === 'lost' ? 'Extraviado' :
                     emergency.type === 'injury' ? 'Lesión' :
                     emergency.type === 'illness' ? 'Enfermedad' :
                     emergency.type === 'avalanche' ? 'Avalancha' :
                     emergency.type === 'rockfall' ? 'Caída de rocas' :
                     'Emergencia'}
                  </span>
                  <Badge variant={getSeverityBadgeVariant(emergency.severity)} className="text-xs">
                    {getSeverityLabel(emergency.severity)}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(emergency.status)} className="text-xs">
                    {getStatusLabel(emergency.status)}
                  </Badge>
                </div>
                {emergency.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {emergency.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {emergency.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>GPS</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(emergency.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
            {emergency.relatedLogId && (
              <p className="text-xs text-muted-foreground">
                Ref. expedición:{' '}
                <span className="font-mono">{emergency.relatedLogId.slice(0, 10)}…</span>
              </p>
            )}
          </div>
        ))}
        {emergencies.length > 3 && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/emergencies">
              Ver todas las emergencias ({emergencies.length})
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
