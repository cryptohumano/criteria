/**
 * Utilidades para procesar archivos GPX y KMZ
 * 
 * Los archivos GPX/KMZ contienen información de rutas que puede ser útil para:
 * 1. Pre-cargar waypoints en la bitácora
 * 2. Visualizar la ruta planificada en un mapa
 * 3. Comparar la ruta planificada vs la ruta real (tracking GPS)
 * 4. Exportar la ruta para compartir
 * 5. Validar que el equipo tenga la ruta correcta
 */

import type { GPSPoint } from '@/types/mountainLogs'

export interface GPXWaypoint {
  name?: string
  description?: string
  latitude: number
  longitude: number
  elevation?: number
  time?: Date
}

export interface GPXTrack {
  name?: string
  segments: GPXPoint[][]
}

export interface GPXPoint {
  latitude: number
  longitude: number
  elevation?: number
  time?: Date
}

export interface ParsedGPX {
  waypoints: GPXWaypoint[]
  tracks: GPXTrack[]
  routes: GPXPoint[][]
  metadata?: {
    name?: string
    description?: string
    author?: string
    time?: Date
  }
}

/**
 * Parsea un archivo GPX y extrae waypoints, tracks y rutas
 */
export async function parseGPX(file: File): Promise<ParsedGPX> {
  const text = await file.text()
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(text, 'text/xml')

  // Verificar errores de parsing
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    throw new Error('Error al parsear el archivo GPX. Verifica que sea un archivo GPX válido.')
  }

  const result: ParsedGPX = {
    waypoints: [],
    tracks: [],
    routes: []
  }

  // Parsear metadata
  const metadata = xmlDoc.querySelector('metadata')
  if (metadata) {
    result.metadata = {
      name: getTextContent(metadata, 'name'),
      description: getTextContent(metadata, 'desc'),
      author: getTextContent(metadata, 'author > name'),
      time: parseGPXTime(getTextContent(metadata, 'time'))
    }
  }

  // Parsear waypoints
  const waypoints = xmlDoc.querySelectorAll('wpt')
  waypoints.forEach((wpt) => {
    const lat = parseFloat(wpt.getAttribute('lat') || '0')
    const lon = parseFloat(wpt.getAttribute('lon') || '0')
    const ele = getTextContent(wpt, 'ele')
    const time = getTextContent(wpt, 'time')

    result.waypoints.push({
      name: getTextContent(wpt, 'name'),
      description: getTextContent(wpt, 'desc'),
      latitude: lat,
      longitude: lon,
      elevation: ele ? parseFloat(ele) : undefined,
      time: time ? parseGPXTime(time) : undefined
    })
  })

  // Parsear tracks
  const tracks = xmlDoc.querySelectorAll('trk')
  tracks.forEach((trk) => {
    const track: GPXTrack = {
      name: getTextContent(trk, 'name'),
      segments: []
    }

    const segments = trk.querySelectorAll('trkseg')
    segments.forEach((seg) => {
      const points: GPXPoint[] = []
      const trkpts = seg.querySelectorAll('trkpt')
      
      trkpts.forEach((trkpt) => {
        const lat = parseFloat(trkpt.getAttribute('lat') || '0')
        const lon = parseFloat(trkpt.getAttribute('lon') || '0')
        const ele = getTextContent(trkpt, 'ele')
        const time = getTextContent(trkpt, 'time')

        points.push({
          latitude: lat,
          longitude: lon,
          elevation: ele ? parseFloat(ele) : undefined,
          time: time ? parseGPXTime(time) : undefined
        })
      })

      if (points.length > 0) {
        track.segments.push(points)
      }
    })

    if (track.segments.length > 0) {
      result.tracks.push(track)
    }
  })

  // Parsear routes
  const routes = xmlDoc.querySelectorAll('rte')
  routes.forEach((rte) => {
    const points: GPXPoint[] = []
    const rtepts = rte.querySelectorAll('rtept')
    
    rtepts.forEach((rtept) => {
      const lat = parseFloat(rtept.getAttribute('lat') || '0')
      const lon = parseFloat(rtept.getAttribute('lon') || '0')
      const ele = getTextContent(rtept, 'ele')

      points.push({
        latitude: lat,
        longitude: lon,
        elevation: ele ? parseFloat(ele) : undefined
      })
    })

    if (points.length > 0) {
      result.routes.push(points)
    }
  })

  return result
}

