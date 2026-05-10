/**
 * Utilidades para validar y detectar GPS falsos (spoofing)
 * 
 * IMPORTANTE: En una PWA del lado del cliente, es IMPOSIBLE prevenir completamente
 * el GPS spoofing. Estas validaciones ayudan a detectar patrones sospechosos,
 * pero un usuario determinado puede eludirlas.
 */

import type { GPSPoint } from '@/types/mountainLogs'

export interface GPSValidationResult {
  isValid: boolean
  confidence: number // 0-100, qué tan confiable es la ubicación
  warnings: string[]
  flags: {
    suspiciousSpeed?: boolean
    suspiciousJump?: boolean
    lowAccuracy?: boolean
    inconsistentAltitude?: boolean
    timestampAnomaly?: boolean
  }
}

/**
 * Velocidad máxima razonable para montañismo (km/h)
 * Considerando que pueden usar vehículos para llegar al punto de inicio
 */
const MAX_REASONABLE_SPEED_KMH = 150 // km/h (para llegar al lugar)
const MAX_REASONABLE_SPEED_MOUNTAINEERING = 10 // km/h (durante la actividad)

/**
 * Distancia máxima que se puede recorrer entre dos puntos (metros)
 * Basado en velocidad máxima y tiempo transcurrido
 */
