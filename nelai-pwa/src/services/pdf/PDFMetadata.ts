/**
 * Utilidades para manejar metadata GPS y EXIF en PDFs
 */

import type { GPSMetadata } from '@/types/documents'
import jsPDF from 'jspdf'

/**
 * Inyecta metadata GPS en un documento PDF
 * 
 * NOTA: jsPDF tiene limitaciones para metadata personalizada.
 * Esta función es un placeholder. La metadata GPS real se maneja
 * en el objeto Document de IndexedDB y se puede agregar al PDF
 * cuando se convierte a pdf-lib (ver mountainLogPDFGenerator.ts).
 * 
 * Esta función no hace nada actualmente, pero se mantiene para
 * compatibilidad con código existente.
 */
export function injectGPSMetadata(
  pdf: jsPDF,
  gpsMetadata: GPSMetadata
): void {
  // jsPDF no tiene getMetadata(). Las propiedades se establecen con setProperties()
  // y se pueden leer desde pdf.internal.metadata, pero no es necesario aquí.
  
  // La metadata GPS se guarda en el objeto Document de IndexedDB.
  // Si necesitamos agregarla al PDF, debemos hacerlo después de convertir
  // el PDF a pdf-lib (ver mountainLogPDFGenerator.ts línea 664+).
  
  // Por ahora, esta función no hace nada para evitar errores.
  // TODO: Si se necesita metadata GPS en el PDF, agregarla en mountainLogPDFGenerator.ts
  // después de cargar el PDF con PDFDocument.load()
}

/**
 * Obtiene la ubicación GPS actual del usuario
 */
export async function getCurrentGPSLocation(): Promise<GPSMetadata | null> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no está disponible'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy || undefined,
          timestamp: position.timestamp,
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}

/**
 * Extrae metadata EXIF de una imagen usando exif-js.
 * Soporta JPEG y TIFF. Retorna GPS, fecha y datos de cámara.
 */
export async function extractEXIFMetadata(imageFile: File): Promise<{
  gps?: GPSMetadata
  dateTime?: string
  cameraSettings?: { iso?: number; aperture?: string; shutterSpeed?: string; focalLength?: string }
  exifData?: Record<string, unknown>
  [key: string]: any
}> {
  return new Promise((resolve) => {
    try {
      import('exif-js').then((mod) => {
        const EXIF = mod.default
        EXIF.getData(imageFile, function (this: File & { exifdata?: Record<string, unknown> }) {
          try {
            const data = this.exifdata
            if (!data) {
              resolve({})
              return
            }
            const result: Record<string, unknown> = {}
            if (data.GPSLatitude && data.GPSLongitude) {
              result.gps = parseGPSFromExif(data)
            }
            if (data.DateTimeOriginal || data.DateTime) {
              result.dateTime = String(data.DateTimeOriginal || data.DateTime)
            }
          result.cameraSettings = {
            iso: data.ISOSpeedRatings ? Number(data.ISOSpeedRatings) : undefined,
            aperture: data.FNumber ? formatAperture(data.FNumber) : undefined,
            shutterSpeed: data.ExposureTime ? formatShutterSpeed(data.ExposureTime) : undefined,
            focalLength: data.FocalLength ? formatFocalLength(data.FocalLength) : undefined,
          }
          result.exifData = sanitizeExifForStorage(data)
          resolve(result)
          } catch {
            resolve({})
          }
        })
      }).catch(() => resolve({}))
    } catch {
      resolve({})
    }
  })
}

function parseGPSFromExif(data: Record<string, unknown>): GPSMetadata | undefined {
  try {
    const lat = data.GPSLatitude as Array<number | { valueOf(): number }> | undefined
    const lon = data.GPSLongitude as Array<number | { valueOf(): number }> | undefined
    if (!lat || !lon || lat.length < 3 || lon.length < 3) return undefined
    const toNum = (v: number | { valueOf(): number }) => (typeof v === 'number' ? v : Number(v))
    const latDeg = toNum(lat[0]) + toNum(lat[1]) / 60 + toNum(lat[2]) / 3600
    const lonDeg = toNum(lon[0]) + toNum(lon[1]) / 60 + toNum(lon[2]) / 3600
    const latRef = String(data.GPSLatitudeRef || 'N')
    const lonRef = String(data.GPSLongitudeRef || 'E')
    const latitude = latRef === 'S' ? -latDeg : latDeg
    const longitude = lonRef === 'W' ? -lonDeg : lonDeg
    let altitude: number | undefined
    if (data.GPSAltitude != null) {
      const alt = data.GPSAltitude
      altitude = Array.isArray(alt) ? toNum(alt[0]) : Number(alt)
    }
    return { latitude, longitude, altitude, accuracy: undefined, timestamp: Date.now() }
  } catch {
    return undefined
  }
}

function formatAperture(val: unknown): string {
  if (Array.isArray(val) && val.length > 0) {
    const n = Number(val[0]) / (Number(val[1]) || 1)
    return n.toFixed(1)
  }
  return String(val)
}

function formatShutterSpeed(val: unknown): string {
  if (Array.isArray(val) && val.length >= 2) {
    const n = Number(val[0]) / Number(val[1])
    if (n >= 1) return `${n.toFixed(0)}s`
    return `1/${Math.round(1 / n)}s`
  }
  return String(val)
}

function formatFocalLength(val: unknown): string {
  if (Array.isArray(val) && val.length > 0) {
    const n = Number(val[0]) / (Number(val[1]) || 1)
    return `${Math.round(n)}mm`
  }
  return String(val)
}

/** Convierte EXIF a valores serializables (evita Number con numerator/denominator) */
function sanitizeExifForStorage(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue
    if (Array.isArray(v)) {
      out[k] = v.map((x) => (typeof x === 'object' && x !== null && 'valueOf' in x ? Number(x) : x))
    } else if (typeof v === 'object' && v !== null && 'valueOf' in v) {
      out[k] = Number(v)
    } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    }
  }
  return out
}

/**
 * Convierte coordenadas GPS a formato de metadata PDF
 */
export function formatGPSForPDF(gps: GPSMetadata): {
  Latitude: number
  Longitude: number
  Altitude?: number
} {
  return {
    Latitude: gps.latitude,
    Longitude: gps.longitude,
    ...(gps.altitude !== undefined && { Altitude: gps.altitude }),
  }
}

