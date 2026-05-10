/**
 * Generador de mapas offline para rutas GPS
 * Crea un mapa SVG que funciona sin conexión a internet
 */

import type { GPSPoint } from '@/types/mountainLogs'

export interface MapBounds {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
  centerLat: number
  centerLon: number
}

/**
 * Calcula los bounds de un conjunto de puntos GPS
 */
export function calculateBounds(points: GPSPoint[]): MapBounds {
  if (points.length === 0) {
    return {
      minLat: 0,
      maxLat: 0,
      minLon: 0,
      maxLon: 0,
      centerLat: 0,
      centerLon: 0,
    }
  }

  const lats = points.map(p => p.latitude)
  const lons = points.map(p => p.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const centerLat = (minLat + maxLat) / 2
  const centerLon = (minLon + maxLon) / 2

  return { minLat, maxLat, minLon, maxLon, centerLat, centerLon }
}

/**
 * Convierte coordenadas GPS a coordenadas SVG
 */
function gpsToSVG(
  lat: number,
  lon: number,
  bounds: MapBounds,
  width: number,
  height: number,
  padding: number = 20
): [number, number] {
  const effectiveWidth = width - padding * 2
  const effectiveHeight = height - padding * 2

  const latRange = bounds.maxLat - bounds.minLat || 0.001
  const lonRange = bounds.maxLon - bounds.minLon || 0.001

  const x = padding + ((lon - bounds.minLon) / lonRange) * effectiveWidth
  const y = padding + ((bounds.maxLat - lat) / latRange) * effectiveHeight

  return [x, y]
}

/**
 * Genera un mapa SVG offline de la ruta
 */
export function generateOfflineRouteMap(
  points: GPSPoint[],
  options: {
    width?: number
    height?: number
    showMarkers?: boolean
    showLabels?: boolean
  } = {}
): string {
  if (points.length === 0) {
    return '<svg width="800" height="600"><text x="400" y="300" text-anchor="middle">No hay puntos GPS</text></svg>'
  }

  const width = options.width || 800
  const height = options.height || 600
  const showMarkers = options.showMarkers !== false
  const showLabels = options.showLabels !== false
  const padding = 40

  const bounds = calculateBounds(points)

  // Generar path de la ruta
  const pathPoints = points.map(p => {
    const [x, y] = gpsToSVG(p.latitude, p.longitude, bounds, width, height, padding)
    return `${x},${y}`
  })
  const pathData = pathPoints.join(' ')

  // Generar marcadores
  const markers: string[] = []
  if (showMarkers && points.length > 0) {
    // Marcador de inicio
    const [startX, startY] = gpsToSVG(points[0].latitude, points[0].longitude, bounds, width, height, padding)
    markers.push(`
      <circle cx="${startX}" cy="${startY}" r="8" fill="#10b981" stroke="white" stroke-width="2"/>
      <text x="${startX}" y="${startY - 12}" text-anchor="middle" font-size="10" font-weight="bold" fill="#10b981">INICIO</text>
    `)

    // Marcador de fin (si hay más de un punto)
    if (points.length > 1) {
      const [endX, endY] = gpsToSVG(
        points[points.length - 1].latitude,
        points[points.length - 1].longitude,
        bounds,
        width,
        height,
        padding
      )
      markers.push(`
        <circle cx="${endX}" cy="${endY}" r="8" fill="#ef4444" stroke="white" stroke-width="2"/>
        <text x="${endX}" y="${endY - 12}" text-anchor="middle" font-size="10" font-weight="bold" fill="#ef4444">FIN</text>
      `)
    }
  }

  // Generar etiquetas de coordenadas si se solicitan
  const labels: string[] = []
  if (showLabels && points.length > 0) {
    const [startX, startY] = gpsToSVG(points[0].latitude, points[0].longitude, bounds, width, height, padding)
    labels.push(`
      <text x="${startX}" y="${startY + 25}" text-anchor="middle" font-size="8" fill="#666">
        ${points[0].latitude.toFixed(4)}, ${points[0].longitude.toFixed(4)}
      </text>
    `)
    if (points.length > 1) {
      const [endX, endY] = gpsToSVG(
        points[points.length - 1].latitude,
        points[points.length - 1].longitude,
        bounds,
        width,
        height,
        padding
      )
      labels.push(`
        <text x="${endX}" y="${endY + 25}" text-anchor="middle" font-size="8" fill="#666">
          ${points[points.length - 1].latitude.toFixed(4)}, ${points[points.length - 1].longitude.toFixed(4)}
        </text>
      `)
    }
  }

  // Generar grid de referencia (opcional)
  const gridLines: string[] = []
  const gridSteps = 5
  for (let i = 0; i <= gridSteps; i++) {
    const lat = bounds.minLat + (bounds.maxLat - bounds.minLat) * (i / gridSteps)
    const lon = bounds.minLon + (bounds.maxLon - bounds.minLon) * (i / gridSteps)
    
    // Línea horizontal
    const [hx1, hy] = gpsToSVG(lat, bounds.minLon, bounds, width, height, padding)
    const [hx2] = gpsToSVG(lat, bounds.maxLon, bounds, width, height, padding)
    gridLines.push(`<line x1="${hx1}" y1="${hy}" x2="${hx2}" y2="${hy}" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.5"/>`)
    
    // Línea vertical
    const [vx, vy1] = gpsToSVG(bounds.maxLat, lon, bounds, width, height, padding)
    const [, vy2] = gpsToSVG(bounds.minLat, lon, bounds, width, height, padding)
    gridLines.push(`<line x1="${vx}" y1="${vy1}" x2="${vx}" y2="${vy2}" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.5"/>`)
  }

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .route-path { fill: none; stroke: #3b82f6; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
          .route-point { fill: #3b82f6; stroke: white; stroke-width: 1; }
        </style>
      </defs>
      <!-- Fondo -->
      <rect width="${width}" height="${height}" fill="#f9fafb"/>
      
      <!-- Grid de referencia -->
      ${gridLines.join('\n      ')}
      
      <!-- Línea de ruta -->
      <polyline points="${pathData}" class="route-path" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      
      <!-- Puntos de la ruta (opcional, solo si hay pocos puntos) -->
      ${points.length <= 50 ? points.map((p, i) => {
        const [x, y] = gpsToSVG(p.latitude, p.longitude, bounds, width, height, padding)
        return `<circle cx="${x}" cy="${y}" r="2" fill="#3b82f6" opacity="0.6"/>`
      }).join('\n      ') : ''}
      
      <!-- Marcadores -->
      ${markers.join('\n      ')}
      
      <!-- Etiquetas -->
      ${labels.join('\n      ')}
      
      <!-- Información en la esquina -->
      <g transform="translate(${width - padding - 150}, ${padding})">
        <rect width="150" height="60" fill="white" fill-opacity="0.9" stroke="#e5e7eb" stroke-width="1" rx="4"/>
        <text x="10" y="20" font-size="10" font-weight="bold" fill="#1f2937">Ruta GPS</text>
        <text x="10" y="35" font-size="9" fill="#6b7280">${points.length} punto${points.length !== 1 ? 's' : ''}</text>
        <text x="10" y="50" font-size="9" fill="#6b7280">Mapa offline</text>
      </g>
    </svg>
  `.trim()

  return svg
}

/**
 * Convierte un SVG a base64 (PNG) para usar en PDFs
 */
export async function svgToBase64PNG(
  svgString: string,
  width: number = 800,
  height: number = 600
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Crear imagen desde SVG
      const img = new Image()
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      img.onload = () => {
        try {
          // Crear canvas
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            reject(new Error('No se pudo obtener contexto del canvas'))
            return
          }

          // Dibujar imagen en canvas
          ctx.drawImage(img, 0, 0, width, height)

          // Convertir a base64
          const base64 = canvas.toDataURL('image/png')
          URL.revokeObjectURL(url)
          resolve(base64)
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Error al cargar la imagen SVG'))
      }

      img.src = url
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Genera una imagen base64 del mapa offline para PDFs
 */
export async function generateOfflineMapImageBase64(
  points: GPSPoint[],
  width: number = 800,
  height: number = 600
): Promise<string> {
  const svg = generateOfflineRouteMap(points, { width, height, showMarkers: true, showLabels: false })
  return svgToBase64PNG(svg, width, height)
}
