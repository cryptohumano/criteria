/**
 * Componente: Mapa de Todas las Bitácoras
 * Muestra todas las bitácoras en un mapa interactivo con sus ubicaciones
 */

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { MapPin, Mountain, Loader2, AlertCircle, Navigation } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { MountainLog, GPSPoint } from '@/types/mountainLogs'
import type { GPSMetadata } from '@/types/documents'
import type { Emergency } from '@/types/emergencies'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getCurrentGPSLocation } from '@/services/pdf/PDFMetadata'
import { LogRouteModal } from './LogRouteModal'

// Fix para los iconos de Leaflet en React
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Iconos de colores para diferentes estados de bitácoras
const getLogIcon = (status: MountainLog['status']): L.Icon => {
  let color: string
  switch (status) {
    case 'completed':
      color = 'green' // Verde para completadas
      break
    case 'in_progress':
      color = 'blue' // Azul para en progreso
      break
    case 'draft':
      color = 'orange' // Naranja para borradores
      break
    case 'cancelled':
      color = 'grey' // Gris para canceladas
      break
    default:
      color = 'blue'
  }
  
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
}

// Icono rojo para emergencias
const EmergencyIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

interface MountainLogsMapProps {
  logs: MountainLog[]
  emergencies?: Emergency[] // Emergencias opcionales para mostrar en el mapa
  isLoading?: boolean
  showCurrentLocation?: boolean // Si mostrar ubicación actual cuando no hay bitácoras
  className?: string
}

/**
 * Obtiene el punto GPS principal de una bitácora (inicio, milestone, o ubicación general)
 */
function getLogLocation(log: MountainLog): { lat: number; lon: number } | null {
  // Prioridad 1: startLocation (GPSMetadata tiene latitude y longitude)
  if (log.startLocation?.latitude && log.startLocation?.longitude) {
    return {
      lat: log.startLocation.latitude,
      lon: log.startLocation.longitude
    }
  }

  // Prioridad 2: Primer milestone con gpsPoint
  if (log.milestones && log.milestones.length > 0) {
    const firstMilestoneWithGPS = log.milestones.find(m => 
      m.gpsPoint?.latitude && m.gpsPoint?.longitude
    )
    if (firstMilestoneWithGPS?.gpsPoint) {
      return {
        lat: firstMilestoneWithGPS.gpsPoint.latitude,
        lon: firstMilestoneWithGPS.gpsPoint.longitude
      }
    }
  }

  // Prioridad 3: Primer punto GPS
  if (log.gpsPoints && log.gpsPoints.length > 0) {
    return {
      lat: log.gpsPoints[0].latitude,
      lon: log.gpsPoints[0].longitude
    }
  }

  return null
}

