/**
 * Página: Lista Completa de Emergencias
 * Muestra todas las emergencias con filtros
 */

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEmergency } from '@/hooks/useEmergency'
import { Link } from 'react-router-dom'
import type { Emergency } from '@/types/emergencies'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale/es'
import { AlertTriangle, MapPin, Clock, ArrowRight, Loader2 } from 'lucide-react'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'

export default function Emergencies() {
  const { emergencies } = useEmergency()
  const { activeAccount } = useActiveAccount()
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Simular loading inicial mientras se cargan las emergencias
  useEffect(() => {
    if (emergencies.length >= 0) {
      setIsLoading(false)
    }
  }, [emergencies])

  // Filtrar emergencias por cuenta activa si existe
  const filteredEmergencies = useMemo(() => {
    let filtered = activeAccount 
      ? emergencies.filter(e => e.accountAddress === activeAccount)
      : emergencies

    if (filter === 'active') {
      filtered = filtered.filter(
        (e) =>
          e.status === 'pending' ||
          e.status === 'submitted' ||
          e.status === 'acknowledged' ||
          e.status === 'in_progress'
      )
    } else if (filter === 'resolved') {
      filtered = filtered.filter(
        (e) => e.status === 'resolved' || e.status === 'cancelled'
      )
    }
    return filtered
  }, [emergencies, filter, activeAccount])

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
      case 'resolved':
        return 'Resuelta'
      case 'cancelled':
        return 'Cancelada'
      default:
        return status
    }
  }

  const getTypeLabel = (type: Emergency['type']) => {
    switch (type) {
      case 'medical':
        return 'Médica'
      case 'rescue':
        return 'Rescate'
      case 'weather':
        return 'Clima'
      case 'equipment':
        return 'Equipo'
      case 'lost':
        return 'Extraviado'
      case 'injury':
        return 'Lesión'
      case 'illness':
        return 'Enfermedad'
      case 'avalanche':
        return 'Avalancha'
      case 'rockfall':
        return 'Caída de rocas'
      case 'other':
        return 'Otra'
      default:
        return type
    }
  }

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

  const activeCount = emergencies.filter(
    (e) =>
      e.status === 'pending' ||
      e.status === 'submitted' ||
      e.status === 'acknowledged' ||
      e.status === 'in_progress'
  ).length

  const resolvedCount = emergencies.filter(
    (e) => e.status === 'resolved' || e.status === 'cancelled'
  ).length

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Emergencias</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona y revisa todas tus emergencias
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Cargando emergencias...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-destructive" />
          Emergencias
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestiona y revisa todas tus emergencias
        </p>
      </div>

      {/* Filtros */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Todas ({emergencies.length})</TabsTrigger>
          <TabsTrigger value="active">Activas ({activeCount})</TabsTrigger>
          <TabsTrigger value="resolved">Resueltas ({resolvedCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lista */}
      <div className="space-y-3">
        {filteredEmergencies.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  No hay emergencias en esta categoría
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredEmergencies.map((emergency) => (
            <EmergencyCard 
              key={emergency.emergencyId} 
              emergency={emergency}
              getSeverityBadgeVariant={getSeverityBadgeVariant}
              getStatusBadgeVariant={getStatusBadgeVariant}
              getSeverityLabel={getSeverityLabel}
              getStatusLabel={getStatusLabel}
              getTypeLabel={getTypeLabel}
              formatTime={formatTime}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface EmergencyCardProps {
  emergency: Emergency
  getSeverityBadgeVariant: (severity: Emergency['severity']) => "destructive" | "default" | "secondary" | "outline"
  getStatusBadgeVariant: (status: Emergency['status']) => "destructive" | "default" | "secondary" | "outline"
  getSeverityLabel: (severity: Emergency['severity']) => string
  getStatusLabel: (status: Emergency['status']) => string
  getTypeLabel: (type: Emergency['type']) => string
  formatTime: (timestamp: number) => string
}

function EmergencyCard({ 
  emergency, 
  getSeverityBadgeVariant,
  getStatusBadgeVariant,
  getSeverityLabel,
  getStatusLabel,
  getTypeLabel,
  formatTime
}: EmergencyCardProps) {
  const isCritical = emergency.severity === 'critical'
  const isHigh = emergency.severity === 'high'
  
  return (
    <Link 
      to={`/transactions?tx=${emergency.blockchainTxHash || emergency.emergencyId}`}
      className="block"
    >
      <Card className={`
        ${isCritical ? 'border-destructive bg-destructive/5' : ''}
        ${isHigh ? 'border-destructive/50' : ''}
        hover:shadow-md transition-all
      `}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={getSeverityBadgeVariant(emergency.severity)}
                  className="text-xs"
                >
                  {getSeverityLabel(emergency.severity)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {getTypeLabel(emergency.type)}
                </Badge>
                <Badge variant={getStatusBadgeVariant(emergency.status)} className="text-xs">
                  {getStatusLabel(emergency.status)}
                </Badge>
              </div>
              {emergency.description && (
                <p className="text-sm font-medium line-clamp-2">{emergency.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
              {emergency.relatedLogId && (
                <p className="pt-2 text-xs text-muted-foreground">
                  Ref. expedición: <span className="font-mono">{emergency.relatedLogId}</span>
                </p>
              )}
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
