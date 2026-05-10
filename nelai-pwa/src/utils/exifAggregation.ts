/**
 * Agrega metadata EXIF/cámara de las imágenes de una bitácora
 * para incrustarla en PDF y Content Credentials.
 */

import type { MountainLog, MountainLogImage } from '@/types/mountainLogs'

export interface AggregatedExifData {
  /** Resumen de cámaras/dispositivos usados */
  cameraSummary?: string[]
  /** Configuraciones de cámara (ISO, apertura, etc.) */
  cameraSettings?: Array<{
    iso?: number
    aperture?: string
    shutterSpeed?: string
    focalLength?: string
    capturedAt?: number
  }>
  /** Datos EXIF crudos (claves más comunes) */
  exifFields?: Record<string, unknown>
  /** Ubicaciones GPS de las fotos */
  gpsLocations?: Array<{ lat: number; lon: number; alt?: number }>
  /** Texto para keywords PDF (formato compacto) */
  keywordsText?: string[]
  /** Texto para subject/descripción */
  subjectText?: string
}

/**
 * Extrae y agrega EXIF/cámara de todas las imágenes de una bitácora.
 * Incluye también ubicación inicial (startLocation) para que aparezca en Propiedades del documento.
 */
export function aggregateExifFromMountainLog(log: MountainLog): AggregatedExifData | null {
  const images = collectImagesFromLog(log)

  const cameraSummary: string[] = []
  const cameraSettings: AggregatedExifData['cameraSettings'] = []
  const exifFields: Record<string, unknown> = {}
  const gpsLocations: Array<{ lat: number; lon: number; alt?: number }> = []
  const keywordsText: string[] = []

  for (const img of images) {
    const { metadata } = img
    if (!metadata) continue

    // GPS
    if (metadata.gpsMetadata) {
      gpsLocations.push({
        lat: metadata.gpsMetadata.latitude,
        lon: metadata.gpsMetadata.longitude,
        alt: metadata.gpsMetadata.altitude,
      })
      keywordsText.push(
        `GPS:${metadata.gpsMetadata.latitude.toFixed(4)},${metadata.gpsMetadata.longitude.toFixed(4)}`
      )
    }

    // Camera settings
    if (metadata.cameraSettings) {
      const cs = metadata.cameraSettings
      cameraSettings.push({
        iso: cs.iso,
        aperture: cs.aperture,
        shutterSpeed: cs.shutterSpeed,
        focalLength: cs.focalLength,
        capturedAt: metadata.capturedAt,
      })
      if (cs.iso) keywordsText.push(`ISO:${cs.iso}`)
      if (cs.aperture) keywordsText.push(`f/${cs.aperture}`)
      if (cs.focalLength) keywordsText.push(`${cs.focalLength}mm`)
    }

    // EXIF adicional
    if (metadata.exifData && typeof metadata.exifData === 'object') {
      for (const [key, value] of Object.entries(metadata.exifData)) {
        if (value != null && value !== '' && !exifFields[key]) {
          exifFields[key] = value
        }
      }
    }
  }

  // Resumen de cámara (Make/Model si está en exif)
  const make = exifFields['Make'] as string | undefined
  const model = exifFields['Model'] as string | undefined
  if (make || model) {
    cameraSummary.push([make, model].filter(Boolean).join(' '))
  }

  // Incluir ubicación inicial (startLocation) para que aparezca en Propiedades del documento
  if (log.startLocation) {
    gpsLocations.push({
      lat: log.startLocation.latitude,
      lon: log.startLocation.longitude,
      alt: log.startLocation.altitude,
    })
    keywordsText.push(
      `Inicio:${log.startLocation.latitude.toFixed(4)},${log.startLocation.longitude.toFixed(4)}`
    )
  }

  if (
    cameraSummary.length === 0 &&
    cameraSettings.length === 0 &&
    Object.keys(exifFields).length === 0 &&
    gpsLocations.length === 0
  ) {
    return null
  }

  return {
    cameraSummary: cameraSummary.length ? cameraSummary : undefined,
    cameraSettings: cameraSettings.length ? cameraSettings : undefined,
    exifFields: Object.keys(exifFields).length ? exifFields : undefined,
    gpsLocations: gpsLocations.length ? gpsLocations : undefined,
    keywordsText: keywordsText.length ? [...new Set(keywordsText)] : undefined,
    subjectText:
      cameraSummary.length || cameraSettings.length
        ? `Cámara: ${cameraSummary.join('; ') || 'varios'}. ${cameraSettings.length} foto(s) con metadata.`
        : gpsLocations.length
          ? `Ubicación: ${gpsLocations.length} punto(s) GPS registrado(s).`
          : undefined,
  }
}

function collectImagesFromLog(log: MountainLog): MountainLogImage[] {
  const images: MountainLogImage[] = []
  if (log.milestones) {
    for (const m of log.milestones) {
      if (m.images?.length) images.push(...m.images)
    }
  }
  if (log.images?.length) images.push(...log.images)
  return images
}
