/**
 * Componente: Lista de Bitácoras Recientes
 * Muestra las últimas bitácoras del usuario
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mountain, MapPin, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MountainLog } from '@/types/mountainLogs'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale/es'

interface RecentMountainLogsListProps {
  logs: MountainLog[]
  isLoading?: boolean
}

export function RecentMountainLogsList({ logs, isLoading }: RecentMountainLogsListProps) {
  const formatTime = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { 
        addSuffix: true,
        locale: es 
      })
    } catch {
      return 'Fecha desconocida'
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

  const getStatusLabel = (status: MountainLog['status']) => {
    switch (status) {
      case 'active':
        return 'Activa'
      case 'completed':
        return 'Completada'
      case 'draft':
        return 'Borrador'
      default:
        return status
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Bitácoras Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Bitácoras Recientes</CardTitle>
          <CardDescription>No hay bitácoras aún</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/mountain-logs/new">
              <Mountain className="mr-2 h-4 w-4" />
              Crear Primera Bitácora
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Bitácoras Recientes</CardTitle>
        <CardDescription>
          {logs.length} bitácora{logs.length !== 1 ? 's' : ''} reciente{logs.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs.slice(0, 5).map((log) => (
          <Link
            key={log.logId}
            to={`/mountain-logs/${log.logId}`}
            className="block p-3 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base truncate">{log.title}</h3>
                {log.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                    {log.description}
                  </p>
                )}
              </div>
              <Badge variant={getStatusBadgeVariant(log.status)} className="text-xs flex-shrink-0">
                {getStatusLabel(log.status)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {log.mountainName && (
                <div className="flex items-center gap-1">
                  <Mountain className="h-3 w-3" />
                  <span className="truncate">{log.mountainName}</span>
                </div>
              )}
              {log.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{log.location}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(log.createdAt)}</span>
              </div>
            </div>
          </Link>
        ))}
        {logs.length > 5 && (
          <Button asChild variant="outline" className="w-full mt-4">
            <Link to="/mountain-logs">
              Ver todas las bitácoras
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
