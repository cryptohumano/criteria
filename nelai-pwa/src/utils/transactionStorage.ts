/**
 * Almacenamiento de transacciones en IndexedDB
 */

import { openSharedDB } from './indexedDB'

const STORE_NAME = 'transactions'

export interface StoredTransaction {
  id: string // Hash de la transacción (clave primaria)
  accountAddress: string // Dirección de la cuenta que envió
  toAddress: string // Dirección destino
  amount: string // Cantidad en plancks (como string para evitar problemas de serialización)
  chain: string // Nombre de la cadena
  chainEndpoint: string // Endpoint de la cadena
  type: 'transfer' | 'transferKeepAlive' | 'other'
  status: 'pending' | 'inBlock' | 'finalized' | 'invalid' | 'dropped'
  txHash: string // Hash de la transacción
  blockHash?: string // Hash del bloque donde se incluyó
  blockNumber?: number // Número del bloque
  nonce?: number // Nonce usado
  tip?: string // Tip en plancks (como string)
  fee?: string // Fee pagado en plancks (como string)
  error?: string // Mensaje de error si falló
  metadata?: {
    [key: string]: any
  }
  createdAt: number // Timestamp de creación
  finalizedAt?: number // Timestamp de finalización
  updatedAt: number // Última actualización
}

async function openDB(): Promise<IDBDatabase> {
  return await openSharedDB()
}

/**
 * Guarda una transacción en IndexedDB
 */
export async function saveTransaction(txData: StoredTransaction): Promise<void> {
  console.log(`[Transaction Storage] Guardando transacción: ${txData.id}`)
  
  // Validar datos
  if (!txData.id || !txData.txHash) {
    throw new Error('ID y hash de transacción son requeridos')
  }
  if (!txData.accountAddress) {
    throw new Error('Dirección de cuenta es requerida')
  }

  // Crear una copia limpia del objeto para evitar problemas de serialización
  const cleanTxData: StoredTransaction = {
    id: txData.id,
    accountAddress: txData.accountAddress,
    toAddress: txData.toAddress,
    amount: txData.amount,
    chain: txData.chain,
    chainEndpoint: txData.chainEndpoint,
    type: txData.type,
    status: txData.status,
    txHash: txData.txHash,
    blockHash: txData.blockHash,
    blockNumber: txData.blockNumber,
    extrinsicIndex: txData.extrinsicIndex,
    nonce: txData.nonce,
    tip: txData.tip,
    fee: txData.fee,
    error: txData.error,
    metadata: txData.metadata ? JSON.parse(JSON.stringify(txData.metadata)) : undefined,
    createdAt: txData.createdAt,
    finalizedAt: txData.finalizedAt,
    updatedAt: txData.updatedAt,
  }

  const db = await openDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const error = new Error(`Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada. Por favor, recarga la página.`)
    console.error(`[Transaction Storage] ❌ ${error.message}`)
    throw error
  }
  
  return new Promise((resolve, reject) => {
    const dbTransaction = db.transaction([STORE_NAME], 'readwrite')
    const store = dbTransaction.objectStore(STORE_NAME)
    const request = store.put(cleanTxData)

    request.onsuccess = () => {
      console.log(`[Transaction Storage] ✅ Request de guardado exitoso para: ${txData.id}`, {
        id: cleanTxData.id,
        txHash: cleanTxData.txHash,
        type: cleanTxData.type,
        hasMetadata: !!cleanTxData.metadata,
        metadata: cleanTxData.metadata,
      })
    }
    
    request.onerror = () => {
      console.error(`[Transaction Storage] ❌ Error al guardar transacción ${txData.id}:`, request.error)
      reject(request.error)
    }

    // Esperar a que la transacción se complete
    dbTransaction.oncomplete = () => {
      console.log(`[Transaction Storage] ✅ Transacción completada - Transacción guardada: ${txData.id}`, {
        id: cleanTxData.id,
        txHash: cleanTxData.txHash,
        type: cleanTxData.type,
        hasMetadata: !!cleanTxData.metadata,
        metadata: cleanTxData.metadata,
      })
      
      // Disparar evento personalizado para notificar que se guardó una nueva transacción
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('transaction-saved', {
          detail: { transaction: cleanTxData }
        }))
        console.log('[Transaction Storage] 📢 Evento transaction-saved disparado')
      }
      
      resolve()
    }
    
    dbTransaction.onerror = () => {
      const error = dbTransaction.error || request.error || new Error('Error en la transacción')
      console.error(`[Transaction Storage] ❌ Error en transacción al guardar: ${txData.id}:`, error)
      reject(error)
    }
  })
}

/**
 * Obtiene una transacción por su hash (o ID, ya que son el mismo)
 */
