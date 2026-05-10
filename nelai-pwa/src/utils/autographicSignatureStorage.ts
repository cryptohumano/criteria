/**
 * Utilidades para almacenar y recuperar firmas autográficas asociadas a cuentas
 */

import { openSharedDB } from './indexedDB'

const STORE_NAME = 'autographic-signatures'

export interface AutographicSignature {
  accountAddress: string // Clave primaria (dirección SS58 de la cuenta)
  signatureImage: string // Base64 de la firma (PNG o SVG)
  createdAt: number
  updatedAt: number
}

/**
 * Guarda una firma autográfica para una cuenta
 */
export async function saveAutographicSignature(
  accountAddress: string,
  signatureImage: string
): Promise<void> {
  const db = await openSharedDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    throw new Error(`Object store '${STORE_NAME}' no existe`)
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const signature: AutographicSignature = {
      accountAddress,
      signatureImage,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const request = store.put(signature)

    request.onsuccess = () => {
      console.log(`[Autographic Signature Storage] ✅ Firma guardada para cuenta ${accountAddress}`)
      resolve()
    }

    request.onerror = () => {
      console.error(`[Autographic Signature Storage] ❌ Error al guardar firma:`, request.error)
      reject(request.error)
    }
  })
}

/**
 * Obtiene la firma autográfica de una cuenta
 */
export async function getAutographicSignature(
  accountAddress: string
): Promise<AutographicSignature | null> {
  const db = await openSharedDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Autographic Signature Storage] ⚠️ Object store '${STORE_NAME}' no existe`)
    return null
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(accountAddress)

    request.onsuccess = () => {
      const result = request.result as AutographicSignature | undefined
      resolve(result || null)
    }

    request.onerror = () => {
      console.error(`[Autographic Signature Storage] ❌ Error al obtener firma:`, request.error)
      reject(request.error)
    }
  })
}

/**
 * Elimina la firma autográfica de una cuenta
 */
export async function deleteAutographicSignature(
  accountAddress: string
): Promise<void> {
  const db = await openSharedDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    throw new Error(`Object store '${STORE_NAME}' no existe`)
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(accountAddress)

    request.onsuccess = () => {
      console.log(`[Autographic Signature Storage] ✅ Firma eliminada para cuenta ${accountAddress}`)
      resolve()
    }

    request.onerror = () => {
      console.error(`[Autographic Signature Storage] ❌ Error al eliminar firma:`, request.error)
      reject(request.error)
    }
  })
}

/**
 * Obtiene todas las firmas autográficas
 */
export async function getAllAutographicSignatures(): Promise<AutographicSignature[]> {
  const db = await openSharedDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Autographic Signature Storage] ⚠️ Object store '${STORE_NAME}' no existe`)
    return []
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const results = request.result as AutographicSignature[]
      resolve(results)
    }

    request.onerror = () => {
      console.error(`[Autographic Signature Storage] ❌ Error al obtener todas las firmas:`, request.error)
      reject(request.error)
    }
  })
}