/**
 * Convierte waypoints GPX a GPSPoints para usar en la bitácora
 */
export function convertGPXWaypointsToGPSPoints(waypoints: GPXWaypoint[]): GPSPoint[] {
  return waypoints.map((wpt) => ({
    latitude: wpt.latitude,
    longitude: wpt.longitude,
    altitude: wpt.elevation,
    timestamp: wpt.time ? wpt.time.getTime() : Date.now(),
    accuracy: undefined
  }))
}

/**
 * Convierte tracks GPX a GPSPoints
 */
export function convertGPXTracksToGPSPoints(tracks: GPXTrack[]): GPSPoint[] {
  const points: GPSPoint[] = []
  
  tracks.forEach((track) => {
    track.segments.forEach((segment) => {
      segment.forEach((point) => {
        points.push({
          latitude: point.latitude,
          longitude: point.longitude,
          altitude: point.elevation,
          timestamp: point.time ? point.time.getTime() : Date.now(),
          accuracy: undefined
        })
      })
    })
  })

  return points
}

/**
 * Calcula estadísticas de una ruta GPX
 */
export function calculateGPXStats(points: GPSPoint[]) {
  if (points.length === 0) {
    return {
      totalDistance: 0,
      totalElevationGain: 0,
      totalElevationLoss: 0,
      maxElevation: 0,
      minElevation: 0,
      startPoint: null,
      endPoint: null
    }
  }

  let totalDistance = 0
  let totalElevationGain = 0
  let totalElevationLoss = 0
  let maxElevation = points[0].altitude || 0
  let minElevation = points[0].altitude || 0

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]

    // Calcular distancia
    const distance = calculateDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    )
    totalDistance += distance

    // Calcular ganancia/pérdida de elevación
    if (prev.altitude && curr.altitude) {
      const elevationDiff = curr.altitude - prev.altitude
      if (elevationDiff > 0) {
        totalElevationGain += elevationDiff
      } else {
        totalElevationLoss += Math.abs(elevationDiff)
      }

      maxElevation = Math.max(maxElevation, curr.altitude)
      minElevation = Math.min(minElevation, curr.altitude)
    }
  }

  return {
    totalDistance,
    totalElevationGain,
    totalElevationLoss,
    maxElevation,
    minElevation,
    startPoint: points[0],
    endPoint: points[points.length - 1]
  }
}

/**
 * Calcula la distancia entre dos puntos GPS (fórmula de Haversine)
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
 * Helper para obtener contenido de texto de un elemento XML
 */
function getTextContent(parent: Element, selector: string): string {
  const element = parent.querySelector(selector)
  return element?.textContent?.trim() || ''
}

/**
 * Parsea un timestamp GPX (ISO 8601)
 */
function parseGPXTime(timeString: string): Date | undefined {
  if (!timeString) return undefined
  try {
    return new Date(timeString)
  } catch {
    return undefined
  }
}

/**
 * Procesa un archivo KMZ (es un ZIP que contiene un GPX)
 */
export async function parseKMZ(file: File): Promise<ParsedGPX> {
  // KMZ es básicamente un ZIP que contiene archivos GPX
  // Por ahora, requerimos que el usuario extraiga el GPX manualmente
  // O podríamos usar una librería como JSZip para descomprimir
  
  throw new Error('El formato KMZ aún no está soportado. Por favor, extrae el archivo GPX del KMZ y súbelo directamente.')
  
  // TODO: Implementar con JSZip
  // const JSZip = await import('jszip')
  // const zip = await JSZip.loadAsync(file)
  // const gpxFile = Object.values(zip.files).find(f => f.name.endsWith('.gpx'))
  // if (!gpxFile) throw new Error('No se encontró archivo GPX en el KMZ')
  // const gpxText = await gpxFile.async('string')
  // return parseGPXFromText(gpxText)
}