export async function getTransaction(txHash: string): Promise<StoredTransaction | null> {
  const db = await openDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Transaction Storage] ⚠️ Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada.`)
    return null
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    // El id es la clave primaria, y normalmente es igual al txHash
    const request = store.get(txHash)

    request.onsuccess = () => {
      const result = request.result || null
      if (result) {
        console.log(`[Transaction Storage] ✅ Transacción encontrada: ${txHash}`, {
          id: result.id,
          txHash: result.txHash,
          hasMetadata: !!result.metadata,
          metadata: result.metadata,
        })
      } else {
        console.warn(`[Transaction Storage] ⚠️ Transacción no encontrada: ${txHash}`)
      }
      resolve(result)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene todas las transacciones de una cuenta
 */
export async function getTransactionsByAccount(accountAddress: string): Promise<StoredTransaction[]> {
  console.log(`[Transaction Storage] Obteniendo transacciones para cuenta: ${accountAddress}`)
  const db = await openDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Transaction Storage] ⚠️ Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada.`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byAccount')
    const request = index.getAll(accountAddress)

    request.onsuccess = () => {
      const transactions = request.result || []
      // Ordenar por fecha de creación (más recientes primero)
      transactions.sort((a, b) => b.createdAt - a.createdAt)
      console.log(`[Transaction Storage] ✅ ${transactions.length} transacción(es) encontrada(s)`)
      resolve(transactions)
    }
    request.onerror = () => {
      console.error('[Transaction Storage] ❌ Error al obtener transacciones:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Obtiene todas las transacciones
 */
export async function getAllTransactions(): Promise<StoredTransaction[]> {
  console.log('[Transaction Storage] Obteniendo todas las transacciones...')
  const db = await openDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Transaction Storage] ⚠️ Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada.`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const transactions = request.result || []
      // Ordenar por fecha de creación (más recientes primero)
      transactions.sort((a, b) => b.createdAt - a.createdAt)
      console.log(`[Transaction Storage] ✅ ${transactions.length} transacción(es) encontrada(s)`)
      resolve(transactions)
    }
    request.onerror = () => {
      console.error('[Transaction Storage] ❌ Error al obtener transacciones:', request.error)
      reject(request.error)
    }
  })
}

/**
 * Obtiene transacciones por cadena
 */
export async function getTransactionsByChain(chain: string): Promise<StoredTransaction[]> {
  const db = await openDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Transaction Storage] ⚠️ Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada.`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byChain')
    const request = index.getAll(chain)

    request.onsuccess = () => {
      const transactions = request.result || []
      transactions.sort((a, b) => b.createdAt - a.createdAt)
      resolve(transactions)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene transacciones por estado
 */
export async function getTransactionsByStatus(status: StoredTransaction['status']): Promise<StoredTransaction[]> {
  const db = await openDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Transaction Storage] ⚠️ Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada.`)
    return []
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byStatus')
    const request = index.getAll(status)

    request.onsuccess = () => {
      const transactions = request.result || []
      transactions.sort((a, b) => b.createdAt - a.createdAt)
      resolve(transactions)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Actualiza el estado de una transacción
 */
export async function updateTransactionStatus(
  txHash: string,
  status: StoredTransaction['status'],
  blockHash?: string,
  blockNumber?: number,
  error?: string
): Promise<void> {
  const db = await openDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const err = new Error(`Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada. Por favor, recarga la página.`)
    console.error(`[Transaction Storage] ❌ ${err.message}`)
    throw err
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(txHash)

    getRequest.onsuccess = () => {
      const existing = getRequest.result
      if (!existing) {
        console.warn(`[Transaction Storage] ⚠️ Transacción ${txHash} no encontrada. Esto puede ser normal si la transacción aún no se ha guardado.`)
        // No rechazar, solo loguear el warning - la transacción puede no haberse guardado aún
        resolve()
        return
      }

      const updated: StoredTransaction = {
        ...existing,
        status,
        updatedAt: Date.now(),
      }

      if (blockHash) {
        updated.blockHash = blockHash
      }
      if (blockNumber !== undefined) {
        updated.blockNumber = blockNumber
      }
      if (error) {
        updated.error = error
      }
      if (status === 'finalized') {
        updated.finalizedAt = Date.now()
      }

      const putRequest = store.put(updated)
      putRequest.onsuccess = () => {
        console.log(`[Transaction Storage] ✅ Estado actualizado: ${txHash} -> ${status}`)
        resolve()
      }
      putRequest.onerror = () => reject(putRequest.error)
    }

    getRequest.onerror = () => reject(getRequest.error)
  })
}

/**
 * Elimina una transacción
 */
export async function deleteTransaction(txHash: string): Promise<void> {
  const db = await openDB()
  
  // Verificar que el store existe
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const error = new Error(`Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada.`)
    console.error(`[Transaction Storage] ❌ ${error.message}`)
    throw error
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(txHash)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Elimina todas las transacciones de una cuenta
 */
export async function deleteTransactionsByAccount(accountAddress: string): Promise<void> {
  const transactions = await getTransactionsByAccount(accountAddress)
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    let completed = 0
    let hasError = false

    if (transactions.length === 0) {
      resolve()
      return
    }

    transactions.forEach((tx) => {
      const request = store.delete(tx.id)
      request.onsuccess = () => {
        completed++
        if (completed === transactions.length && !hasError) {
          resolve()
        }
      }
      request.onerror = () => {
        if (!hasError) {
          hasError = true
          reject(request.error)
        }
      }
    })
  })
}

export type { StoredTransaction }

