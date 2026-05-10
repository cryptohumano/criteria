/**
 * Almacenamiento de emergencias en IndexedDB
 */

import { openSharedDB } from './indexedDB'
import type { Emergency } from '@/types/emergencies'

const STORE_NAME = 'emergencies'

async function openDB(): Promise<IDBDatabase> {
  return await openSharedDB()
}

/**
 * Guarda una emergencia en IndexedDB
 */
export async function saveEmergency(emergency: Emergency): Promise<void> {
  console.log(`[Emergency Storage] Guardando emergencia: ${emergency.emergencyId}`)
  
  if (!emergency.emergencyId) {
    throw new Error('emergencyId es requerido')
  }

  const db = await openDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const error = new Error(`Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada. Por favor, recarga la página.`)
    console.error(`[Emergency Storage] ❌ ${error.message}`)
    throw error
  }
  
  // Crear una copia limpia del objeto para evitar problemas de serialización
  const cleanEmergency: Emergency = {
    ...emergency,
    updatedAt: Date.now(),
  }
  
  return new Promise((resolve, reject) => {
    const dbTransaction = db.transaction([STORE_NAME], 'readwrite')
    const store = dbTransaction.objectStore(STORE_NAME)
    const request = store.put(cleanEmergency)

    request.onsuccess = () => {
      console.log(`[Emergency Storage] ✅ Request de guardado exitoso para: ${emergency.emergencyId}`)
    }
    
    request.onerror = () => {
      console.error(`[Emergency Storage] ❌ Error al guardar emergencia ${emergency.emergencyId}:`, request.error)
      reject(request.error)
    }

    dbTransaction.oncomplete = () => {
      console.log(`[Emergency Storage] ✅ Transacción completada - Emergencia guardada: ${emergency.emergencyId}`)
      resolve()
    }
    
    dbTransaction.onerror = () => {
      const error = dbTransaction.error || request.error || new Error('Error en la transacción')
      console.error(`[Emergency Storage] ❌ Error en transacción al guardar: ${emergency.emergencyId}:`, error)
      reject(error)
    }
  })
}

/**
 * Obtiene una emergencia por ID
 */
export async function getEmergency(emergencyId: string): Promise<Emergency | null> {
  const db = await openDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Emergency Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return null
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(emergencyId)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene todas las emergencias
 */
export async function getAllEmergencies(): Promise<Emergency[]> {
  console.log('[Emergency Storage] Obteniendo todas las emergencias...')
  const db = await openDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Emergency Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const emergencies = request.result || []
      // Ordenar por fecha de creación (más recientes primero)
      emergencies.sort((a, b) => b.createdAt - a.createdAt)
      console.log(`[Emergency Storage] ✅ ${emergencies.length} emergencia(s) encontrada(s)`)
      resolve(emergencies)
    }
    request.onerror = () => {
      console.error('[Emergency Storage] ❌ Error al obtener emergencias:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Obtiene emergencias por cuenta
 */
export async function getEmergenciesByAccount(accountAddress: string): Promise<Emergency[]> {
  console.log(`[Emergency Storage] Obteniendo emergencias para cuenta: ${accountAddress}`)
  const db = await openDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Emergency Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byAccount')
    const request = index.getAll(accountAddress)

    request.onsuccess = () => {
      const emergencies = request.result || []
      emergencies.sort((a, b) => b.createdAt - a.createdAt)
      console.log(`[Emergency Storage] ✅ ${emergencies.length} emergencia(s) encontrada(s)`)
      resolve(emergencies)
    }
    request.onerror = () => {
      console.error('[Emergency Storage] ❌ Error al obtener emergencias:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Obtiene emergencias por bitácora
 */
export async function getEmergenciesByLogId(logId: string): Promise<Emergency[]> {
  console.log(`[Emergency Storage] Obteniendo emergencias para bitácora: ${logId}`)
  const db = await openDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Emergency Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byRelatedLogId')
    const request = index.getAll(logId)

    request.onsuccess = () => {
      const emergencies = request.result || []
      emergencies.sort((a, b) => b.createdAt - a.createdAt)
      console.log(`[Emergency Storage] ✅ ${emergencies.length} emergencia(s) encontrada(s)`)
      resolve(emergencies)
    }
    request.onerror = () => {
      console.error('[Emergency Storage] ❌ Error al obtener emergencias:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Obtiene emergencias por estado
 */
export async function getEmergenciesByStatus(status: Emergency['status']): Promise<Emergency[]> {
  const db = await openDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Emergency Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byStatus')
    const request = index.getAll(status)

    request.onsuccess = () => {
      const emergencies = request.result || []
      emergencies.sort((a, b) => b.createdAt - a.createdAt)
      resolve(emergencies)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene emergencias pendientes de sincronización
 */
export async function getPendingEmergencies(): Promise<Emergency[]> {
  return getEmergenciesByStatus('pending')
}

/**
 * Actualiza una emergencia
 */
export async function updateEmergency(emergency: Emergency): Promise<void> {
  return saveEmergency(emergency)
}

/**
 * Elimina una emergencia
 */
export async function deleteEmergency(emergencyId: string): Promise<void> {
  const db = await openDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const error = new Error(`Object store '${STORE_NAME}' no existe.`)
    console.error(`[Emergency Storage] ❌ ${error.message}`)
    throw error
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(emergencyId)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
