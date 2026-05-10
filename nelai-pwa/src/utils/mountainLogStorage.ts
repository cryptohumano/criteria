/**
 * Utilidades para almacenar y gestionar bitácoras de montañismo en IndexedDB
 */

import { openSharedDB } from './indexedDB'
import type { MountainLog, MountainLogStatus } from '@/types/mountainLogs'

const STORE_NAME = 'mountain-logs'

async function openDB(): Promise<IDBDatabase> {
  return await openSharedDB()
}

/**
 * Guarda una bitácora de montañismo en IndexedDB
 */
export async function saveMountainLog(log: MountainLog): Promise<void> {
  console.log(`[Mountain Log Storage] Guardando bitácora: ${log.logId}`)
  
  if (!log.logId) {
    throw new Error('logId es requerido')
  }

  const db = await openDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const error = new Error(`Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada. Por favor, recarga la página.`)
    console.error(`[Mountain Log Storage] ❌ ${error.message}`)
    throw error
  }
  
  // Asegurar que milestones existe
  if (!log.milestones) {
    log.milestones = []
  }
  
  // Actualizar timestamp de actualización
  const logToSave = {
    ...log,
    updatedAt: Date.now()
  }
  
  return new Promise((resolve, reject) => {
    const dbTransaction = db.transaction([STORE_NAME], 'readwrite')
    const store = dbTransaction.objectStore(STORE_NAME)
    const request = store.put(logToSave)

    request.onsuccess = () => {
      console.log(`[Mountain Log Storage] ✅ Request de guardado exitoso para: ${log.logId}`)
    }
    
    request.onerror = () => {
      console.error(`[Mountain Log Storage] ❌ Error al guardar bitácora ${log.logId}:`, request.error)
      reject(request.error)
    }

    dbTransaction.oncomplete = () => {
      console.log(`[Mountain Log Storage] ✅ Transacción completada - Bitácora guardada: ${log.logId}`)
      resolve()
    }
    
    dbTransaction.onerror = () => {
      const error = dbTransaction.error || request.error || new Error('Error en la transacción')
      console.error(`[Mountain Log Storage] ❌ Error en transacción al guardar: ${log.logId}:`, error)
      reject(error)
    }
  })
}

/**
 * Obtiene una bitácora por ID
 */
export async function getMountainLog(logId: string): Promise<MountainLog | null> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Mountain Log Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return null
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(logId)

    request.onsuccess = () => {
      const result = request.result
      if (result && !result.milestones) {
        result.milestones = []
      }
      resolve(result || null)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene todas las bitácoras
 */
export async function getAllMountainLogs(): Promise<MountainLog[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Mountain Log Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const logs = request.result || []
      // Asegurar que todas las bitácoras tengan milestones
      logs.forEach(log => {
        if (!log.milestones) {
          log.milestones = []
        }
      })
      logs.sort((a, b) => b.createdAt - a.createdAt)
      resolve(logs)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene bitácoras por estado
 */
export async function getMountainLogsByStatus(status: MountainLogStatus): Promise<MountainLog[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Mountain Log Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byStatus')
    const request = index.getAll(status)

    request.onsuccess = () => {
      const logs = request.result || []
      // Asegurar que todas las bitácoras tengan milestones
      logs.forEach(log => {
        if (!log.milestones) {
          log.milestones = []
        }
      })
      logs.sort((a, b) => b.createdAt - a.createdAt)
      resolve(logs)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene bitácoras por cuenta
 */
export async function getMountainLogsByAccount(accountAddress: string): Promise<MountainLog[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Mountain Log Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byAccount')
    const request = index.getAll(accountAddress)

    request.onsuccess = () => {
      const logs = request.result || []
      // Asegurar que todas las bitácoras tengan milestones
      logs.forEach(log => {
        if (!log.milestones) {
          log.milestones = []
        }
      })
      logs.sort((a, b) => b.createdAt - a.createdAt)
      resolve(logs)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Elimina una bitácora
 */
export async function deleteMountainLog(logId: string): Promise<void> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    throw new Error(`Object store '${STORE_NAME}' no existe.`)
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(logId)

    request.onsuccess = () => {
      console.log(`[Mountain Log Storage] ✅ Bitácora eliminada: ${logId}`)
      resolve()
    }
    request.onerror = () => {
      console.error(`[Mountain Log Storage] ❌ Error al eliminar bitácora ${logId}:`, request.error)
      reject(request.error)
    }
  })
}

/**
 * Actualiza el estado de una bitácora
 */
export async function updateMountainLogStatus(
  logId: string, 
  status: MountainLogStatus,
  endDate?: number
): Promise<void> {
  const log = await getMountainLog(logId)
  if (!log) {
    throw new Error(`Bitácora ${logId} no encontrada`)
  }

  // Si se está finalizando, actualizar fecha de fin
  if (status === 'completed' && !log.endDate) {
    log.endDate = endDate || Date.now()
  }

  log.status = status
  await saveMountainLog(log)
}