function calculateMaxReasonableDistance(
  point1: GPSPoint,
  point2: GPSPoint,
  maxSpeedKmh: number = MAX_REASONABLE_SPEED_MOUNTAINEERING
): number {
  const timeDiffSeconds = (point2.timestamp - point1.timestamp) / 1000
  const maxSpeedMs = (maxSpeedKmh * 1000) / 3600 // Convertir km/h a m/s
  return maxSpeedMs * timeDiffSeconds
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
 * Valida un punto GPS individual
 */
export function validateGPSPoint(
  point: GPSPoint,
  previousPoint?: GPSPoint
): GPSValidationResult {
  const warnings: string[] = []
  const flags: GPSValidationResult['flags'] = {}
  let confidence = 100

  // Validar precisión
  if (point.accuracy && point.accuracy > 100) {
    warnings.push(`Precisión baja: ±${Math.round(point.accuracy)}m`)
    flags.lowAccuracy = true
    confidence -= 20
  } else if (point.accuracy && point.accuracy > 50) {
    warnings.push(`Precisión moderada: ±${Math.round(point.accuracy)}m`)
    confidence -= 10
  }

  // Validar coordenadas válidas
  if (
    point.latitude < -90 ||
    point.latitude > 90 ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    warnings.push('Coordenadas fuera de rango válido')
    confidence = 0
    return {
      isValid: false,
      confidence: 0,
      warnings,
      flags: { ...flags }
    }
  }

  // Validar timestamp
  const now = Date.now()
  const timeDiff = Math.abs(point.timestamp - now)
  if (timeDiff > 60000) {
    // Más de 1 minuto de diferencia
    warnings.push('Timestamp sospechoso (muy diferente del tiempo actual)')
    flags.timestampAnomaly = true
    confidence -= 15
  }

  // Validar con punto anterior si existe
  if (previousPoint) {
    const distance = calculateDistance(
      previousPoint.latitude,
      previousPoint.longitude,
      point.latitude,
      point.longitude
    )
    const timeDiffSeconds = (point.timestamp - previousPoint.timestamp) / 1000

    if (timeDiffSeconds > 0) {
      const speedMs = distance / timeDiffSeconds
      const speedKmh = speedMs * 3.6

      // Detectar saltos sospechosos de ubicación
      const maxReasonableDistance = calculateMaxReasonableDistance(
        previousPoint,
        point,
        MAX_REASONABLE_SPEED_KMH
      )

      if (distance > maxReasonableDistance) {
        warnings.push(
          `Salto sospechoso: ${(distance / 1000).toFixed(2)}km en ${timeDiffSeconds.toFixed(0)}s (velocidad: ${speedKmh.toFixed(1)}km/h)`
        )
        flags.suspiciousJump = true
        confidence -= 30
      } else if (speedKmh > MAX_REASONABLE_SPEED_MOUNTAINEERING && distance > 100) {
        // Solo marcar como sospechoso si la distancia es significativa
        warnings.push(
          `Velocidad alta para montañismo: ${speedKmh.toFixed(1)}km/h`
        )
        flags.suspiciousSpeed = true
        confidence -= 15
      }

      // Validar consistencia de altitud
      if (
        previousPoint.altitude &&
        point.altitude &&
        Math.abs(point.altitude - previousPoint.altitude) > 1000 &&
        distance < 1000
      ) {
        // Cambio de altitud de más de 1km en menos de 1km de distancia horizontal
        warnings.push(
          `Cambio de altitud sospechoso: ${Math.round(previousPoint.altitude)}m → ${Math.round(point.altitude)}m`
        )
        flags.inconsistentAltitude = true
        confidence -= 20
      }
    }
  }

  // Validar altitud razonable (para montañismo, típicamente entre -100m y 9000m)
  if (point.altitude !== undefined) {
    if (point.altitude < -100 || point.altitude > 9000) {
      warnings.push(`Altitud fuera de rango razonable: ${Math.round(point.altitude)}m`)
      confidence -= 25
    }
  }

  return {
    isValid: confidence >= 50, // Considerar válido si confianza >= 50%
    confidence: Math.max(0, Math.min(100, confidence)),
    warnings,
    flags
  }
}

/**
 * Valida una secuencia de puntos GPS para detectar patrones sospechosos
 */
export function validateGPSSequence(points: GPSPoint[]): {
  isValid: boolean
  confidence: number
  warnings: string[]
  suspiciousPoints: number[] // Índices de puntos sospechosos
} {
  if (points.length === 0) {
    return {
      isValid: true,
      confidence: 100,
      warnings: [],
      suspiciousPoints: []
    }
  }

  const warnings: string[] = []
  const suspiciousPoints: number[] = []
  let totalConfidence = 0

  for (let i = 0; i < points.length; i++) {
    const previousPoint = i > 0 ? points[i - 1] : undefined
    const validation = validateGPSPoint(points[i], previousPoint)

    totalConfidence += validation.confidence

    if (!validation.isValid || validation.confidence < 70) {
      suspiciousPoints.push(i)
    }

    if (validation.warnings.length > 0 && i === points.length - 1) {
      // Solo mostrar warnings del último punto para no saturar
      warnings.push(...validation.warnings)
    }
  }

  const avgConfidence = totalConfidence / points.length

  // Detectar patrones adicionales
  if (points.length > 2) {
    // Detectar si todos los puntos están en la misma ubicación (posible GPS fijo)
    const firstPoint = points[0]
    const allSameLocation = points.every(
      (p) =>
        Math.abs(p.latitude - firstPoint.latitude) < 0.0001 &&
        Math.abs(p.longitude - firstPoint.longitude) < 0.0001
    )

    if (allSameLocation && points.length > 5) {
      warnings.push(
        'Todos los puntos están en la misma ubicación (posible GPS fijo o spoofing)'
      )
    }

    // Detectar si hay saltos muy grandes entre puntos consecutivos
    let largeJumps = 0
    for (let i = 1; i < points.length; i++) {
      const distance = calculateDistance(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude
      )
      if (distance > 10000) {
        // Más de 10km de salto
        largeJumps++
      }
    }

    if (largeJumps > points.length * 0.3) {
      // Más del 30% de los puntos tienen saltos grandes
      warnings.push(
        `Muchos saltos grandes de ubicación detectados (${largeJumps} de ${points.length})`
      )
    }
  }

  return {
    isValid: avgConfidence >= 50,
    confidence: avgConfidence,
    warnings,
    suspiciousPoints
  }
}

/**
 * Marca un punto GPS como potencialmente falsificado
 */
export function markAsSuspicious(
  point: GPSPoint,
  reason: string
): GPSPoint & { suspicious?: boolean; suspicionReason?: string } {
  return {
    ...point,
    suspicious: true,
    suspicionReason: reason
  }
}
