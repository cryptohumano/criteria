/**
 * Utilidades para calcular estadísticas de bitácoras de montañismo
 */

import type { MountainLog, GPSPoint, MountainLogMilestone } from '@/types/mountainLogs'

/**
 * Calcula la distancia entre dos puntos GPS usando la fórmula de Haversine
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Formatea la duración en segundos a formato legible (h m)
 * Maneja tanto segundos como milisegundos para compatibilidad
 */
export function formatDuration(duration: number): string {
  // Si la duración es muy grande (> 1 año en segundos), probablemente está en milisegundos
  const durationInSeconds = duration > 31536000 ? duration / 1000 : duration
  
  const hours = Math.floor(durationInSeconds / 3600)
  const minutes = Math.floor((durationInSeconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Calcula estadísticas completas de una bitácora de montañismo
 */
export function calculateMountainLogStatistics(log: MountainLog): MountainLog['statistics'] {
  const allGPSPoints = getAllGPSPoints(log)
  
  if (allGPSPoints.length === 0) {
    return {
      totalDistance: 0,
      totalDuration: log.endDate && log.startDate ? (log.endDate - log.startDate) / 1000 : undefined,
    }
  }

  // Ordenar puntos por timestamp
  const sortedPoints = [...allGPSPoints].sort((a, b) => a.timestamp - b.timestamp)

  // Calcular distancias y elevaciones
  let totalDistance = 0
  let totalElevationGain = 0
  let totalElevationLoss = 0
  let maxElevation = sortedPoints[0].altitude || 0
  let minElevation = sortedPoints[0].altitude || 0
  let maxSpeed = 0
  let totalSpeed = 0
  let speedCount = 0

  // Tiempo de inicio y fin
  const startTime = sortedPoints[0].timestamp
  const endTime = sortedPoints[sortedPoints.length - 1].timestamp

  for (let i = 1; i < sortedPoints.length; i++) {
    const prev = sortedPoints[i - 1]
    const curr = sortedPoints[i]

    // Calcular distancia
    const distance = calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    )
    totalDistance += distance

    // Calcular elevación
    if (prev.altitude !== undefined && curr.altitude !== undefined) {
      const elevationDiff = curr.altitude - prev.altitude
      if (elevationDiff > 0) {
        totalElevationGain += elevationDiff
      } else {
        totalElevationLoss += Math.abs(elevationDiff)
      }

      maxElevation = Math.max(maxElevation, curr.altitude)
      minElevation = Math.min(minElevation, curr.altitude)
    }

    // Calcular velocidad
    if (curr.speed !== undefined && curr.speed > 0) {
      maxSpeed = Math.max(maxSpeed, curr.speed)
      totalSpeed += curr.speed
      speedCount++
    } else if (prev.timestamp && curr.timestamp) {
      // Calcular velocidad basada en distancia y tiempo
      const timeDiff = (curr.timestamp - prev.timestamp) / 1000 // segundos
      if (timeDiff > 0) {
        const calculatedSpeed = distance / timeDiff // m/s
        maxSpeed = Math.max(maxSpeed, calculatedSpeed)
        totalSpeed += calculatedSpeed
        speedCount++
      }
    }
  }

  // Calcular duración total
  const totalDuration = endTime - startTime // en milisegundos, convertir a segundos

  // Calcular velocidad promedio
  const averageSpeed = speedCount > 0 ? totalSpeed / speedCount : undefined

  return {
    totalDistance,
    totalElevationGain,
    totalElevationLoss,
    maxElevation,
    minElevation,
    maxSpeed,
    averageSpeed,
    totalDuration: totalDuration / 1000, // convertir a segundos
    numberOfPhotos: log.milestones.reduce((count, m) => count + m.images.length, 0),
    numberOfWaypoints: log.milestones.length,
  }
}

/**
 * Obtiene todos los puntos GPS de una bitácora (de milestones, gpsPoints, y rutas)
 */
function getAllGPSPoints(log: MountainLog): GPSPoint[] {
  const points: GPSPoint[] = []

  // Agregar puntos de milestones
  log.milestones.forEach(milestone => {
    if (milestone.gpsPoint) {
      points.push(milestone.gpsPoint)
    }
  })

  // Agregar puntos GPS directos
  if (log.gpsPoints && log.gpsPoints.length > 0) {
    points.push(...log.gpsPoints)
  }

  // Agregar puntos de rutas
  log.routes.forEach(route => {
    if (route.points && route.points.length > 0) {
      points.push(...route.points)
    }
  })

  // Eliminar duplicados basados en timestamp y coordenadas
  const uniquePoints = points.filter((point, index, self) =>
    index === self.findIndex(p =>
      p.timestamp === point.timestamp &&
      p.latitude === point.latitude &&
      p.longitude === point.longitude
    )
  )

  return uniquePoints
}

/**
 * Actualiza las estadísticas de una bitácora
 */
export function updateMountainLogStatistics(log: MountainLog): MountainLog {
  const statistics = calculateMountainLogStatistics(log)
  
  // Actualizar puntos más altos y bajos
  const allPoints = getAllGPSPoints(log)
  if (allPoints.length > 0) {
    const pointsWithAltitude = allPoints.filter(p => p.altitude !== undefined)
    if (pointsWithAltitude.length > 0) {
      const sortedByAltitude = [...pointsWithAltitude].sort((a, b) => (b.altitude || 0) - (a.altitude || 0))
      log.highestPoint = sortedByAltitude[0]
      log.lowestPoint = sortedByAltitude[sortedByAltitude.length - 1]
    }
  }

  // Actualizar ubicaciones de inicio y fin
  if (allPoints.length > 0) {
    const sortedPoints = [...allPoints].sort((a, b) => a.timestamp - b.timestamp)
    log.startLocation = {
      latitude: sortedPoints[0].latitude,
      longitude: sortedPoints[0].longitude,
      altitude: sortedPoints[0].altitude,
      accuracy: sortedPoints[0].accuracy,
      timestamp: sortedPoints[0].timestamp,
    }
    log.endLocation = {
      latitude: sortedPoints[sortedPoints.length - 1].latitude,
      longitude: sortedPoints[sortedPoints.length - 1].longitude,
      altitude: sortedPoints[sortedPoints.length - 1].altitude,
      accuracy: sortedPoints[sortedPoints.length - 1].accuracy,
      timestamp: sortedPoints[sortedPoints.length - 1].timestamp,
    }
  }

  return {
    ...log,
    statistics,
  }
}