export function MountainLogsMap({ logs, emergencies = [], isLoading, showCurrentLocation = true, className }: MountainLogsMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<L.Marker[]>([])
  const currentLocationMarkerRef = useRef<L.Marker | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const navigate = useNavigate()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [mapError, setMapError] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<GPSMetadata | null>(null)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [selectedLog, setSelectedLog] = useState<MountainLog | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Filtrar bitácoras con ubicación válida
  const logsWithLocation = logs.filter(log => getLogLocation(log) !== null)
  
  // Filtrar emergencias con ubicación válida
  const emergenciesWithLocation = emergencies.filter(emergency => 
    emergency.location?.latitude && emergency.location?.longitude
  )

  // Obtener ubicación actual si no hay bitácoras
  useEffect(() => {
    if (!showCurrentLocation || logsWithLocation.length > 0 || isLoading) {
      return
    }

    const fetchCurrentLocation = async () => {
      try {
        setIsLoadingLocation(true)
        const location = await getCurrentGPSLocation()
        setCurrentLocation(location)
      } catch (error) {
        console.warn('[MountainLogsMap] No se pudo obtener ubicación actual:', error)
        setCurrentLocation(null)
      } finally {
        setIsLoadingLocation(false)
      }
    }

    fetchCurrentLocation()
  }, [showCurrentLocation, logsWithLocation.length, isLoading])

  // Detectar estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Inicializar mapa
  useEffect(() => {
    if (isLoading || !isOnline || !mapContainerRef.current) {
      return
    }

    // Si no hay bitácoras, emergencias ni ubicación actual, no inicializar mapa
    if (logsWithLocation.length === 0 && emergenciesWithLocation.length === 0 && !currentLocation && !isLoadingLocation) {
      return
    }

    // Si el mapa ya existe, limpiarlo
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      markersRef.current = []
    }

    try {
      // Determinar centro del mapa
      let centerLat: number
      let centerLon: number
      let initialZoom: number

      // Combinar ubicaciones de bitácoras y emergencias
      const allLocations: { lat: number; lon: number }[] = []
      
      // Agregar ubicaciones de bitácoras
      logsWithLocation.forEach(log => {
        const location = getLogLocation(log)
        if (location) allLocations.push(location)
      })
      
      // Agregar ubicaciones de emergencias
      emergenciesWithLocation.forEach(emergency => {
        if (emergency.location?.latitude && emergency.location?.longitude) {
          allLocations.push({
            lat: emergency.location.latitude,
            lon: emergency.location.longitude
          })
        }
      })

      if (allLocations.length > 0) {
        // Si hay bitácoras o emergencias, usar promedio de sus ubicaciones
        centerLat = allLocations.reduce((sum, loc) => sum + loc.lat, 0) / allLocations.length
        centerLon = allLocations.reduce((sum, loc) => sum + loc.lon, 0) / allLocations.length
        initialZoom = 6 // Zoom amplio para ver todas las ubicaciones
      } else if (currentLocation) {
        // Si no hay bitácoras pero hay ubicación actual, usar esa
        centerLat = currentLocation.latitude
        centerLon = currentLocation.longitude
        initialZoom = 13 // Zoom más cercano para ubicación actual
      } else {
        return
      }

      // Crear el mapa (interactivo dentro, pero contenedor fijo)
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLon],
        zoom: initialZoom,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
      })

      // Agregar capa de tiles de OpenStreetMap
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      })

      tileLayer.on('tileerror', () => {
        setMapError('Error al cargar el mapa. Verifica tu conexión.')
      })

      tileLayer.addTo(map)
      mapRef.current = map
      
      // Esperar a que el mapa esté completamente inicializado antes de agregar marcadores
      map.whenReady(() => {
        // Agregar marcador de ubicación actual si no hay bitácoras
        if (logsWithLocation.length === 0 && currentLocation) {
          const currentIcon = L.divIcon({
            className: 'current-location-marker',
            html: `<div style="
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background-color: #0477BF;
              border: 3px solid white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })

          const marker = L.marker([currentLocation.latitude, currentLocation.longitude], {
            icon: currentIcon
          }).addTo(map)

          const popupContent = `
            <div class="text-sm min-w-[200px]">
              <h3 class="font-semibold mb-1">📍 Tu Ubicación Actual</h3>
              <p class="text-xs text-muted-foreground mb-1">
                ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}
              </p>
              ${currentLocation.altitude ? `<p class="text-xs text-muted-foreground mb-1">Altitud: ${Math.round(currentLocation.altitude)} m</p>` : ''}
              ${currentLocation.accuracy ? `<p class="text-xs text-muted-foreground mb-1">Precisión: ±${Math.round(currentLocation.accuracy)} m</p>` : ''}
            </div>
          `
          marker.bindPopup(popupContent)
          currentLocationMarkerRef.current = marker
        }

        // Agregar marcadores para cada bitácora con iconos según estado
        logsWithLocation.forEach((log) => {
          const location = getLogLocation(log)
          if (!location) return

          const marker = L.marker([location.lat, location.lon], {
            icon: getLogIcon(log.status),
            zIndexOffset: 100 // Bitácoras por debajo de emergencias
          }).addTo(map)

          // Crear popup con información de la bitácora
          const popupContent = document.createElement('div')
          popupContent.className = 'text-sm min-w-[200px]'
          
          // Determinar texto y emoji según estado
          let statusText = ''
          let statusEmoji = ''
          switch (log.status) {
            case 'completed':
              statusText = 'Completada'
              statusEmoji = '✅'
              break
            case 'in_progress':
              statusText = 'En Progreso'
              statusEmoji = '🟢'
              break
            case 'draft':
              statusText = 'Borrador'
              statusEmoji = '📝'
              break
            case 'cancelled':
              statusText = 'Cancelada'
              statusEmoji = '❌'
              break
            default:
              statusText = 'Desconocido'
              statusEmoji = '❓'
          }
          
          popupContent.innerHTML = `
            <h3 class="font-semibold mb-1">${log.title}</h3>
            ${log.mountainName ? `<p class="text-xs text-muted-foreground mb-1">🏔️ ${log.mountainName}</p>` : ''}
            ${log.location ? `<p class="text-xs text-muted-foreground mb-1">📍 ${log.location}</p>` : ''}
            <p class="text-xs text-muted-foreground mb-2">
              ${statusEmoji} ${statusText}
            </p>
            <button 
              class="text-xs text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              data-log-id="${log.logId}"
            >
              Ver detalles →
            </button>
          `
          
          // Agregar event listener para abrir modal con la ruta
          const button = popupContent.querySelector('button[data-log-id]')
          if (button) {
            button.addEventListener('click', (e) => {
              e.preventDefault()
              setSelectedLog(log)
              setIsModalOpen(true)
            })
          }

          marker.bindPopup(popupContent)
          markersRef.current.push(marker)
        })

        // Agregar marcadores para emergencias (rojos, por encima de bitácoras)
        emergenciesWithLocation.forEach((emergency) => {
          if (!emergency.location?.latitude || !emergency.location?.longitude) return

          const marker = L.marker(
            [emergency.location.latitude, emergency.location.longitude],
            {
              icon: EmergencyIcon,
              zIndexOffset: 1000 // Emergencias siempre por encima
            }
          ).addTo(map)

          // Crear popup con información de la emergencia
          const popupContent = document.createElement('div')
          popupContent.className = 'text-sm min-w-[200px]'
          popupContent.innerHTML = `
            <h3 class="font-semibold text-destructive mb-1">🚨 ${emergency.type || 'Emergencia'}</h3>
            ${emergency.description ? `<p class="text-xs text-muted-foreground mb-1">${emergency.description.substring(0, 100)}${emergency.description.length > 100 ? '...' : ''}</p>` : ''}
            <p class="text-xs text-muted-foreground mb-1">
              Severidad: ${emergency.severity || 'N/A'}
            </p>
            <p class="text-xs text-muted-foreground mb-2">
              Estado: ${emergency.status || 'N/A'}
            </p>
            <a 
              href="/emergencies/${emergency.emergencyId}"
              class="text-xs text-destructive hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Ver detalles →
            </a>
          `

          marker.bindPopup(popupContent)
          markersRef.current.push(marker)
        })

        // Ajustar vista para mostrar todos los marcadores (después de que todos estén agregados)
        timeoutRef.current = setTimeout(() => {
          // Verificar que el mapa aún existe y está inicializado
          if (!mapRef.current || !mapContainerRef.current) {
            return
          }
          
          const currentMap = mapRef.current
          
          // Verificar que el mapa no ha sido destruido
          try {
            if (!currentMap.getContainer() || !currentMap.getContainer().parentElement) {
              return
            }
          } catch (error) {
            console.warn('[MountainLogsMap] El mapa ya fue destruido:', error)
            return
          }
          
          if (markersRef.current.length > 0) {
            try {
              const group = new L.FeatureGroup(markersRef.current)
              const bounds = group.getBounds()
              if (bounds && bounds.isValid()) {
                currentMap.fitBounds(bounds.pad(0.1), { animate: false })
              }
            } catch (error) {
              console.warn('[MountainLogsMap] Error al ajustar bounds:', error)
              // Fallback: centrar en el primer marcador
              if (markersRef.current.length > 0) {
                try {
                  const firstMarker = markersRef.current[0]
                  const pos = firstMarker.getLatLng()
                  currentMap.setView([pos.lat, pos.lng], initialZoom, { animate: false })
                } catch (error) {
                  console.warn('[MountainLogsMap] Error al centrar en primer marcador:', error)
                }
              }
            }
          } else if (currentLocationMarkerRef.current && currentLocation) {
            // Si solo hay ubicación actual, centrar en ella
            try {
              currentMap.setView([currentLocation.latitude, currentLocation.longitude], 13, { animate: false })
            } catch (error) {
              console.warn('[MountainLogsMap] Error al centrar en ubicación actual:', error)
            }
          }
        }, 100)
      })
    } catch (error) {
      console.error('[MountainLogsMap] Error al inicializar mapa:', error)
      setMapError('Error al inicializar el mapa')
    }

    // Cleanup
    return () => {
      // Limpiar timeout si existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      
      // Limpiar marcadores
      markersRef.current.forEach(marker => {
        try {
          marker.remove()
        } catch (error) {
          // Ignorar errores al limpiar marcadores
        }
      })
      markersRef.current = []
      
      // Limpiar marcador de ubicación actual
      if (currentLocationMarkerRef.current) {
        try {
          currentLocationMarkerRef.current.remove()
        } catch (error) {
          // Ignorar errores al limpiar marcador
        }
        currentLocationMarkerRef.current = null
      }
      
      // Limpiar mapa
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch (error) {
          // Ignorar errores al limpiar mapa
        }
        mapRef.current = null
      }
    }
  }, [logsWithLocation, emergenciesWithLocation, isLoading, isOnline, currentLocation, isLoadingLocation])

  if (isLoading || isLoadingLocation) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-[calc(100vh-12rem)] sm:h-[calc(100vh-10rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] sm:h-[calc(100vh-10rem)] space-y-4 text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            El mapa requiere conexión a internet
          </p>
          <Badge variant="outline">Modo offline</Badge>
        </div>
      </div>
    )
  }

  // Si no hay bitácoras, emergencias ni ubicación actual
  if (logsWithLocation.length === 0 && emergenciesWithLocation.length === 0 && !currentLocation) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] sm:h-[calc(100vh-10rem)] space-y-4 text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hay bitácoras o emergencias con ubicación GPS disponible
          </p>
          <p className="text-xs text-muted-foreground">
            {showCurrentLocation ? 'Permite el acceso a tu ubicación para ver tu posición en el mapa' : 'Crea una bitácora y agrega milestones con GPS para verlas en el mapa'}
          </p>
          <Link to="/mountain-logs/new">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              <Mountain className="mr-2 h-4 w-4" />
              Crear Bitácora
            </Badge>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {mapError && (
        <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs">
          <p className="text-destructive">{mapError}</p>
        </div>
      )}
      <div 
        ref={mapContainerRef}
        className="w-full rounded-lg border overflow-hidden relative"
        style={{ 
          height: 'calc(100vh - 12rem)',
          minHeight: '400px',
          maxHeight: 'calc(100vh - 12rem)',
          position: 'sticky',
          top: 0,
        }}
      />
      
      {/* Modal de ruta */}
      <LogRouteModal
        log={selectedLog}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  )
}
