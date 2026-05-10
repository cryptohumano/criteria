/**
 * Modal para mostrar la ruta completa de una bitácora
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RouteMap } from '@/components/mountainLogs/RouteMap'
import type { MountainLog } from '@/types/mountainLogs'
import { Button } from '@/components/ui/button'
import { ArrowRight, MapPin, Mountain } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDuration } from '@/utils/mountainLogStatistics'

interface LogRouteModalProps {
  log: MountainLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LogRouteModal({ log, open, onOpenChange }: LogRouteModalProps) {
  const navigate = useNavigate()

  if (!log) return null

  const handleViewDetails = () => {
    onOpenChange(false)
    navigate(`/mountain-logs/${log.logId}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl w-[95vw] max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-6rem)]"
        style={{
          // Respetar espacio de FABs (aproximadamente 5rem en móvil, 6rem en desktop)
          bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem)) + 5rem',
          marginBottom: 'max(5rem, calc(env(safe-area-inset-bottom, 1rem) + 5rem))',
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mountain className="h-5 w-5 text-primary" />
            {log.title}
          </DialogTitle>
          <DialogDescription>
            {log.mountainName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {log.mountainName}
                {log.location && ` - ${log.location}`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
          {/* Mapa de la ruta */}
          <RouteMap log={log} />
          
          {/* Información adicional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {log.statistics?.totalDistance && (
              <div>
                <span className="text-muted-foreground">Distancia total: </span>
                <span className="font-medium">
                  {log.statistics.totalDistance >= 1000
                    ? `${(log.statistics.totalDistance / 1000).toFixed(2)} km`
                    : `${Math.round(log.statistics.totalDistance)} m`}
                </span>
              </div>
            )}
            {log.statistics?.totalElevationGain && (
              <div>
                <span className="text-muted-foreground">Elevación ganada: </span>
                <span className="font-medium">
                  {Math.round(log.statistics.totalElevationGain)} m
                </span>
              </div>
            )}
            {log.statistics?.maxElevation && (
              <div>
                <span className="text-muted-foreground">Elevación máxima: </span>
                <span className="font-medium">
                  {Math.round(log.statistics.maxElevation)} m
                </span>
              </div>
            )}
            {log.statistics?.totalDuration && (
              <div>
                <span className="text-muted-foreground">Duración: </span>
                <span className="font-medium">
                  {formatDuration(log.statistics.totalDuration)}
                </span>
              </div>
            )}
          </div>

          {/* Botón para ver detalles completos */}
          <div className="pt-2">
            <Button onClick={handleViewDetails} className="w-full sm:w-auto">
              Ver detalles completos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
