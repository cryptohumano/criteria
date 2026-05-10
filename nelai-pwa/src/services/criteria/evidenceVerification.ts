/**
 * Módulo CriterIA: verificación de metadata firmada (genérico).
 * Verifica integridad del contenido y validez de la firma Polkadot.
 */

import { signatureVerify } from '@polkadot/util-crypto'

export interface VerificationResult {
  integrityValid: boolean
  signatureValid: boolean
  valid: boolean
  report: string
  signer?: string
  createdAt?: string
}

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

function canonicalizeMetadata(metadata: Record<string, unknown>): string {
  const ordered: Record<string, unknown> = {}
  const keys = Object.keys(metadata).sort()
  for (const k of keys) {
    const v = metadata[k]
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
 * Verifica una evidencia firmada: integridad del contenido y firma Polkadot.
 */
export async function verifyEvidence(
  blobOrBase64: ArrayBuffer | string,
  signedMetadata: { metadata: Record<string, unknown>; signature: string; signer: string }
): Promise<VerificationResult> {
  const { metadata, signature, signer } = signedMetadata

  const contentHashFromMeta = metadata?.contentHash
  if (!contentHashFromMeta || typeof contentHashFromMeta !== 'string') {
    return {
      integrityValid: false,
      signatureValid: false,
      valid: false,
      report: 'La metadata no contiene contentHash. No se puede verificar la integridad.',
    }
  }

  const createdAt = typeof metadata?.createdAt === 'string' ? metadata.createdAt : undefined

  // 1. Integridad: comparar hash del contenido
  const computedHash = await sha256Hex(blobOrBase64)
  const integrityValid =
    computedHash.toLowerCase() === String(contentHashFromMeta).toLowerCase()

  // 2. Firma: reconstruir payload canónico y verificar
  let signatureValid = false
  try {
    const canonical = canonicalizeMetadata(metadata as Record<string, unknown>)
    const payloadHash = await sha256Hex(new TextEncoder().encode(canonical))
    const hashBytes = hexToUint8Array(payloadHash)
    const sigHex = signature.startsWith('0x') ? signature : `0x${signature}`
    const { isValid } = signatureVerify(hashBytes, sigHex, signer)
    signatureValid = isValid
  } catch (err) {
    console.warn('[verifyEvidence] Error al verificar firma:', err)
  }

  const valid = integrityValid && signatureValid

  // Reporte por plantillas
  let report: string
  if (valid) {
    report = `Firmado por la cuenta **${signer}**. Integridad del contenido: **válida**. Firma: **válida**.`
  } else if (!integrityValid && !signatureValid) {
    report = `Integridad del contenido: **no válida** (el archivo fue modificado). Firma: **no válida**. No se puede confirmar la procedencia.`
  } else if (!integrityValid) {
    report = `Integridad del contenido: **no válida** (el archivo fue modificado después de la firma). Firma: ${signatureValid ? 'válida' : 'no válida'}.`
  } else {
    report = `Integridad del contenido: **válida**. Firma: **no válida** (la firma no coincide con la cuenta indicada).`
  }

  return {
    integrityValid,
    signatureValid,
    valid,
    report,
    signer,
    createdAt,
  }
}
