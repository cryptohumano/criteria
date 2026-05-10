/**
 * Servicio para encriptar y desencriptar documentos
 */

import type { Document, EncryptionMetadata } from '@/types/documents'
import { updateDocument } from '@/utils/documentStorage'
import { calculatePDFHash } from '@/services/pdf/PDFHash'

/**
 * Deriva una clave de encriptación usando PBKDF2
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Convierte hex string a Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16)
  }
  return bytes
}

/**
 * Convierte Uint8Array a hex string
 */
function uint8ArrayToHex(uint8Array: Uint8Array): string {
  return Array.from(uint8Array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convierte base64 a Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Convierte Uint8Array a base64
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return btoa(binary)
}

/**
 * Encripta un documento PDF con AES-GCM-256
 */
export async function encryptDocument(
  document: Document,
  password: string
): Promise<Document> {
  if (!document.pdf) {
    throw new Error('El documento no tiene PDF para encriptar')
  }

  if (document.encrypted) {
    throw new Error('El documento ya está encriptado')
  }

  // Generar salt aleatorio
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 100000

  // Derivar clave
  const key = await deriveKey(password, salt, iterations)

  // Generar IV aleatorio
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Convertir PDF a Uint8Array
  const pdfBytes = base64ToUint8Array(document.pdf)

  // Encriptar
  const encryptedBytes = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    pdfBytes
  )

  // Convertir a base64
  const encryptedPDF = uint8ArrayToBase64(new Uint8Array(encryptedBytes))

  // Calcular hash del PDF encriptado
  const encryptedHash = await calculatePDFHash(encryptedPDF)

  // Crear metadata de encriptación
  const encryptionMetadata: EncryptionMetadata = {
    iv: uint8ArrayToHex(iv),
    salt: uint8ArrayToHex(salt),
    iterations,
    keyDerivationMethod: 'PBKDF2',
  }

  // Actualizar documento
  const updatedDocument: Document = {
    ...document,
    pdf: encryptedPDF,
    pdfHash: encryptedHash,
    pdfSize: encryptedBytes.byteLength,
    encrypted: true,
    encryptionMethod: 'AES-GCM-256',
    encryptionMetadata,
    updatedAt: Date.now(),
  }

  // Guardar en IndexedDB
  await updateDocument(document.documentId, updatedDocument)

  return updatedDocument
}

/**
 * Desencripta un documento PDF
 */
export async function decryptDocument(
  document: Document,
  password: string
): Promise<Document> {
  if (!document.encrypted || !document.encryptionMetadata) {
    throw new Error('El documento no está encriptado')
  }

  if (!document.pdf) {
    throw new Error('El documento no tiene PDF')
  }

  const { iv, salt, iterations } = document.encryptionMetadata

  // Derivar clave
  const key = await deriveKey(password, hexToUint8Array(salt), iterations)

  // Convertir PDF encriptado a Uint8Array
  const encryptedBytes = base64ToUint8Array(document.pdf)

  // Desencriptar
  try {
    const decryptedBytes = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: hexToUint8Array(iv),
      },
      key,
      encryptedBytes
    )

    // Convertir a base64
    const decryptedPDF = uint8ArrayToBase64(new Uint8Array(decryptedBytes))

    // Calcular hash del PDF desencriptado
    const decryptedHash = await calculatePDFHash(decryptedPDF)

    // Actualizar documento (mantener metadata de encriptación para referencia)
    const updatedDocument: Document = {
      ...document,
      pdf: decryptedPDF,
      pdfHash: decryptedHash,
      pdfSize: decryptedBytes.byteLength,
      encrypted: false, // Marcar como desencriptado
      updatedAt: Date.now(),
    }

    // Guardar en IndexedDB
    await updateDocument(document.documentId, updatedDocument)

    return updatedDocument
  } catch (error) {
    if (error instanceof Error && error.name === 'OperationError') {
      throw new Error('Contraseña incorrecta')
    }
    throw error
  }
}

