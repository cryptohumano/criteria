/**
 * Lectura de manifiestos C2PA embebidos en archivos.
 * Usa @contentauth/c2pa-web para parsear Content Credentials.
 */

import { createC2pa } from '@contentauth/c2pa-web'

let c2paInstance: Awaited<ReturnType<typeof createC2pa>> | null = null

async function getC2pa() {
  if (c2paInstance) return c2paInstance
  try {
    const wasmSrc = 'https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@0.6.1/dist/resources/c2pa_bg.wasm'
    c2paInstance = await createC2pa({ wasmSrc })
    return c2paInstance
  } catch (err) {
    console.warn('[C2PA Reader] No se pudo inicializar:', err)
    return null
  }
}

export interface C2paManifestInfo {
  hasManifest: boolean
  title?: string
  claimGenerator?: string
  assertions?: Array<{ label: string; data?: unknown }>
  polkadotAssertion?: {
    address?: string
    signature?: string
    contentHash?: string
    createdAt?: string
    title?: string
    documentId?: string
  }
  validationStatus?: string
}

/**
 * Lee el manifiesto C2PA de un archivo (PDF, JPEG, etc.).
 * Retorna null si no hay manifiesto o no se puede leer.
 */
export async function readC2paManifest(
  blob: Blob
): Promise<C2paManifestInfo | null> {
  try {
    const c2pa = await getC2pa()
    if (!c2pa) return null

    const reader = await c2pa.reader.fromBlob(blob.type, blob)
    const manifestStore = await reader.manifestStore()
    await reader.free()

    if (!manifestStore?.active_manifest) {
      return { hasManifest: false }
    }

    const active = manifestStore.active_manifest
    const assertions = active.assertions || []

    const polkadotAssertion = assertions.find(
      (a: { label?: string }) => a.label === 'org.nelai.polkadot'
    ) as { data?: Record<string, unknown> } | undefined

    return {
      hasManifest: true,
      title: active.title,
      claimGenerator: active.claim_generator,
      assertions: assertions.map((a: { label?: string; data?: unknown }) => ({
        label: a.label || '',
        data: a.data,
      })),
      polkadotAssertion: polkadotAssertion?.data as C2paManifestInfo['polkadotAssertion'],
      validationStatus: manifestStore.validation_status?.[0]?.code,
    }
  } catch (err) {
    console.warn('[C2PA Reader] Error al leer:', err)
    return null
  }
}
