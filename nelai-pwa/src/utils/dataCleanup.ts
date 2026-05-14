/**
 * Utilidades para limpiar todos los datos de la aplicación
 * Incluye IndexedDB, localStorage y otros datos almacenados localmente
 */

import {
  closeSharedDB,
  deleteDatabase as deleteSharedKeyringDatabase,
  drainOpenPromiseAndCloseSharedDb,
} from './indexedDB'

const KEYRING_DB_NAME = 'pwa-substrate-keyring'

/** Elimina una IndexedDB por nombre con espera ante `blocked` (otras pestañas / transacciones). */
async function deleteIndexedDbByName(dbName: string): Promise<void> {
  const maxAttempts = 12
  const waitMs = 10_000
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const r = indexedDB.deleteDatabase(dbName)
        const t = setTimeout(() => reject(new Error('blocked-timeout')), waitMs)
        r.onsuccess = () => {
          clearTimeout(t)
          resolve()
        }
        r.onerror = () => {
          clearTimeout(t)
          reject(r.error || new Error(`Error al eliminar ${dbName}`))
        }
        r.onblocked = () => {
          console.warn(
            `[Data Cleanup] ⚠️ "${dbName}" bloqueada (${attempt}/${maxAttempts}). Cierra otras pestañas o espera…`,
          )
        }
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg !== 'blocked-timeout') {
        throw e instanceof Error ? e : new Error(msg)
      }
      if (attempt === maxAttempts) {
        throw new Error(
          `No se pudo eliminar IndexedDB "${dbName}". Cierra todas las pestañas de criterIA y vuelve a intentar.`,
        )
      }
      await new Promise((res) => setTimeout(res, 300 + attempt * 80))
      continue
    }
    try {
      const databases = await indexedDB.databases()
      if (!databases.some((d) => d.name === dbName)) {
        console.log(`[Data Cleanup] ✅ Base de datos eliminada: ${dbName}`)
        return
      }
    } catch {
      return
    }
  }
}

// Claves de localStorage que deben eliminarse
const LOCAL_STORAGE_KEYS = [
  'aura-wallet-contacts',
  'aura-wallet-api-configs',
  // Agregar otras claves de localStorage aquí
]

/**
 * Elimina todas las bases de datos de IndexedDB relacionadas con la aplicación
 */
export async function deleteAllDatabases(): Promise<void> {
  if (!('indexedDB' in window)) {
    throw new Error('IndexedDB no está disponible')
  }

  closeSharedDB()
  await drainOpenPromiseAndCloseSharedDb()

  try {
    // 1) Keyring: misma BD que `openSharedDB`; usar rutina que drena promesas y reintenta `blocked`
    await deleteSharedKeyringDatabase()

    // 2) Otras BD de la app (p. ej. aura-wallet)
    const databases = await indexedDB.databases()
    const appDatabases = databases.filter(
      (db) =>
        db.name &&
        db.name !== KEYRING_DB_NAME &&
        (db.name.includes('pwa-substrate') || db.name.includes('aura-wallet')),
    )

    console.log(`[Data Cleanup] Eliminando ${appDatabases.length} base(s) de datos adicionales…`)

    for (const db of appDatabases) {
      if (!db.name) continue
      await deleteIndexedDbByName(db.name)
    }

    console.log('[Data Cleanup] ✅ Todas las bases de datos eliminadas')
  } catch (error) {
    console.error('[Data Cleanup] ❌ Error al eliminar bases de datos:', error)
    throw error
  }
}

/**
 * Elimina todos los datos de localStorage relacionados con la aplicación
 */
export function clearLocalStorage(): void {
  console.log('[Data Cleanup] Limpiando localStorage...')
  
  LOCAL_STORAGE_KEYS.forEach(key => {
    try {
      localStorage.removeItem(key)
      console.log(`[Data Cleanup] ✅ localStorage eliminado: ${key}`)
    } catch (error) {
      console.error(`[Data Cleanup] ❌ Error al eliminar ${key}:`, error)
    }
  })

  // También eliminar cualquier clave que empiece con nuestro prefijo
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('aura-wallet-') || key.startsWith('pwa-substrate-'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`[Data Cleanup] ✅ localStorage eliminado: ${key}`)
    })
  } catch (error) {
    console.error('[Data Cleanup] ❌ Error al limpiar localStorage:', error)
  }

  console.log('[Data Cleanup] ✅ localStorage limpiado')
}

/**
 * Elimina todos los datos de sessionStorage relacionados con la aplicación
 */
export function clearSessionStorage(): void {
  console.log('[Data Cleanup] Limpiando sessionStorage...')
  
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (key.startsWith('aura-wallet-') || key.startsWith('pwa-substrate-'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key)
      console.log(`[Data Cleanup] ✅ sessionStorage eliminado: ${key}`)
    })
  } catch (error) {
    console.error('[Data Cleanup] ❌ Error al limpiar sessionStorage:', error)
  }

  console.log('[Data Cleanup] ✅ sessionStorage limpiado')
}

/**
 * Elimina TODOS los datos de la aplicación (IndexedDB, localStorage, sessionStorage)
 * ⚠️ ADVERTENCIA: Esta operación es IRREVERSIBLE
 */
export async function deleteAllAppData(): Promise<void> {
  console.warn('[Data Cleanup] ⚠️ INICIANDO ELIMINACIÓN COMPLETA DE DATOS')
  console.warn('[Data Cleanup] ⚠️ Esta operación es IRREVERSIBLE')

  try {
    // 1. Cerrar todas las conexiones
    closeSharedDB()

    // 2. Eliminar IndexedDB
    await deleteAllDatabases()

    // 3. Limpiar localStorage
    clearLocalStorage()

    // 4. Limpiar sessionStorage
    clearSessionStorage()

    console.log('[Data Cleanup] ✅ Todos los datos eliminados exitosamente')
  } catch (error) {
    console.error('[Data Cleanup] ❌ Error durante la limpieza:', error)
    throw error
  }
}

/**
 * Obtiene información sobre los datos almacenados
 */
export async function getStorageInfo(): Promise<{
  databases: Array<{ name: string; version: number }>
  localStorageKeys: string[]
  sessionStorageKeys: string[]
  totalSize?: number
}> {
  const databases = await indexedDB.databases()
  const appDatabases = databases.filter(db => 
    db.name && (
      db.name.includes('pwa-substrate') ||
      db.name.includes('aura-wallet') ||
      db.name === 'pwa-substrate-keyring'
    )
  )

  const localStorageKeys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('aura-wallet-') || key.startsWith('pwa-substrate-'))) {
      localStorageKeys.push(key)
    }
  }

  const sessionStorageKeys: string[] = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)
    if (key && (key.startsWith('aura-wallet-') || key.startsWith('pwa-substrate-'))) {
      sessionStorageKeys.push(key)
    }
  }

  return {
    databases: appDatabases.map(db => ({
      name: db.name || '',
      version: db.version || 0,
    })),
    localStorageKeys,
    sessionStorageKeys,
  }
}

