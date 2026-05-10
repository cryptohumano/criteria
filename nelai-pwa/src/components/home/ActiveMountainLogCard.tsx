/**
 * Componente: Card de Bitácora Activa
 * Muestra información de la bitácora activa con estadísticas y acciones rápidas
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mountain, MapPin, Clock, Navigation, ArrowRight, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MountainLog } from '@/types/mountainLogs'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale/es'

interface ActiveMountainLogCardProps {
  log: MountainLog
}

export function ActiveMountainLogCard({ log }: ActiveMountainLogCardProps) {
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`
    return `${(meters / 1000).toFixed(2)}km`
  }

  const formatDuration = (startDate: number) => {
    try {
      return formatDistanceToNow(new Date(startDate), { 
        addSuffix: false,
        locale: es 
      })
    } catch {
      return 'Tiempo desconocido'
    }
  }

  const getStatusBadgeVariant = (status: MountainLog['status']) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'completed':
        return 'secondary'
      case 'draft':
        return 'outline'
      default:
        return 'outline'
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Mountain className="h-5 w-5 text-primary" />
              Bitácora Activa
            </CardTitle>
          </div>
          <Badge variant={getStatusBadgeVariant(log.status)}>
            {log.status === 'active' ? 'En Curso' : log.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Información principal */}
        <div>
          <h3 className="font-semibold text-base sm:text-lg mb-2">{log.title}</h3>
          {log.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {log.description}
            </p>
          )}
        </div>

        {/* Información de ubicación y montaña */}
        <div className="space-y-2 text-sm">
          {log.mountainName && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mountain className="h-4 w-4" />
              <span className="truncate">{log.mountainName}</span>
            </div>
          )}
          {log.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{log.location}</span>
            </div>
          )}
        </div>

        {/* Estadísticas */}
        {(log.statistics || log.isTrackingActive) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t">
            {log.isTrackingActive && (
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">Tracking</div>
                  <div className="text-sm font-medium">Activo</div>
                </div>
              </div>
            )}
            {log.statistics?.totalDistance && (
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Distancia</div>
                  <div className="text-sm font-medium">
                    {formatDistance(log.statistics.totalDistance)}
                  </div>
                </div>
              </div>
            )}
            {log.startDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Tiempo</div>
                  <div className="text-sm font-medium">
                    {formatDuration(log.startDate)}
                  </div>
                </div>
              </div>
            )}
            {log.milestones && log.milestones.length > 0 && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Milestones</div>
                  <div className="text-sm font-medium">{log.milestones.length}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button asChild className="flex-1" variant="default">
            <Link to={`/mountain-logs/${log.logId}`}>
              Ver Detalles
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          {log.milestones && log.milestones.length > 0 && (
            <Button asChild className="flex-1" variant="destructive">
              <Link to={`/mountain-logs/${log.logId}#emergency`}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Emergencia
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
