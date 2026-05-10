/**
 * Modal: Estadísticas Detalladas
 * Muestra estadísticas completas y detalladas de bitácoras y emergencias
 */

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Mountain,
  AlertTriangle,
  MapPin,
  Camera,
  TrendingUp,
  Clock,
  BarChart3,
  CheckCircle,
  PlayCircle,
  FileText,
  XCircle,
} from 'lucide-react'
import { formatDuration } from '@/utils/mountainLogStatistics'
import type { MountainLog } from '@/types/mountainLogs'
import type { Emergency } from '@/types/emergencies'

interface StatisticsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  logs: MountainLog[]
  emergencies: Emergency[]
}

export function StatisticsModal({ open, onOpenChange, logs, emergencies }: StatisticsModalProps) {
  const stats = useMemo(() => {
    const totalLogs = logs.length
    const completedLogs = logs.filter(log => log.status === 'completed').length
    const inProgressLogs = logs.filter(log => log.status === 'in_progress').length
    const draftLogs = logs.filter(log => log.status === 'draft').length
    const cancelledLogs = logs.filter(log => log.status === 'cancelled').length
    
    // Calcular distancia total
    const totalDistance = logs.reduce((sum, log) => {
      return sum + (log.statistics?.totalDistance || 0)
    }, 0)
    
    // Calcular elevación total
    const totalElevationGain = logs.reduce((sum, log) => {
      return sum + (log.statistics?.totalElevationGain || 0)
    }, 0)
    
    const totalElevationLoss = logs.reduce((sum, log) => {
      return sum + (log.statistics?.totalElevationLoss || 0)
    }, 0)
    
    const maxElevation = Math.max(
      ...logs.map(log => log.statistics?.maxElevation || 0),
      0
    )
    
    const minElevation = Math.min(
      ...logs.filter(log => log.statistics?.minElevation !== undefined).map(log => log.statistics!.minElevation!),
      Infinity
    )
    
    // Calcular duración total
    const totalDuration = logs.reduce((sum, log) => {
      return sum + (log.statistics?.totalDuration || 0)
    }, 0)
    
    // Calcular velocidades
    const maxSpeed = Math.max(
      ...logs.map(log => log.statistics?.maxSpeed || 0),
      0
    )
    
    const avgSpeeds = logs
      .map(log => log.statistics?.averageSpeed)
      .filter((speed): speed is number => speed !== undefined && speed > 0)
    
    const averageSpeed = avgSpeeds.length > 0
      ? avgSpeeds.reduce((sum, speed) => sum + speed, 0) / avgSpeeds.length
      : 0
    
    // Calcular total de fotos
    const totalPhotos = logs.reduce((sum, log) => {
      return sum + (log.statistics?.numberOfPhotos || 0)
    }, 0)
    
    // Calcular total de waypoints
    const totalWaypoints = logs.reduce((sum, log) => {
      return sum + (log.statistics?.numberOfWaypoints || 0)
    }, 0)
    
    // Emergencias
    const totalEmergencies = emergencies.length
    const activeEmergencies = emergencies.filter(
      e => e.status !== 'resolved' && e.status !== 'cancelled'
    ).length
    const resolvedEmergencies = emergencies.filter(e => e.status === 'resolved').length
    const criticalEmergencies = emergencies.filter(e => e.severity === 'critical').length
    
    // Estadísticas por tipo de emergencia
    const emergenciesByType = emergencies.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      totalLogs,
      completedLogs,
      inProgressLogs,
      draftLogs,
      cancelledLogs,
      totalDistance,
      totalElevationGain,
      totalElevationLoss,
      maxElevation,
      minElevation: minElevation === Infinity ? 0 : minElevation,
      totalDuration,
      maxSpeed,
      averageSpeed,
      totalPhotos,
      totalWaypoints,
      totalEmergencies,
      activeEmergencies,
      resolvedEmergencies,
      criticalEmergencies,
      emergenciesByType,
    }
  }, [logs, emergencies])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Estadísticas Generales</DialogTitle>
          <DialogDescription>
            Resumen completo de todas tus bitácoras y emergencias
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Bitácoras - Resumen */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mountain className="h-5 w-5 text-primary" />
                Bitácoras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="font-semibold">{stats.totalLogs}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-500/10 rounded">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">Completadas</span>
                  </div>
                  <span className="font-semibold text-green-600">{stats.completedLogs}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded">
                  <div className="flex items-center gap-1.5">
                    <PlayCircle className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-muted-foreground">En Progreso</span>
                  </div>
                  <span className="font-semibold text-blue-600">{stats.inProgressLogs}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-orange-500/10 rounded">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-muted-foreground">Borradores</span>
                  </div>
                  <span className="font-semibold text-orange-600">{stats.draftLogs}</span>
                </div>
                {stats.cancelledLogs > 0 && (
                  <div className="flex items-center justify-between p-2 bg-gray-500/10 rounded">
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-muted-foreground">Canceladas</span>
                    </div>
                    <span className="font-semibold text-gray-600">{stats.cancelledLogs}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas de Actividad */}
          {stats.totalDistance > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Actividad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {stats.totalDistance > 0 && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Distancia Total</span>
                      </div>
                      <span className="font-semibold">
                        {stats.totalDistance >= 1000
                          ? `${(stats.totalDistance / 1000).toFixed(2)} km`
                          : `${Math.round(stats.totalDistance)} m`}
                      </span>
                    </div>
                  )}
                  
                  {stats.totalDuration > 0 && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Duración Total</span>
                      </div>
                      <span className="font-semibold text-xs">
                        {formatDuration(stats.totalDuration)}
                      </span>
                    </div>
                  )}
                  
                  {stats.totalElevationGain > 0 && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Elevación Ganada</span>
                      </div>
                      <span className="font-semibold">{Math.round(stats.totalElevationGain)} m</span>
                    </div>
                  )}
                  
                  {stats.maxElevation > 0 && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="text-sm text-muted-foreground">Elevación Máxima</span>
                      <span className="font-semibold">{Math.round(stats.maxElevation)} m</span>
                    </div>
                  )}
                  
                  {stats.maxSpeed > 0 && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="text-sm text-muted-foreground">Velocidad Máxima</span>
                      <span className="font-semibold">{(stats.maxSpeed * 3.6).toFixed(1)} km/h</span>
                    </div>
                  )}
                  
                  {stats.averageSpeed > 0 && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="text-sm text-muted-foreground">Velocidad Promedio</span>
                      <span className="font-semibold">{(stats.averageSpeed * 3.6).toFixed(1)} km/h</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contenido */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Contenido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {stats.totalPhotos > 0 && (
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-1.5">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Fotos</span>
                    </div>
                    <span className="font-semibold">{stats.totalPhotos}</span>
                  </div>
                )}
                
                {stats.totalWaypoints > 0 && (
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Waypoints</span>
                    </div>
                    <span className="font-semibold">{stats.totalWaypoints}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Emergencias */}
          {stats.totalEmergencies > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Emergencias
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-semibold">{stats.totalEmergencies}</span>
                  </div>
                  
                  {stats.activeEmergencies > 0 && (
                    <div className="flex items-center justify-between p-2 bg-destructive/10 rounded">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-muted-foreground">Activas</span>
                      </div>
                      <span className="font-semibold text-destructive">{stats.activeEmergencies}</span>
                    </div>
                  )}
                  
                  {stats.resolvedEmergencies > 0 && (
                    <div className="flex items-center justify-between p-2 bg-green-500/10 rounded">
                      <span className="text-sm text-muted-foreground">Resueltas</span>
                      <span className="font-semibold text-green-600">{stats.resolvedEmergencies}</span>
                    </div>
                  )}
                  
                  {stats.criticalEmergencies > 0 && (
                    <div className="flex items-center justify-between p-2 bg-red-500/10 rounded">
                      <span className="text-sm text-muted-foreground">Críticas</span>
                      <span className="font-semibold text-red-600">{stats.criticalEmergencies}</span>
                    </div>
                  )}
                </div>
                
                {Object.keys(stats.emergenciesByType).length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Por Tipo</p>
                    <div className="space-y-1">
                      {Object.entries(stats.emergenciesByType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground capitalize">{type}</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
