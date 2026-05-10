/**
 * Almacenamiento seguro usando IndexedDB
 * Las claves privadas se almacenan encriptadas
 * 
 * IndexedDB es una base de datos NoSQL (no relacional) que funciona en el navegador.
 * - No usa tablas con relaciones (JOINs) como SQL
 * - Almacena objetos JavaScript directamente
 * - Soporta índices para búsquedas rápidas
 * - Soporta transacciones ACID
 * - Permite migraciones de schema mediante versiones
 */

const DB_NAME = 'pwa-substrate-keyring'
const DB_VERSION = 4 // Actualizado para coincidir con la versión actual de la base de datos
const STORE_NAME = 'encrypted-accounts'
const WEBAUTHN_STORE_NAME = 'webauthn-credentials'

export interface EncryptedAccount {
  address: string // Clave primaria (keyPath)
  encryptedData: string // JSON encriptado con la clave privada (seed/mnemonic)
  publicKey: string // Public key en hex
  type?: 'sr25519' | 'ed25519' | 'ecdsa' // Tipo de criptografía
  ethereumAddress?: string // Dirección Ethereum derivada (opcional)
  meta: {
    name?: string
    tags?: string[] // Etiquetas para organización
    notes?: string // Notas del usuario
    [key: string]: any
  }
  createdAt: number
  updatedAt: number
}

// Usar el módulo compartido para evitar conflictos
import { openSharedDB } from './indexedDB'

async function openDB(): Promise<IDBDatabase> {
  console.log('[IndexedDB] Abriendo base de datos compartida...')
  return await openSharedDB()
}

export async function saveEncryptedAccount(account: EncryptedAccount): Promise<void> {
  console.log(`[IndexedDB] Guardando cuenta: ${account.address}`)
  
  // Validar datos antes de guardar
  if (!account.address) {
    throw new Error('La dirección de la cuenta es requerida')
  }
  if (!account.encryptedData) {
    throw new Error('Los datos encriptados son requeridos')
  }
  
  // Asegurar que createdAt y updatedAt estén presentes
  const now = Date.now()
  const accountToSave: EncryptedAccount = {
    ...account,
    createdAt: account.createdAt || now,
    updatedAt: now,
  }

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(accountToSave)

    request.onsuccess = () => {
      console.log(`[IndexedDB] ✅ Request de guardado exitoso para: ${accountToSave.address}`)
      // Esperar a que la transacción se complete antes de resolver
      // Esto asegura que los datos estén realmente escritos en IndexedDB
    }
    
    request.onerror = () => {
      console.error(`[IndexedDB] ❌ Error al guardar cuenta ${accountToSave.address}:`, request.error)
      reject(request.error)
    }

    // Esperar a que la transacción se complete
    transaction.oncomplete = () => {
      console.log(`[IndexedDB] ✅ Transacción completada - Cuenta guardada: ${accountToSave.address}`)
      resolve()
    }
    
    transaction.onerror = () => {
      const error = transaction.error || request.error || new Error('Error en la transacción')
      console.error(`[IndexedDB] ❌ Error en transacción al guardar cuenta ${accountToSave.address}:`, error)
      reject(error)
    }
  })
}

export async function getEncryptedAccount(address: string): Promise<EncryptedAccount | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(address)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllEncryptedAccounts(): Promise<EncryptedAccount[]> {
  console.log('[IndexedDB] Obteniendo todas las cuentas...')
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const accounts = request.result || []
      console.log(`[IndexedDB] ✅ ${accounts.length} cuenta(s) encontrada(s)`)
      resolve(accounts)
    }
    request.onerror = () => {
      console.error('[IndexedDB] ❌ Error al obtener cuentas:', request.error)
      reject(request.error)
    }
  })
}

export async function deleteEncryptedAccount(address: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(address)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function clearAllAccounts(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => {
      console.log('[IndexedDB] ✅ Todas las cuentas eliminadas')
      resolve()
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Buscar cuentas por tipo de criptografía usando el índice
 */
export async function getAccountsByType(type: 'sr25519' | 'ed25519' | 'ecdsa'): Promise<EncryptedAccount[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byType')
    const request = index.getAll(type)

    request.onsuccess = () => {
      const accounts = request.result || []
      console.log(`[IndexedDB] ✅ ${accounts.length} cuenta(s) encontrada(s) con tipo ${type}`)
      resolve(accounts)
    }
    request.onerror = () => {
      console.error('[IndexedDB] ❌ Error al buscar por tipo:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Buscar cuentas por nombre usando el índice
 */
export async function searchAccountsByName(name: string): Promise<EncryptedAccount[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byName')
    const request = index.getAll(name)

    request.onsuccess = () => {
      const accounts = request.result || []
      console.log(`[IndexedDB] ✅ ${accounts.length} cuenta(s) encontrada(s) con nombre "${name}"`)
      resolve(accounts)
    }
    request.onerror = () => {
      console.error('[IndexedDB] ❌ Error al buscar por nombre:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Obtener cuentas ordenadas por fecha de creación
 */
export async function getAccountsSortedByDate(ascending: boolean = false): Promise<EncryptedAccount[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byCreatedAt')
    const request = index.getAll()
    
    request.onsuccess = () => {
      const accounts = (request.result || []) as EncryptedAccount[]
      // Ordenar manualmente (IndexedDB no garantiza orden con getAll)
      accounts.sort((a, b) => {
        const diff = a.createdAt - b.createdAt
        return ascending ? diff : -diff
      })
      console.log(`[IndexedDB] ✅ ${accounts.length} cuenta(s) ordenadas por fecha`)
      resolve(accounts)
    }
    request.onerror = () => {
      console.error('[IndexedDB] ❌ Error al obtener cuentas ordenadas:', request.error)
      reject(request.error)
    }
  })
}

export type { EncryptedAccount }

