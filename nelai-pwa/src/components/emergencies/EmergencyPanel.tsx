/**
 * Componente: Panel de Emergencia
 * Muestra el estado de emergencias activas en una bitácora
 */

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, MapPin, Clock, CheckCircle, XCircle, X, ExternalLink } from 'lucide-react'
import { useEmergency } from '@/hooks/useEmergency'
import type { Emergency } from '@/types/emergencies'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale/es'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface EmergencyPanelProps {
  logId: string
  log?: {
    milestones?: Array<{ id: string }>
  }
  onEmergencyUpdate?: () => void
}

export function EmergencyPanel({ logId, log, onEmergencyUpdate }: EmergencyPanelProps) {
  const { emergencies, getEmergenciesByLogId, getActiveEmergency } = useEmergency()
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [logEmergencies, setLogEmergencies] = useState<Emergency[]>([])
  const [activeEmergency, setActiveEmergency] = useState<Emergency | null>(null)
  const [loading, setLoading] = useState(true)

  // REGLA: Verificar que haya milestones antes de mostrar el panel
  const hasMilestones = log && log.milestones && log.milestones.length > 0

  // Cargar emergencias de esta bitácora
  useEffect(() => {
    const loadEmergencies = async () => {
      try {
        setLoading(true)
        const emergencies = await getEmergenciesByLogId(logId)
        const active = await getActiveEmergency(logId)
        setLogEmergencies(emergencies)
        setActiveEmergency(active)
        onEmergencyUpdate?.()
      } catch (error) {
        console.error('[EmergencyPanel] Error al cargar emergencias:', error)
      } finally {
        setLoading(false)
      }
    }
    loadEmergencies()
  }, [logId, getEmergenciesByLogId, getActiveEmergency, onEmergencyUpdate])

  // Si está cargando, no mostrar nada
  if (loading) {
    return null
  }

  // REGLA: No mostrar el panel de emergencias si no hay milestones
  if (!hasMilestones) {
    return null
  }

  // Si no hay emergencias activas ni historial, no mostrar nada
  if (!activeEmergency && logEmergencies.length === 0) {
    return null
  }

  const getStatusBadge = (status: Emergency['status']) => {
    const variants: Record<Emergency['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending: { variant: 'secondary', label: 'Pendiente' },
      submitted: { variant: 'default', label: 'Enviada' },
      acknowledged: { variant: 'default', label: 'Reconocida' },
      in_progress: { variant: 'default', label: 'En Proceso' },
      resolved: { variant: 'outline', label: 'Resuelta' },
      cancelled: { variant: 'outline', label: 'Cancelada' },
    }
    const config = variants[status] || variants.pending
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getTypeLabel = (type: Emergency['type']) => {
    const labels: Record<Emergency['type'], string> = {
      medical: 'Médica',
      rescue: 'Rescate',
      weather: 'Condiciones Climáticas',
      equipment: 'Fallo de Equipo',
      lost: 'Extraviado',
      injury: 'Lesión',
      illness: 'Enfermedad',
      avalanche: 'Avalancha',
      rockfall: 'Caída de Rocas',
      other: 'Otra',
    }
    return labels[type] || type
  }

  const getSeverityColor = (severity: Emergency['severity']) => {
    const colors: Record<Emergency['severity'], string> = {
      low: 'text-blue-600 dark:text-blue-400',
      medium: 'text-yellow-600 dark:text-yellow-400',
      high: 'text-orange-600 dark:text-orange-400',
      critical: 'text-red-600 dark:text-red-400',
    }
    return colors[severity] || colors.medium
  }

  return (
    <>
      {/* Panel de emergencia activa */}
      {activeEmergency && (
        <Card className="border-destructive/50 bg-destructive/5 mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-destructive text-lg">
                <AlertTriangle className="h-5 w-5" />
                Emergencia Activa
              </CardTitle>
              {getStatusBadge(activeEmergency.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <p className="font-medium">{getTypeLabel(activeEmergency.type)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Severidad:</span>
                <p className={`font-medium ${getSeverityColor(activeEmergency.severity)}`}>
                  {activeEmergency.severity === 'low' ? 'Baja' :
                   activeEmergency.severity === 'medium' ? 'Media' :
                   activeEmergency.severity === 'high' ? 'Alta' : 'Crítica'}
                </p>
              </div>
            </div>

            {activeEmergency.description && (
              <div>
                <span className="text-muted-foreground text-sm">Descripción:</span>
                <p className="text-sm mt-1">{activeEmergency.description}</p>
              </div>
            )}

            {activeEmergency.location && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>
                  {activeEmergency.location.latitude.toFixed(6)}, {activeEmergency.location.longitude.toFixed(6)}
                  {activeEmergency.location.altitude && ` • ${Math.round(activeEmergency.location.altitude)}m`}
                </span>
              </div>
            )}

            {activeEmergency.createdAt && !isNaN(activeEmergency.createdAt) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  Creada {formatDistanceToNow(new Date(activeEmergency.createdAt), { addSuffix: true, locale: es })}
                </span>
              </div>
            )}

            {activeEmergency.blockchainTxHash && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Transacción:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {activeEmergency.blockchainTxHash.substring(0, 16)}...
                </code>
                {activeEmergency.blockchainBlockNumber && (
                  <span className="text-muted-foreground">
                    (Bloque {activeEmergency.blockchainBlockNumber})
                  </span>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedEmergency(activeEmergency)
                  setShowDetails(true)
                }}
                className="flex-1"
              >
                Ver Detalles
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historial de emergencias (si hay más de una) */}
      {logEmergencies.length > 1 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">Historial de Emergencias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logEmergencies
                .filter(e => e.emergencyId !== activeEmergency?.emergencyId)
                .map((emergency) => (
                  <div
                    key={emergency.emergencyId}
                    className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setSelectedEmergency(emergency)
                      setShowDetails(true)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{getTypeLabel(emergency.type)}</span>
                        {getStatusBadge(emergency.status)}
                      </div>
                      {emergency.createdAt && !isNaN(emergency.createdAt) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(emergency.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diálogo de detalles */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Detalles de Emergencia
            </DialogTitle>
            <DialogDescription>
              Información completa de la emergencia
            </DialogDescription>
          </DialogHeader>

          {selectedEmergency && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <p className="font-medium">{getTypeLabel(selectedEmergency.type)}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Severidad</span>
                  <p className={`font-medium ${getSeverityColor(selectedEmergency.severity)}`}>
                    {selectedEmergency.severity === 'low' ? 'Baja' :
                     selectedEmergency.severity === 'medium' ? 'Media' :
                     selectedEmergency.severity === 'high' ? 'Alta' : 'Crítica'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <div className="mt-1">{getStatusBadge(selectedEmergency.status)}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Creada</span>
                  <p className="text-sm">
                    {new Date(selectedEmergency.createdAt).toLocaleString('es-ES')}
                  </p>
                </div>
              </div>

              {selectedEmergency.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Descripción</span>
                  <p className="mt-1 p-3 bg-muted rounded-lg">{selectedEmergency.description}</p>
                </div>
              )}

              {selectedEmergency.location && (
                <div>
                  <span className="text-sm text-muted-foreground">Ubicación</span>
                  <div className="mt-1 p-3 bg-muted rounded-lg space-y-1">
                    <p className="font-mono text-sm">
                      {selectedEmergency.location.latitude.toFixed(6)}, {selectedEmergency.location.longitude.toFixed(6)}
                    </p>
                    {selectedEmergency.location.altitude && (
                      <p className="text-sm">Altitud: {Math.round(selectedEmergency.location.altitude)} m</p>
                    )}
                    {selectedEmergency.location.accuracy && (
                      <p className="text-sm text-muted-foreground">
                        Precisión: ±{Math.round(selectedEmergency.location.accuracy)} m
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedEmergency.blockchainTxHash && (
                <div>
                  <span className="text-sm text-muted-foreground">Información Blockchain</span>
                  <div className="mt-1 p-3 bg-muted rounded-lg space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Hash:</span>{' '}
                      <code className="text-xs">{selectedEmergency.blockchainTxHash}</code>
                    </p>
                    {selectedEmergency.blockchainBlockNumber && (
                      <p className="text-sm">
                        <span className="font-medium">Bloque:</span> {selectedEmergency.blockchainBlockNumber}
                      </p>
                    )}
                    {selectedEmergency.submittedAt && !isNaN(selectedEmergency.submittedAt) && (
                      <p className="text-sm text-muted-foreground">
                        Enviada: {new Date(selectedEmergency.submittedAt).toLocaleString('es-ES')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedEmergency.emergencyContacts && selectedEmergency.emergencyContacts.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Contactos de Emergencia</span>
                  <div className="mt-1 space-y-2">
                    {selectedEmergency.emergencyContacts.map((contact, index) => (
                      <div key={index} className="p-2 bg-muted rounded-lg">
                        <p className="font-medium text-sm">{contact.nombres}</p>
                        <p className="text-xs text-muted-foreground">
                          {contact.telefonos.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedEmergency.notes && (
                <div>
                  <span className="text-sm text-muted-foreground">Notas Adicionales</span>
                  <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{selectedEmergency.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
