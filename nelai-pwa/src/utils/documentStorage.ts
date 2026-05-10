/**
 * Utilidades para almacenar y gestionar documentos en IndexedDB
 */

import { openSharedDB } from './indexedDB'
import type { Document, DocumentQueueItem, ExternalAPIConfig } from '@/types/documents'

const STORE_NAME = 'documents'
const EXTERNAL_API_CONFIGS_STORE_NAME = 'external-api-configs'
const DOCUMENT_QUEUE_STORE_NAME = 'document-queue'

async function openDB(): Promise<IDBDatabase> {
  return await openSharedDB()
}

/**
 * Guarda un documento en IndexedDB
 */
export async function saveDocument(document: Document): Promise<void> {
  console.log(`[Document Storage] Guardando documento: ${document.documentId}`)
  
  if (!document.documentId) {
    throw new Error('documentId es requerido')
  }
  if (!document.pdfHash) {
    throw new Error('pdfHash es requerido')
  }

  const db = await openDB()
  
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const error = new Error(`Object store '${STORE_NAME}' no existe. La base de datos necesita ser actualizada. Por favor, recarga la página.`)
    console.error(`[Document Storage] ❌ ${error.message}`)
    throw error
  }
  
  return new Promise((resolve, reject) => {
    const dbTransaction = db.transaction([STORE_NAME], 'readwrite')
    const store = dbTransaction.objectStore(STORE_NAME)
    const request = store.put({ ...document }) // Crear una copia limpia

    request.onsuccess = () => {
      console.log(`[Document Storage] ✅ Request de guardado exitoso para: ${document.documentId}`)
    }
    
    request.onerror = () => {
      console.error(`[Document Storage] ❌ Error al guardar documento ${document.documentId}:`, request.error)
      reject(request.error)
    }

    dbTransaction.oncomplete = () => {
      console.log(`[Document Storage] ✅ Transacción completada - Documento guardado: ${document.documentId}`)
      resolve()
    }
    
    dbTransaction.onerror = () => {
      const error = dbTransaction.error || request.error || new Error('Error en la transacción')
      console.error(`[Document Storage] ❌ Error en transacción al guardar: ${document.documentId}:`, error)
      reject(error)
    }
  })
}

/**
 * Obtiene un documento por ID
 */
export async function getDocument(documentId: string): Promise<Document | null> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Document Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return null
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(documentId)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene todos los documentos
 */
export async function getAllDocuments(): Promise<Document[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Document Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const documents = request.result || []
      documents.sort((a, b) => b.createdAt - a.createdAt)
      resolve(documents)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene documentos por tipo
 */
export async function getDocumentsByType(type: Document['type']): Promise<Document[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Document Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byType')
    const request = index.getAll(type)

    request.onsuccess = () => {
      const documents = request.result || []
      documents.sort((a, b) => b.createdAt - a.createdAt)
      resolve(documents)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene documentos por cuenta
 */
export async function getDocumentsByAccount(accountAddress: string): Promise<Document[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Document Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('byAccount')
    const request = index.getAll(accountAddress)

    request.onsuccess = () => {
      const documents = request.result || []
      documents.sort((a, b) => b.createdAt - a.createdAt)
      resolve(documents)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Obtiene documentos pendientes de firma
 */
export async function getPendingSignatureDocuments(): Promise<Document[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Document Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return []
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('bySignatureStatus')
    const request = index.getAll('pending')

    request.onsuccess = () => {
      const documents = request.result || []
      documents.sort((a, b) => b.createdAt - a.createdAt)
      resolve(documents)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Elimina un documento
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    console.warn(`[Document Storage] ⚠️ Object store '${STORE_NAME}' no existe.`)
    return
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(documentId)

    request.onsuccess = () => {
      console.log(`[Document Storage] ✅ Documento eliminado: ${documentId}`)
      resolve()
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Actualiza un documento existente
 */
export async function updateDocument(documentId: string, updates: Partial<Document>): Promise<void> {
  const existing = await getDocument(documentId)
  if (!existing) {
    throw new Error(`Documento ${documentId} no encontrado`)
  }

  const updated: Document = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  }

  await saveDocument(updated)
}

// Funciones para External API Configs

export async function saveExternalAPIConfig(config: ExternalAPIConfig): Promise<void> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(EXTERNAL_API_CONFIGS_STORE_NAME)) {
    throw new Error(`Object store '${EXTERNAL_API_CONFIGS_STORE_NAME}' no existe.`)
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EXTERNAL_API_CONFIGS_STORE_NAME], 'readwrite')
    const store = transaction.objectStore(EXTERNAL_API_CONFIGS_STORE_NAME)
    const request = store.put({ ...config })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getAllExternalAPIConfigs(): Promise<ExternalAPIConfig[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(EXTERNAL_API_CONFIGS_STORE_NAME)) {
    return []
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([EXTERNAL_API_CONFIGS_STORE_NAME], 'readonly')
    const store = transaction.objectStore(EXTERNAL_API_CONFIGS_STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// Funciones para Document Queue

export async function saveDocumentQueueItem(item: DocumentQueueItem): Promise<void> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(DOCUMENT_QUEUE_STORE_NAME)) {
    throw new Error(`Object store '${DOCUMENT_QUEUE_STORE_NAME}' no existe.`)
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCUMENT_QUEUE_STORE_NAME], 'readwrite')
    const store = transaction.objectStore(DOCUMENT_QUEUE_STORE_NAME)
    const request = store.put({ ...item })

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getDocumentQueueItemsByStatus(status: DocumentQueueItem['status']): Promise<DocumentQueueItem[]> {
  const db = await openDB()
  if (!db.objectStoreNames.contains(DOCUMENT_QUEUE_STORE_NAME)) {
    return []
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCUMENT_QUEUE_STORE_NAME], 'readonly')
    const store = transaction.objectStore(DOCUMENT_QUEUE_STORE_NAME)
    const index = store.index('byStatus')
    const request = index.getAll(status)

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

