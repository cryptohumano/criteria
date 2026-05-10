import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  getAllMountainLogs, 
  getMountainLogsByStatus,
  getMountainLogsByAccount,
  deleteMountainLog
} from '@/utils/mountainLogStorage'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import type { MountainLog, MountainLogStatus } from '@/types/mountainLogs'
import { Mountain, Plus, Filter, Search, Trash2, MapPin, Calendar, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function MountainLogs() {
  const navigate = useNavigate()
  const { accounts } = useKeyringContext()
  const { activeAccount } = useActiveAccount()
  const [logs, setLogs] = useState<MountainLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<MountainLogStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<'all' | 'active' | 'historical'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAccount, setFilterAccount] = useState<string>('all')

  // Actualizar filtro de cuenta cuando cambia la cuenta activa
  useEffect(() => {
    if (activeAccount) {
      // Si hay cuenta activa, actualizar el filtro automáticamente
      setFilterAccount(activeAccount)
    }
  }, [activeAccount])

  const loadLogs = async () => {
    try {
      setLoading(true)
      let loadedLogs: MountainLog[]
      
      // Prioridad: usar activeAccount si está disponible (más reciente), sino usar filterAccount
      // Esto asegura que cuando cambia activeAccount, se use inmediatamente
      const accountToFilter = activeAccount || (filterAccount !== 'all' ? filterAccount : null)
      
      if (accountToFilter) {
        loadedLogs = await getMountainLogsByAccount(accountToFilter)
      } else {
        loadedLogs = await getAllMountainLogs()
      }
      
      // Aplicar filtros de tipo y estado
      // Nota: Los filtros de tipo y estado se aplican aquí para optimizar la carga
      // El filtro de búsqueda de texto se aplica después en filteredLogs
      if (filterType !== 'all') {
        if (filterType === 'historical') {
          loadedLogs = loadedLogs.filter(log => log.isHistorical === true)
        } else if (filterType === 'active') {
          loadedLogs = loadedLogs.filter(log => !log.isHistorical)
        }
      }
      
      if (filterStatus !== 'all') {
        loadedLogs = loadedLogs.filter(log => log.status === filterStatus)
      }
      
      setLogs(loadedLogs)
    } catch (error) {
      console.error('Error al cargar bitácoras:', error)
      toast.error('Error al cargar las bitácoras')
    } finally {
      setLoading(false)
    }
  }

  // Recargar bitácoras cuando cambia el estado, tipo, el filtro de cuenta o la cuenta activa
  useEffect(() => {
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterType, filterAccount, activeAccount])

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      log.title?.toLowerCase().includes(query) ||
      log.description?.toLowerCase().includes(query) ||
      log.mountainName?.toLowerCase().includes(query) ||
      log.location?.toLowerCase().includes(query) ||
      log.logId.toLowerCase().includes(query)
    )
  })

  const getStatusBadgeVariant = (status: MountainLogStatus) => {
    switch (status) {
      case 'completed':
        return 'default'
      case 'in_progress':
        return 'secondary'
      case 'draft':
        return 'outline'
      case 'cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: MountainLogStatus) => {
    switch (status) {
      case 'completed':
        return 'Completada'
      case 'in_progress':
        return 'En Progreso'
      case 'draft':
        return 'Borrador'
      case 'cancelled':
        return 'Cancelada'
      default:
        return status
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDistance = (meters?: number) => {
    if (!meters) return 'N/A'
    if (meters < 1000) return `${Math.round(meters)} m`
    return `${(meters / 1000).toFixed(2)} km`
  }

  const handleViewDetails = (logId: string) => {
    navigate(`/mountain-logs/${logId}`)
  }

  const handleCreateNew = () => {
    navigate('/mountain-logs/new')
  }

  const handleDeleteLog = async (logId: string, title?: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la bitácora "${title || logId}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      await deleteMountainLog(logId)
      toast.success('Bitácora eliminada exitosamente')
      await loadLogs()
    } catch (error) {
      console.error('Error al eliminar bitácora:', error)
      toast.error('Error al eliminar la bitácora')
    }
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Bitácoras de Montañismo</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Registra y gestiona tus expediciones de montañismo
          </p>
        </div>
        <Button 
          onClick={handleCreateNew}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nueva Bitácora</span>
          <span className="sm:hidden">Nueva</span>
        </Button>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar bitácoras..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-sm sm:text-base"
                />
              </div>
            </div>
            
            {/* Selector de cuenta (solo si hay más de una cuenta) */}
            {accounts.length > 1 && (
              <div className="w-full sm:w-64">
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las cuentas</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.address} value={account.address}>
                        {account.meta.name || `${account.address.slice(0, 8)}...`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Filtro por tipo de bitácora (Activas/Históricas) */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-muted-foreground self-center mr-2">Tipo:</span>
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
                className="text-xs sm:text-sm"
              >
                Todas
              </Button>
              <Button
                variant={filterType === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('active')}
                className="text-xs sm:text-sm"
              >
                Activas
              </Button>
              <Button
                variant={filterType === 'historical' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('historical')}
                className="text-xs sm:text-sm"
              >
                Históricas
              </Button>
            </div>
            
            {/* Filtro por estado */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs sm:text-sm text-muted-foreground self-center mr-2">Estado:</span>
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
                className="text-xs sm:text-sm"
              >
                Todos
              </Button>
              <Button
                variant={filterStatus === 'draft' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('draft')}
                className="text-xs sm:text-sm"
              >
                Borradores
              </Button>
              <Button
                variant={filterStatus === 'in_progress' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('in_progress')}
                className="text-xs sm:text-sm"
              >
                En Progreso
              </Button>
              <Button
                variant={filterStatus === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('completed')}
                className="text-xs sm:text-sm"
              >
                Completadas
              </Button>
              <Button
                variant={filterStatus === 'cancelled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('cancelled')}
                className="text-xs sm:text-sm"
              >
                Canceladas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de bitácoras */}
      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              Cargando bitácoras...
            </div>
          </CardContent>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Mountain className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No hay bitácoras</h3>
                <p className="text-muted-foreground mt-1">
                  {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                    ? 'No se encontraron bitácoras con los filtros aplicados'
                    : 'Comienza creando tu primera bitácora de montañismo'}
                </p>
              </div>
              {!searchQuery && filterStatus === 'all' && filterType === 'all' && (
                <Button onClick={handleCreateNew} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Primera Bitácora
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLogs.map((log) => (
            <Card key={log.logId} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg line-clamp-2">
                      {log.title || 'Bitácora sin título'}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs sm:text-sm">
                      {formatDate(log.createdAt)}
                    </CardDescription>
                  </div>
                  <Mountain className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getStatusBadgeVariant(log.status)}>
                    {getStatusLabel(log.status)}
                  </Badge>
                  {log.isHistorical && (
                    <Badge variant="outline">Histórica</Badge>
                  )}
                  {log.isTrackingActive && (
                    <Badge variant="secondary">Tracking Activo</Badge>
                  )}
                </div>

                {log.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {log.description}
                  </p>
                )}

                <div className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                  {log.mountainName && (
                    <div className="flex items-center gap-2">
                      <Mountain className="h-3.5 w-3.5" />
                      <span className="truncate">{log.mountainName}</span>
                    </div>
                  )}
                  {log.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{log.location}</span>
                    </div>
                  )}
                  {log.statistics?.totalDistance && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatDistance(log.statistics.totalDistance)}</span>
                    </div>
                  )}
                  {log.milestones && log.milestones.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span>{log.milestones.length} milestone{log.milestones.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs sm:text-sm"
                    onClick={() => handleViewDetails(log.logId)}
                  >
                    Ver Detalles
                  </Button>
                  {log.status !== 'completed' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-xs sm:text-sm text-destructive hover:text-destructive"
                      onClick={() => handleDeleteLog(log.logId, log.title)}
                    >
                      <Trash2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
