/**
 * Cliente para el servicio C2PA que embebe manifiestos en PDFs.
 * Requiere que el servidor c2pa-sign esté corriendo (yarn c2pa-server).
 * Si el servidor exige sesión (`C2PA_REQUIRE_AUTH` en producción), se envía el Bearer de la sesión workspace.
 */
import { readWorkspaceSession } from '@/services/workspace/sessionStorage'

const C2PA_API_URL =
  import.meta.env.VITE_C2PA_API_URL || 'http://localhost:3456'

function c2paSignHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const session = readWorkspaceSession()
  if (session?.accessToken) {
    h.Authorization = `Bearer ${session.accessToken}`
  }
  return h
}

export interface C2paSignMetadata {
  contentHash: string
  author: string
  signature: string
  createdAt: string
  title?: string
  documentId?: string
  claimGenerator?: string
  /** EXIF/cámara de imágenes (bitácoras) para Content Credentials */
  exifData?: {
    cameraSummary?: string[]
    cameraSettings?: Array<{ iso?: number; aperture?: string; shutterSpeed?: string; focalLength?: string; capturedAt?: number }>
    exifFields?: Record<string, unknown>
    gpsLocations?: Array<{ lat: number; lon: number; alt?: number }>
  }
}

export interface C2paSignResult {
  pdfBase64: string
  success: boolean
}

/**
 * Verifica si el servicio C2PA está disponible.
 */
export async function checkC2paAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${C2PA_API_URL}/api/c2pa-health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    })
    const data = await res.json()
    return data?.ok === true && data?.c2pa === true
  } catch {
    return false
  }
}

/**
 * Envía un PDF al servicio C2PA para embeber el manifiesto.
 * Retorna el PDF firmado con Content Credentials o null si falla.
 */
export async function embedC2paManifest(
  pdfBase64: string,
  metadata: C2paSignMetadata
): Promise<string | null> {
  try {
    const res = await fetch(`${C2PA_API_URL}/api/c2pa-sign`, {
      method: 'POST',
      headers: c2paSignHeaders(),
      body: JSON.stringify({ pdfBase64, metadata }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('[C2PA] Error al embeber manifiesto:', err?.error || res.statusText)
      return null
    }

    const data: C2paSignResult = await res.json()
    return data?.success && data?.pdfBase64 ? data.pdfBase64 : null
  } catch (err) {
    console.warn('[C2PA] No se pudo conectar al servicio:', err)
    return null
  }
}
