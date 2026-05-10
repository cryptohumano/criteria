/**
 * Módulo CriterIA: firma de metadata para evidencias (genérico).
 * Capa de procedencia y autenticidad; mapeable a C2PA + assertion org.nelai.polkadot (legacy) / org.criteria.polkadot (futuro).
 */

import type { KeyringPair } from '@polkadot/keyring/types'
import { u8aToHex } from '@polkadot/util'

/** Metadata canónica que se firma; alineada con SCHEMA_METADATA_FIRMA y C2PA */
export interface CanonicalEvidenceMetadata {
  version: string
  type: 'photo' | 'document' | 'log_entry' | 'file' | 'departure_notice' | 'emergency'
  contentHash: string
  createdAt: string // ISO8601
  author: string // ss58 o DID
  mimeType: string
  filename: string
  geolocation?: { lat: number; lon: number; alt?: number }
  relatedIds?: string[]
}

/** Resultado de firmar una evidencia */
export interface EvidenceSigningResult {
  contentHash: string
  signedMetadata: {
    metadata: CanonicalEvidenceMetadata
    signature: string
    signer: string
  }
}

export interface SignEvidenceOptions {
  type?: CanonicalEvidenceMetadata['type']
  filename?: string
  mimeType?: string
  relatedIds?: string[]
  geolocation?: { lat: number; lon: number; alt?: number }
}

/**
 * Calcula SHA-256 del contenido y devuelve hex con prefijo 0x.
 */
async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  let buffer: ArrayBuffer
  if (typeof data === 'string') {
    const base64Data = data.includes(',') ? data.split(',')[1] : data
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    buffer = bytes.buffer
  } else {
    buffer = data
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `0x${hashHex}`
}

/**
 * Serializa metadata en forma canónica (claves ordenadas alfabéticamente, sin espacios).
 */
function canonicalizeMetadata(metadata: CanonicalEvidenceMetadata): string {
  const ordered: Record<string, unknown> = {}
  const keys = Object.keys(metadata).sort()
  for (const k of keys) {
    const v = metadata[k as keyof CanonicalEvidenceMetadata]
    if (v !== undefined) ordered[k] = v
  }
  return JSON.stringify(ordered)
}

function hexToUint8Array(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * Firma la metadata de una evidencia con la cuenta Polkadot.
 * Genérico: sirve para fotos, archivos, etc.; no depende del dominio (bitácora/documento).
 *
 * @param blobOrBase64 - Contenido del archivo (data URL base64 o ArrayBuffer)
 * @param authorAddress - Dirección SS58 del autor (firmante)
 * @param keyringPair - Par de llaves Polkadot para firmar
 * @param options - type, relatedIds, geolocation
 */
export async function signEvidenceMetadata(
  blobOrBase64: ArrayBuffer | string,
  authorAddress: string,
  keyringPair: KeyringPair,
  options: SignEvidenceOptions = {}
): Promise<EvidenceSigningResult> {
  const { type = 'photo', relatedIds, geolocation } = options

  const contentHash = await sha256Hex(blobOrBase64)
  const createdAt = new Date().toISOString()

  const metadata: CanonicalEvidenceMetadata = {
    version: '1',
    type,
    contentHash,
    createdAt,
    author: authorAddress,
    mimeType: options.mimeType ?? 'image/jpeg',
    filename: options.filename ?? `evidence-${Date.now()}`,
    ...(geolocation && { geolocation }),
    ...(relatedIds && relatedIds.length > 0 && { relatedIds }),
  }

  const canonical = canonicalizeMetadata(metadata)
  const payloadHash = await sha256Hex(new TextEncoder().encode(canonical))
  const hashBytes = hexToUint8Array(payloadHash)
  const signature = keyringPair.sign(hashBytes)
  const signatureHex = u8aToHex(signature)

  return {
    contentHash,
    signedMetadata: {
      metadata,
      signature: signatureHex,
      signer: keyringPair.address,
    },
  }
}
