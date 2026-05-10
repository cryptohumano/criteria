/**
 * Hook para captura GPS y seguimiento de trayecto
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { GPSPoint, GPSMetadata } from '@/types/mountainLogs'
import { validateGPSPoint } from '@/utils/gpsValidation'

interface UseGPSTrackingOptions {
  enabled?: boolean
  interval?: number // Intervalo en milisegundos para captura automática
  highAccuracy?: boolean
  onLocationUpdate?: (point: GPSPoint) => void
}

interface UseGPSTrackingReturn {
  currentLocation: GPSPoint | null
  isTracking: boolean
  points: GPSPoint[]
  startTracking: () => Promise<void>
  stopTracking: () => void
  addManualPoint: (metadata?: Partial<GPSMetadata>) => Promise<void>
  clearPoints: () => void
  error: GeolocationPositionError | null
  hasPermission: boolean | null
}

/**
 * Calcula la distancia entre dos puntos GPS en metros (fórmula de Haversine)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // Radio de la Tierra en metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calcula la velocidad basada en dos puntos GPS
 */
function calculateSpeed(point1: GPSPoint, point2: GPSPoint): number {
  const distance = calculateDistance(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  )
  const timeDiff = (point2.timestamp - point1.timestamp) / 1000 // en segundos
  if (timeDiff === 0) return 0
  return distance / timeDiff // m/s
}

/**
 * Calcula el heading (dirección) entre dos puntos GPS
 */
function calculateHeading(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const lat1Rad = (lat1 * Math.PI) / 180
  const lat2Rad = (lat2 * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2Rad)
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon)
  const heading = (Math.atan2(y, x) * 180) / Math.PI
  return (heading + 360) % 360 // Normalizar a 0-360
}

export function useGPSTracking(
  options: UseGPSTrackingOptions = {}
): UseGPSTrackingReturn {
  const {
    enabled = false,
    interval = 5000, // 5 segundos por defecto
    highAccuracy = true,
    onLocationUpdate
  } = options

  const [currentLocation, setCurrentLocation] = useState<GPSPoint | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [points, setPoints] = useState<GPSPoint[]>([])
  const [error, setError] = useState<GeolocationPositionError | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)
  const lastPointRef = useRef<GPSPoint | null>(null)

  // Verificar permisos de geolocalización
  useEffect(() => {
    if (!navigator.geolocation) {
      setError({
        code: 0,
        message: 'Geolocalización no está disponible en este navegador',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3
      } as GeolocationPositionError)
      setHasPermission(false)
      return
    }

    // Intentar obtener posición para verificar permisos
    navigator.geolocation.getCurrentPosition(
      () => {
        setHasPermission(true)
        setError(null)
      },
      (err) => {
        setHasPermission(false)
        setError(err)
      },
      { timeout: 5000 }
    )
  }, [])

  const addPoint = useCallback(
    (position: GeolocationPosition) => {
      const point: GPSPoint = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude ?? undefined,
        accuracy: position.coords.accuracy ?? undefined,
        timestamp: position.timestamp || Date.now(),
        speed: position.coords.speed !== null ? position.coords.speed : undefined,
        heading:
          position.coords.heading !== null ? position.coords.heading : undefined
      }

      // Calcular velocidad y heading si hay un punto anterior
      if (lastPointRef.current) {
        if (!point.speed) {
          point.speed = calculateSpeed(lastPointRef.current, point)
        }
        if (!point.heading) {
          point.heading = calculateHeading(
            lastPointRef.current.latitude,
            lastPointRef.current.longitude,
            point.latitude,
            point.longitude
          )
        }
      }

      // Validar el punto GPS para detectar posibles falsificaciones
      const validation = validateGPSPoint(point, lastPointRef.current)
      if (!validation.isValid || validation.confidence < 70) {
        console.warn('⚠️ Punto GPS sospechoso detectado:', {
          point,
          validation,
          warnings: validation.warnings
        })
        // Marcar el punto como sospechoso pero aún así guardarlo
        ;(point as any).suspicious = true
        ;(point as any).suspicionReason = validation.warnings.join('; ')
        ;(point as any).confidence = validation.confidence
      }

      setCurrentLocation(point)
      setPoints((prev) => [...prev, point])
      lastPointRef.current = point

      if (onLocationUpdate) {
        onLocationUpdate(point)
      }
    },
    [onLocationUpdate]
  )

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setError({
        code: 0,
        message: 'Geolocalización no está disponible',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3
      } as GeolocationPositionError)
      return
    }

    setIsTracking(true)
    setError(null)

    // Obtener posición inicial
    navigator.geolocation.getCurrentPosition(
      (position) => {
        addPoint(position)
      },
      (err) => {
        setError(err)
        setIsTracking(false)
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: 0
      }
    )

    // Configurar watchPosition para seguimiento continuo
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        addPoint(position)
      },
      (err) => {
        setError(err)
        setIsTracking(false)
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: 0
      }
    )

    // Si hay un intervalo configurado, también capturar puntos periódicamente
    if (interval > 0) {
      intervalIdRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            addPoint(position)
          },
          (err) => {
            console.warn('Error al obtener posición en intervalo:', err)
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: 5000,
            maximumAge: 0
          }
        )
      }, interval)
    }
  }, [addPoint, highAccuracy, interval])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }
    setIsTracking(false)
  }, [])

  const addManualPoint = useCallback(
    async (metadata?: Partial<GPSMetadata>) => {
      return new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const point: GPSPoint = {
              latitude: metadata?.latitude ?? position.coords.latitude,
              longitude: metadata?.longitude ?? position.coords.longitude,
              altitude: metadata?.altitude ?? position.coords.altitude ?? undefined,
              accuracy: metadata?.accuracy ?? position.coords.accuracy ?? undefined,
              timestamp: metadata?.timestamp ?? position.timestamp ?? Date.now(),
              speed: position.coords.speed !== null ? position.coords.speed : undefined,
              heading:
                position.coords.heading !== null
                  ? position.coords.heading
                  : undefined
            }

            // Calcular velocidad y heading si hay un punto anterior
            if (lastPointRef.current) {
              if (!point.speed) {
                point.speed = calculateSpeed(lastPointRef.current, point)
              }
              if (!point.heading) {
                point.heading = calculateHeading(
                  lastPointRef.current.latitude,
                  lastPointRef.current.longitude,
                  point.latitude,
                  point.longitude
                )
              }
            }

            setPoints((prev) => [...prev, point])
            lastPointRef.current = point

            if (onLocationUpdate) {
              onLocationUpdate(point)
            }

            resolve()
          },
          (err) => {
            setError(err)
            reject(err)
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: 10000,
            maximumAge: 0
          }
        )
      })
    },
    [highAccuracy, onLocationUpdate]
  )

  const clearPoints = useCallback(() => {
    setPoints([])
    lastPointRef.current = null
    setCurrentLocation(null)
  }, [])

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [stopTracking])

  // Iniciar tracking si está habilitado
  useEffect(() => {
    if (enabled && hasPermission && !isTracking) {
      startTracking()
    } else if (!enabled && isTracking) {
      stopTracking()
    }
  }, [enabled, hasPermission, isTracking, startTracking, stopTracking])

  return {
    currentLocation,
    isTracking,
    points,
    startTracking,
    stopTracking,
    addManualPoint,
    clearPoints,
    error,
    hasPermission
  }
}
