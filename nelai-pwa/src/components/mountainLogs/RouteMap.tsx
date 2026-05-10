/**
 * Componente para mostrar el mapa de la ruta de la bitácora
 * Usa Leaflet para crear un mapa interactivo que traza la ruta con los puntos GPS
 */

import { useEffect, useRef, useState } from 'react'
import type { MountainLog, GPSPoint } from '@/types/mountainLogs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

L.Marker.prototype.options.icon = DefaultIcon

interface RouteMapProps {
  log: MountainLog
  className?: string
}

/**
 * Genera una URL de mapa estático usando OpenStreetMap
 * Si hay muchos puntos, los reduce para evitar URLs muy largas
 */
function generateStaticMapUrl(points: GPSPoint[]): string {
  if (points.length === 0) return ''

  // Reducir puntos si hay demasiados (máximo 100 puntos para evitar URLs muy largas)
  let processedPoints = points
  if (points.length > 100) {
    // Tomar puntos distribuidos uniformemente
    const step = Math.ceil(points.length / 100)
    processedPoints = points.filter((_, i) => i % step === 0 || i === 0 || i === points.length - 1)
  }

  // Calcular centro y bounds
  const lats = processedPoints.map(p => p.latitude)
  const lons = processedPoints.map(p => p.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const centerLat = (minLat + maxLat) / 2
  const centerLon = (minLon + maxLon) / 2

  // Usar OpenStreetMap Static API (gratuita, sin API key)
  // Formato: https://staticmap.openstreetmap.de/staticmap.php?center=LAT,LON&zoom=ZOOM&size=WIDTHxHEIGHT&markers=LAT,LON|LAT,LON&path=WEIGHT|COLOR|LAT,LON|LAT,LON
  const zoom = calculateZoom(minLat, maxLat, minLon, maxLon)
  const width = 800
  const height = 600

  // Construir marcadores (inicio y fin)
  const startMarker = `${processedPoints[0].latitude},${processedPoints[0].longitude}`
  const endMarker = processedPoints.length > 1 
    ? `${processedPoints[processedPoints.length - 1].latitude},${processedPoints[processedPoints.length - 1].longitude}`
    : startMarker
  const markers = `${startMarker}|${endMarker}`

  // Usar un servicio alternativo de mapas estáticos
  // El servicio staticmap.openstreetmap.de puede estar caído o tener limitaciones
  // Alternativa: usar un servicio que genere mapas basados en coordenadas
  
  // Opción 1: Intentar con staticmap.openstreetmap.de (puede fallar)
  // Opción 2: Usar un servicio alternativo como OpenStreetMap Nominatim o generar un mapa simple
  
  // Por ahora, usaremos un formato simple que debería funcionar
  // Si el servicio falla, mostraremos un mensaje de error en el componente
  const baseUrl = `https://staticmap.openstreetmap.de/staticmap.php`
  
  // Construir parámetros básicos (sin codificar para evitar problemas)
  const center = `${centerLat},${centerLon}`
  const size = `${width}x${height}`
  
  // Construir URL simple con marcadores solamente
  // El servicio puede no soportar path, así que usamos solo marcadores
  let url = `${baseUrl}?center=${center}&zoom=${zoom}&size=${size}`
  
  // Agregar marcadores (inicio y fin)
  if (markers) {
    url += `&markers=${markers}`
  }

  // Intentar agregar path solo si hay pocos puntos (máximo 20)
  // Algunos servicios no soportan path o tienen limitaciones
  if (processedPoints.length > 1 && processedPoints.length <= 20) {
    const pathPoints = processedPoints.map(p => `${p.latitude},${p.longitude}`).join('|')
    const path = `5|blue|${pathPoints}`
    const urlWithPath = `${url}&path=${path}`
    
    // Verificar que la URL no sea demasiado larga
    if (urlWithPath.length < 2000) {
      console.log(`[RouteMap] Generando mapa con ${processedPoints.length} puntos en la ruta`)
      return urlWithPath
    }
  }

  // Si no se puede agregar path, usar solo marcadores
  console.log(`[RouteMap] Generando mapa con solo marcadores (${processedPoints.length} puntos totales)`)
  return url
}

/**
 * Calcula el zoom apropiado basado en los bounds
 */
function calculateZoom(minLat: number, maxLat: number, minLon: number, maxLon: number): number {
  const latDiff = maxLat - minLat
  const lonDiff = maxLon - minLon
  const maxDiff = Math.max(latDiff, lonDiff)

  if (maxDiff > 10) return 5
  if (maxDiff > 5) return 6
  if (maxDiff > 2) return 7
  if (maxDiff > 1) return 8
  if (maxDiff > 0.5) return 9
  if (maxDiff > 0.2) return 10
  if (maxDiff > 0.1) return 11
  if (maxDiff > 0.05) return 12
  if (maxDiff > 0.02) return 13
  return 14
}

/**
 * Obtiene todos los puntos GPS de la bitácora
 */
function getAllGPSPoints(log: MountainLog): GPSPoint[] {
  const points: GPSPoint[] = []

  // Agregar puntos de milestones
  if (log.milestones) {
    log.milestones.forEach(milestone => {
      if (milestone.gpsPoint) {
        points.push(milestone.gpsPoint)
      }
    })
  }

  // Agregar puntos de tracking GPS
  if (log.gpsPoints && log.gpsPoints.length > 0) {
    points.push(...log.gpsPoints)
  }

  // Agregar puntos de rutas
  if (log.routes && log.routes.length > 0) {
    log.routes.forEach(route => {
      if (route.points && route.points.length > 0) {
        points.push(...route.points)
      }
    })
  }

  // Agregar ubicación inicial y final
  if (log.startLocation) {
    points.push({
      latitude: log.startLocation.latitude,
      longitude: log.startLocation.longitude,
      altitude: log.startLocation.altitude,
      accuracy: log.startLocation.accuracy,
      timestamp: log.startDate,
      confidence: log.startLocation.confidence || 'high',
    })
  }
  if (log.endLocation) {
    points.push({
      latitude: log.endLocation.latitude,
      longitude: log.endLocation.longitude,
      altitude: log.endLocation.altitude,
      accuracy: log.endLocation.accuracy,
      timestamp: log.endDate || Date.now(),
      confidence: log.endLocation.confidence || 'high',
    })
  }

  // Eliminar duplicados (misma lat/lon con tolerancia)
  const uniquePoints = points.filter((point, index, self) =>
    index === self.findIndex(p =>
      Math.abs(p.latitude - point.latitude) < 0.0001 &&
      Math.abs(p.longitude - point.longitude) < 0.0001
    )
  )

  // Ordenar por timestamp
  return uniquePoints.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
}

export function RouteMap({ log, className }: RouteMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [useOfflineMap, setUseOfflineMap] = useState(false)
  const points = getAllGPSPoints(log)
  
  // Detectar estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => {
      setIsOnline(false)
      setUseOfflineMap(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Verificar conexión al montar
    if (!navigator.onLine) {
      setUseOfflineMap(true)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  
  // Calcular centro del mapa
  const centerLat = points.length > 0 
    ? points.reduce((sum, p) => sum + p.latitude, 0) / points.length 
    : 0
  const centerLon = points.length > 0 
    ? points.reduce((sum, p) => sum + p.longitude, 0) / points.length 
    : 0
  
  // Convertir puntos GPS a formato Leaflet [lat, lon]
  const routeCoordinates = points.map(p => [p.latitude, p.longitude] as [number, number])
  
  // Generar mapa offline (SVG)
  useEffect(() => {
    if (useOfflineMap && svgContainerRef.current && points.length > 0) {
      // Usar import dinámico en lugar de require (compatible con navegador)
      import('@/utils/offlineMapGenerator').then(({ generateOfflineRouteMap }) => {
        const svg = generateOfflineRouteMap(points, {
          width: svgContainerRef.current?.clientWidth || 800,
          height: 384,
          showMarkers: true,
          showLabels: true,
        })
        if (svgContainerRef.current) {
          svgContainerRef.current.innerHTML = svg
        }
      }).catch((error) => {
        console.error('[RouteMap] Error al cargar generador de mapa offline:', error)
      })
    }
  }, [useOfflineMap, points])
  
  // Inicializar el mapa con Leaflet directamente (solo si hay conexión y no se usa mapa offline)
  useEffect(() => {
    if (useOfflineMap || !isOnline) return
    if (!mapContainerRef.current || points.length === 0) return
    
    // Si el mapa ya existe, no recrearlo
    if (mapRef.current) return
    
    // Crear el mapa
    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLon],
      zoom: 13,
      scrollWheelZoom: true,
    })
    
    // Agregar capa de tiles de OpenStreetMap
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })
    
    // Detectar si los tiles fallan al cargar
    tileLayer.on('tileerror', () => {
      console.warn('[RouteMap] Error al cargar tiles, cambiando a mapa offline')
      setUseOfflineMap(true)
    })
    
    tileLayer.addTo(map)
    
    // Agregar línea de ruta
    if (routeCoordinates.length > 1) {
      const polyline = L.polyline(routeCoordinates as [number, number][], {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.7,
      }).addTo(map)
    }
    
    // Agregar marcador de inicio
    if (points.length > 0) {
      const startMarker = L.marker([points[0].latitude, points[0].longitude]).addTo(map)
      const startPopup = `
        <div class="text-sm">
          <p class="font-semibold">Punto de Inicio</p>
          <p class="text-xs text-muted-foreground">
            ${points[0].latitude.toFixed(6)}, ${points[0].longitude.toFixed(6)}
          </p>
          ${points[0].altitude ? `<p class="text-xs text-muted-foreground">Altitud: ${Math.round(points[0].altitude)} m</p>` : ''}
          ${points[0].timestamp ? `<p class="text-xs text-muted-foreground">${new Date(points[0].timestamp).toLocaleString('es-ES')}</p>` : ''}
        </div>
      `
      startMarker.bindPopup(startPopup)
    }
    
    // Agregar marcador de fin
    if (points.length > 1) {
      const endMarker = L.marker([points[points.length - 1].latitude, points[points.length - 1].longitude]).addTo(map)
      const endPopup = `
        <div class="text-sm">
          <p class="font-semibold">Punto Final</p>
          <p class="text-xs text-muted-foreground">
            ${points[points.length - 1].latitude.toFixed(6)}, ${points[points.length - 1].longitude.toFixed(6)}
          </p>
          ${points[points.length - 1].altitude ? `<p class="text-xs text-muted-foreground">Altitud: ${Math.round(points[points.length - 1].altitude)} m</p>` : ''}
          ${points[points.length - 1].timestamp ? `<p class="text-xs text-muted-foreground">${new Date(points[points.length - 1].timestamp).toLocaleString('es-ES')}</p>` : ''}
        </div>
      `
      endMarker.bindPopup(endPopup)
    }
    
    // Ajustar bounds para mostrar toda la ruta
    if (routeCoordinates.length > 0) {
      const bounds = L.latLngBounds(routeCoordinates as [number, number][])
      map.fitBounds(bounds, { padding: [20, 20] })
    }
    
    mapRef.current = map
    
    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [points, centerLat, centerLon, routeCoordinates, useOfflineMap, isOnline])

  if (points.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mapa de la Ruta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay puntos GPS disponibles para mostrar en el mapa.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Mapa de la Ruta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-muted-foreground">
              No hay puntos GPS disponibles para mostrar en el mapa.
            </p>
          </div>
        ) : useOfflineMap || !isOnline ? (
          <div className="space-y-2">
            <div className="relative">
              <div 
                ref={svgContainerRef}
                className="h-96 w-full rounded-lg border overflow-hidden bg-muted/50 flex items-center justify-center"
                style={{ minHeight: '384px' }}
              />
              {!isOnline && (
                <div className="absolute top-2 right-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs px-2 py-1 rounded">
                  Modo offline
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {points.length} punto{points.length !== 1 ? 's' : ''} GPS
              </span>
              <span>Mapa offline (SVG)</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div 
              ref={mapContainerRef}
              className="h-96 w-full rounded-lg border overflow-hidden"
              style={{ 
                minHeight: '384px',
                position: 'relative',
                zIndex: 0,
              }}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {points.length} punto{points.length !== 1 ? 's' : ''} GPS
              </span>
              <span>Mapa interactivo (Leaflet)</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Mantener la función para compatibilidad con PDF (fallback al mapa estático)
export function RouteMapFallback({ log, className }: RouteMapProps) {
  const [mapUrl, setMapUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const points = getAllGPSPoints(log)
    
    if (points.length === 0) {
      setLoading(false)
      setMapUrl('')
      setError(null)
      setImageError(false)
      return
    }

    const url = generateStaticMapUrl(points)
    setMapUrl(url)
    setError(null)
    setImageError(false)
    setLoading(false)
  }, [log])

  const points = getAllGPSPoints(log)

  if (points.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Mapa de la Ruta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay puntos GPS disponibles para mostrar en el mapa.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Mapa de la Ruta
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-muted-foreground">Cargando mapa...</p>
          </div>
        ) : mapUrl && !imageError ? (
          <div className="space-y-2">
            <img
              src={mapUrl}
              alt="Mapa de la ruta"
              className="w-full h-auto rounded-lg border"
              crossOrigin="anonymous"
              onError={() => {
                setError('El servicio de mapas no está disponible.')
                setImageError(true)
                setLoading(false)
              }}
              onLoad={() => {
                setLoading(false)
                setError(null)
                setImageError(false)
              }}
            />
            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              {points.length} punto{points.length !== 1 ? 's' : ''} GPS registrado{points.length !== 1 ? 's' : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mensaje de error */}
            <div className="text-center space-y-2 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                El servicio de mapas no está disponible.
              </p>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>

            {/* Visualización alternativa: Lista de puntos GPS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Puntos GPS de la Ruta ({points.length})
                </h4>
                <span className="text-xs text-muted-foreground">
                  Ordenados por tiempo
                </span>
              </div>
              
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {points.slice(0, 20).map((point, index) => (
                  <div
                    key={`${point.latitude}-${point.longitude}-${point.timestamp || index}`}
                    className="flex items-start gap-3 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-foreground">
                          {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
                        </span>
                        {point.altitude && (
                          <span className="text-xs text-muted-foreground">
                            • {Math.round(point.altitude)} m
                          </span>
                        )}
                      </div>
                      {point.timestamp && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(point.timestamp).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </div>
                      )}
                      {point.accuracy && (
                        <div className="text-xs text-muted-foreground">
                          Precisión: ±{Math.round(point.accuracy)} m
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {points.length > 20 && (
                  <div className="text-center text-xs text-muted-foreground py-2">
                    ... y {points.length - 20} punto{points.length - 20 !== 1 ? 's' : ''} más
                  </div>
                )}
              </div>

              {/* Información resumida */}
              {points.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                  <div>
                    <span className="text-muted-foreground">Inicio: </span>
                    <span className="font-mono">
                      {points[0].latitude.toFixed(4)}, {points[0].longitude.toFixed(4)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fin: </span>
                    <span className="font-mono">
                      {points[points.length - 1].latitude.toFixed(4)}, {points[points.length - 1].longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Genera una imagen del mapa en base64 para incluir en el PDF
 * Usa mapa offline (SVG) como método principal - funciona sin internet
 */
export async function generateMapImageBase64(log: MountainLog): Promise<string | null> {
  const points = getAllGPSPoints(log)
  
  if (points.length === 0) {
    return null
  }

  // Usar mapa offline como método principal (siempre funciona, no depende de internet)
  try {
    const { generateOfflineMapImageBase64 } = await import('@/utils/offlineMapGenerator')
    const offlineMap = await generateOfflineMapImageBase64(points, 800, 600)
    console.log('[RouteMap] ✅ Mapa offline generado exitosamente para PDF')
    return offlineMap
  } catch (offlineError) {
    console.warn('[RouteMap] ⚠️ Error al generar mapa offline, intentando servicio estático:', offlineError)
  }

  // Fallback al servicio estático (solo si hay conexión y el offline falló)
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const mapUrl = generateStaticMapUrl(points)
      
      // Crear un AbortController para timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 segundos timeout (más corto)
      
      try {
        // Convertir la imagen del mapa a base64 con timeout
        const response = await fetch(mapUrl, {
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-cache',
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status} ${response.statusText}`)
        }
        
        const blob = await response.blob()
        
        // Verificar que sea una imagen válida
        if (!blob.type.startsWith('image/')) {
          throw new Error('La respuesta no es una imagen válida')
        }
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64 = reader.result as string
            resolve(base64)
          }
          reader.onerror = () => {
            reject(new Error('Error al leer el blob de la imagen'))
          }
          reader.readAsDataURL(blob)
        })
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            throw new Error('Timeout al cargar el mapa (5 segundos)')
          }
          throw fetchError
        }
        throw new Error('Error desconocido al cargar el mapa')
      }
    } catch (error) {
      console.warn('[RouteMap] ⚠️ Servicio estático falló, usando mapa offline como último recurso:', error)
      // Intentar mapa offline como último recurso
      try {
        const { generateOfflineMapImageBase64 } = await import('@/utils/offlineMapGenerator')
        return await generateOfflineMapImageBase64(points, 800, 600)
      } catch (offlineError) {
        console.error('[RouteMap] ❌ No se pudo generar ningún mapa:', offlineError)
        return null
      }
    }
  } else {
    // Sin conexión, usar mapa offline
    try {
      const { generateOfflineMapImageBase64 } = await import('@/utils/offlineMapGenerator')
      return await generateOfflineMapImageBase64(points, 800, 600)
    } catch (error) {
      console.error('[RouteMap] ❌ No se pudo generar mapa offline:', error)
      return null
    }
  }
}
