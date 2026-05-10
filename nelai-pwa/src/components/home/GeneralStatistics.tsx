/**
 * Componente: Estadísticas Generales
 * Muestra estadísticas agregadas de bitácoras y emergencias
 * Diseñado para mostrarse entre los FABs en la parte inferior
 */

import { useMemo, useState } from 'react'
import { Mountain, AlertTriangle, MapPin, Camera, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MountainLog } from '@/types/mountainLogs'
import type { Emergency } from '@/types/emergencies'
import { StatisticsModal } from './StatisticsModal'
import { useIsMobile } from '@/hooks/use-mobile'

interface GeneralStatisticsProps {
  logs: MountainLog[]
  emergencies: Emergency[]
  className?: string
}

export function GeneralStatistics({ logs, emergencies, className }: GeneralStatisticsProps) {
  const isMobile = useIsMobile()
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const stats = useMemo(() => {
    const totalLogs = logs.length
    const completedLogs = logs.filter(log => log.status === 'completed').length
    const inProgressLogs = logs.filter(log => log.status === 'in_progress').length
    const draftLogs = logs.filter(log => log.status === 'draft').length
    
    // Calcular distancia total
    const totalDistance = logs.reduce((sum, log) => {
      return sum + (log.statistics?.totalDistance || 0)
    }, 0)
    
    // Calcular total de fotos
    const totalPhotos = logs.reduce((sum, log) => {
      return sum + (log.statistics?.numberOfPhotos || 0)
    }, 0)
    
    // Calcular total de waypoints
    const totalWaypoints = logs.reduce((sum, log) => {
      return sum + (log.statistics?.numberOfWaypoints || 0)
    }, 0)
    
    // Emergencias activas (no resueltas ni canceladas)
    const activeEmergencies = emergencies.filter(
      e => e.status !== 'resolved' && e.status !== 'cancelled'
    ).length
    
    return {
      totalLogs,
      completedLogs,
      inProgressLogs,
      draftLogs,
      totalDistance,
      totalPhotos,
      totalWaypoints,
      activeEmergencies,
    }
  }, [logs, emergencies])

  return (
    <>
      <div
        className={cn(
          'fixed bottom-4 left-1/2 -translate-x-1/2 z-[90]',
          'bg-background/95 backdrop-blur-sm',
          'border rounded-lg shadow-lg',
          'px-3 py-2',
          'flex items-center gap-3',
          isMobile 
            ? 'max-w-[calc(100vw-12rem)]' // Dejar espacio para los FABs en móvil
            : 'max-w-md', // Ancho fijo en desktop
          isMobile && 'cursor-pointer active:scale-95 transition-transform', // Clickable en móvil
          className
        )}
        style={{
          bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        }}
        onClick={() => {
          if (isMobile) {
            setIsModalOpen(true)
          }
        }}
        role={isMobile ? 'button' : undefined}
        tabIndex={isMobile ? 0 : undefined}
        onKeyDown={(e) => {
          if (isMobile && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setIsModalOpen(true)
          }
        }}
        aria-label={isMobile ? 'Ver estadísticas detalladas' : undefined}
      >
      {/* Total de Bitácoras */}
      <div className="flex items-center gap-1.5 text-xs">
        <Mountain className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold">{stats.totalLogs}</span>
        <span className="text-muted-foreground">bitácoras</span>
      </div>

      {/* Separador */}
      <div className="h-4 w-px bg-border" />

      {/* Emergencias Activas */}
      {stats.activeEmergencies > 0 && (
        <>
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="font-semibold text-destructive">{stats.activeEmergencies}</span>
            <span className="text-muted-foreground">emergencias</span>
          </div>
          <div className="h-4 w-px bg-border" />
        </>
      )}

      {/* Distancia Total */}
      {stats.totalDistance > 0 && (
        <>
          <div className="flex items-center gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold">
              {stats.totalDistance >= 1000
                ? `${(stats.totalDistance / 1000).toFixed(1)} km`
                : `${Math.round(stats.totalDistance)} m`}
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
        </>
      )}

      {/* Total de Fotos */}
      {stats.totalPhotos > 0 && (
        <>
          <div className="flex items-center gap-1.5 text-xs">
            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-semibold">{stats.totalPhotos}</span>
          </div>
        </>
      )}
      </div>
      
      {/* Modal de estadísticas detalladas - Solo en móvil */}
      {isMobile && (
        <StatisticsModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          logs={logs}
          emergencies={emergencies}
        />
      )}
    </>
  )
}
