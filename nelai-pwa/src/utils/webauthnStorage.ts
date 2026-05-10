/**
 * Almacenamiento de credenciales WebAuthn en IndexedDB
 */

import type { WebAuthnCredential } from './webauthn'
import { openSharedDB } from './indexedDB'

const STORE_NAME = 'webauthn-credentials'

async function openDB(): Promise<IDBDatabase> {
  console.log('[WebAuthn Storage] Abriendo base de datos compartida...')
  const db = await openSharedDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const error = new Error(`El store '${STORE_NAME}' no existe en la base de datos`)
    console.error('[WebAuthn Storage] ❌', error.message)
    console.error('[WebAuthn Storage] Stores disponibles:', Array.from(db.objectStoreNames))
    throw error
  }
  
  console.log(`[WebAuthn Storage] ✅ Store '${STORE_NAME}' verificado y disponible`)
  return db
}

/**
 * Guarda una credencial WebAuthn
 */
export async function saveWebAuthnCredential(credential: WebAuthnCredential): Promise<void> {
  console.log(`[WebAuthn Storage] Intentando guardar credencial:`, {
    id: credential.id,
    name: credential.name,
    hasPublicKey: !!credential.publicKey,
    hasMasterKeySalt: !!credential.masterKeySalt,
    counter: credential.counter,
    createdAt: credential.createdAt
  })
  
  const db = await openDB()
  
  // Verificar que el store existe antes de intentar guardar
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const error = new Error(`El store '${STORE_NAME}' no existe en la base de datos`)
    console.error('[WebAuthn Storage] ❌', error.message)
    throw error
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    console.log('[WebAuthn Storage] Transacción iniciada, guardando credencial...')
    const request = store.put(credential)

    request.onsuccess = () => {
      console.log(`[WebAuthn Storage] ✅ Request exitoso para credencial: ${credential.id}`)
      console.log('[WebAuthn Storage] Resultado de la operación:', request.result)
      // NO resolver aquí, esperar a que la transacción se complete
    }
    request.onerror = () => {
      const error = request.error || new Error('Error desconocido al guardar')
      console.error(`[WebAuthn Storage] ❌ Error en el request:`, error)
      console.error('[WebAuthn Storage] Detalles del error:', {
        name: error.name,
        message: error.message,
        code: (error as any).code
      })
      reject(error)
    }
    
    transaction.oncomplete = () => {
      console.log('[WebAuthn Storage] ✅ Transacción completada exitosamente')
      console.log(`[WebAuthn Storage] ✅ Credencial guardada: ${credential.id}`)
      resolve()
    }
    
    transaction.onerror = () => {
      const error = transaction.error || new Error('Error desconocido en la transacción')
      console.error('[WebAuthn Storage] ❌ Error en la transacción:', error)
      console.error('[WebAuthn Storage] Detalles del error:', {
        name: error.name,
        message: error.message,
        code: (error as any).code
      })
      reject(error)
    }
    
    transaction.onabort = () => {
      const error = new Error('Transacción abortada')
      console.error('[WebAuthn Storage] ❌ Transacción abortada')
      reject(error)
    }
  })
}

/**
 * Obtiene una credencial WebAuthn por ID
 */
export async function getWebAuthnCredential(credentialId: string): Promise<WebAuthnCredential | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(credentialId)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene todas las credenciales WebAuthn
 */
export async function getAllWebAuthnCredentials(): Promise<WebAuthnCredential[]> {
  console.log('[WebAuthn Storage] Obteniendo todas las credenciales...')
  const db = await openDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[WebAuthn Storage] ⚠️ El store '${STORE_NAME}' no existe`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const credentials = request.result || []
      console.log(`[WebAuthn Storage] ✅ ${credentials.length} credencial(es) encontrada(s)`)
      if (credentials.length > 0) {
        console.log('[WebAuthn Storage] Credenciales:', credentials.map(c => ({
          id: c.id,
          name: c.name,
          createdAt: new Date(c.createdAt).toISOString()
        })))
      }
      resolve(credentials)
    }
    request.onerror = () => {
      const error = request.error || new Error('Error desconocido')
      console.error('[WebAuthn Storage] ❌ Error al obtener credenciales:', error)
      reject(error)
    }
  })
}

/**
 * Elimina una credencial WebAuthn
 */
export async function deleteWebAuthnCredential(credentialId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(credentialId)

    request.onsuccess = () => {
      console.log(`[WebAuthn Storage] ✅ Credencial eliminada: ${credentialId}`)
      resolve()
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Actualiza el contador y última fecha de uso de una credencial
 */
export async function updateWebAuthnCredentialUsage(credentialId: string): Promise<void> {
  const credential = await getWebAuthnCredential(credentialId)
  if (!credential) {
    throw new Error('Credencial no encontrada')
  }

  credential.counter++
  credential.lastUsedAt = Date.now()

  await saveWebAuthnCredential(credential)
}

