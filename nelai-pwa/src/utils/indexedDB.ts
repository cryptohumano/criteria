/**
 * Módulo compartido para manejar la conexión a IndexedDB
 * Evita conflictos cuando múltiples módulos intentan abrir la misma base de datos
 */

const DB_NAME = 'pwa-substrate-keyring'
const DB_VERSION = 10 // Incrementado para asegurar que el store de emergencias se cree

let dbInstance: IDBDatabase | null = null
let openPromise: Promise<IDBDatabase> | null = null

/**
 * Abre la base de datos compartida
 * Si ya hay una conexión abierta, la reutiliza
 * Si hay una conexión en progreso, espera a que termine
 */
export async function openSharedDB(): Promise<IDBDatabase> {
  // Si ya hay una instancia, verificar que tenga todos los stores necesarios
  if (dbInstance) {
    // Verificar que todos los stores necesarios existen
    const requiredStores = ['encrypted-accounts', 'webauthn-credentials', 'transactions', 'documents', 'external-api-configs', 'document-queue', 'mountain-logs', 'autographic-signatures', 'emergencies']
    const missingStores = requiredStores.filter(store => !dbInstance.objectStoreNames.contains(store))
    if (missingStores.length > 0) {
      console.warn(`[IndexedDB Shared] ⚠️ Faltan stores: ${missingStores.join(', ')}. Cerrando conexión para forzar migración...`)
      dbInstance.close()
      dbInstance = null
      openPromise = null
      // Esperar un momento para que la conexión se cierre completamente
      await new Promise(resolve => setTimeout(resolve, 100))
    } else {
      console.log('[IndexedDB Shared] Usando instancia existente')
      return dbInstance
    }
  }

  // Si hay una conexión en progreso, esperar a que termine
  if (openPromise) {
    console.log('[IndexedDB Shared] Esperando conexión en progreso...')
    return openPromise
  }

  if (!('indexedDB' in window)) {
    throw new Error('IndexedDB no está disponible en este navegador')
  }

  // Verificar si IndexedDB está disponible y no está bloqueado
  try {
    const databases = await indexedDB.databases()
    console.log('[IndexedDB Shared] Bases de datos existentes:', databases.map(db => ({ name: db.name, version: db.version })))
  } catch (err) {
    console.warn('[IndexedDB Shared] No se pudo listar bases de datos:', err)
  }

  console.log(`[IndexedDB Shared] Abriendo base de datos: ${DB_NAME} (versión ${DB_VERSION})`)

  openPromise = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest | null = null
    let timeoutId: NodeJS.Timeout | null = null
    let isResolved = false
    
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
    
    const resolveOnce = (db: IDBDatabase) => {
      if (isResolved) return
      isResolved = true
      cleanup()
      dbInstance = db
      openPromise = null
      console.log('[IndexedDB Shared] ✅ Base de datos abierta exitosamente')
      console.log('[IndexedDB Shared] Object stores disponibles:', Array.from(db.objectStoreNames))
      resolve(db)
    }
    
    const rejectOnce = (error: Error) => {
      if (isResolved) return
      isResolved = true
      cleanup()
      openPromise = null
      console.error('[IndexedDB Shared] ❌', error.message)
      reject(error)
    }
    
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
      console.log('[IndexedDB Shared] Request creado, esperando respuesta...')
      console.log('[IndexedDB Shared] Request readyState:', request.readyState)
      // NO acceder a request.result aquí - causará InvalidStateError
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error('[IndexedDB Shared] ❌ Error al crear request:', error)
      rejectOnce(error)
      return
    }

    // Timeout para evitar que se quede colgado (aumentado a 15 segundos)
    timeoutId = setTimeout(() => {
      const error = new Error('Timeout al abrir IndexedDB (15 segundos). La base de datos puede estar bloqueada o corrupta. Intenta cerrar otras pestañas o eliminar la base de datos desde las herramientas de desarrollador.')
      console.error('[IndexedDB Shared] ❌', error.message)
      if (request) {
        console.error('[IndexedDB Shared] Estado del request:', {
          readyState: request.readyState,
          error: request.error
        })
        // Intentar abortar el request
        try {
          // No podemos abortar directamente, pero podemos cerrar la conexión si se abre después
        } catch (e) {
          console.warn('[IndexedDB Shared] No se pudo abortar el request:', e)
        }
      }
      rejectOnce(error)
    }, 15000)

    const req = request

    req.onerror = () => {
      const error = req.error || new Error('No se pudo abrir IndexedDB')
      
      // Si es un error de versión, intentar abrir sin especificar versión
      if (error.name === 'VersionError') {
        console.warn('[IndexedDB Shared] ⚠️ Error de versión, intentando abrir sin especificar versión...')
        dbInstance = null
        openPromise = null
        
        const fallbackRequest = indexedDB.open(DB_NAME)
        
        fallbackRequest.onsuccess = () => {
          if (!fallbackRequest.result) {
            rejectOnce(new Error('Apertura sin versión exitosa pero sin resultado'))
            return
          }
          console.log('[IndexedDB Shared] ✅ Base de datos abierta sin especificar versión')
          resolveOnce(fallbackRequest.result)
        }
        
        fallbackRequest.onerror = () => {
          const fallbackError = fallbackRequest.error || new Error('Error al abrir sin versión')
          console.error('[IndexedDB Shared] ❌ Error al abrir sin versión:', fallbackError)
          rejectOnce(fallbackError as Error)
        }
        
        return
      }
      
      console.error('[IndexedDB Shared] ❌ Error al abrir:', error)
      console.error('[IndexedDB Shared] Detalles del error:', {
        name: error.name,
        message: error.message,
        code: (error as any).code,
        stack: error.stack
      })
      rejectOnce(error)
    }

    req.onsuccess = () => {
      console.log('[IndexedDB Shared] ✅ Request.onsuccess ejecutado')
      if (!req.result) {
        const error = new Error('Request exitoso pero sin resultado')
        console.error('[IndexedDB Shared] ❌', error.message)
        rejectOnce(error)
        return
      }
      
      const db = req.result
      const STORE_NAME = 'encrypted-accounts'
      const WEBAUTHN_STORE_NAME = 'webauthn-credentials'
      const TRANSACTIONS_STORE_NAME = 'transactions'
      const DOCUMENTS_STORE_NAME = 'documents'
      const EXTERNAL_API_CONFIGS_STORE_NAME = 'external-api-configs'
      const DOCUMENT_QUEUE_STORE_NAME = 'document-queue'
      const MOUNTAIN_LOGS_STORE_NAME = 'mountain-logs'
      const AUTOGRAPHIC_SIGNATURES_STORE_NAME = 'autographic-signatures'
      
      // Verificar que los stores existan
      
      const EMERGENCIES_STORE_NAME = 'emergencies'
      const hasAccountsStore = db.objectStoreNames.contains(STORE_NAME)
      const hasWebAuthnStore = db.objectStoreNames.contains(WEBAUTHN_STORE_NAME)
      const hasTransactionsStore = db.objectStoreNames.contains(TRANSACTIONS_STORE_NAME)
      const hasDocumentsStore = db.objectStoreNames.contains(DOCUMENTS_STORE_NAME)
      const hasExternalAPIConfigsStore = db.objectStoreNames.contains(EXTERNAL_API_CONFIGS_STORE_NAME)
      const hasDocumentQueueStore = db.objectStoreNames.contains(DOCUMENT_QUEUE_STORE_NAME)
      const hasMountainLogsStore = db.objectStoreNames.contains(MOUNTAIN_LOGS_STORE_NAME)
      const hasAutographicSignaturesStore = db.objectStoreNames.contains(AUTOGRAPHIC_SIGNATURES_STORE_NAME)
      const hasEmergenciesStore = db.objectStoreNames.contains(EMERGENCIES_STORE_NAME)
      const hasCorrectVersion = db.version === DB_VERSION
      
      console.log('[IndexedDB Shared] Stores disponibles:', Array.from(db.objectStoreNames))
      console.log(`[IndexedDB Shared] Versión de DB: ${db.version}, esperada: ${DB_VERSION}`)
      
      if (!hasAccountsStore || !hasWebAuthnStore || !hasTransactionsStore || !hasDocumentsStore || !hasExternalAPIConfigsStore || !hasDocumentQueueStore || !hasMountainLogsStore || !hasAutographicSignaturesStore || !hasEmergenciesStore || !hasCorrectVersion) {
        console.warn('[IndexedDB Shared] ⚠️ Faltan stores, cerrando y eliminando base de datos para recrearla...')
        db.close()
        dbInstance = null
        openPromise = null
        
        // Eliminar y recrear la base de datos
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME)
        
        deleteRequest.onsuccess = () => {
          console.log('[IndexedDB Shared] ✅ Base de datos eliminada, recreando...')
          // Reabrir (esto creará los stores en onupgradeneeded)
          const recreateRequest = indexedDB.open(DB_NAME, DB_VERSION)
          
          recreateRequest.onerror = () => {
            const error = recreateRequest.error || new Error('Error al recrear base de datos')
            console.error('[IndexedDB Shared] ❌ Error al recrear:', error)
            rejectOnce(error as Error)
          }
          
          recreateRequest.onsuccess = () => {
            if (!recreateRequest.result) {
              rejectOnce(new Error('Recreación exitosa pero sin resultado'))
              return
            }
            console.log('[IndexedDB Shared] ✅ Base de datos recreada con stores')
            resolveOnce(recreateRequest.result)
          }
          
          recreateRequest.onupgradeneeded = (event) => {
            console.log('[IndexedDB Shared] ⚠️ Creando stores en recreación...')
            const recreateDb = (event.target as IDBOpenDBRequest).result
            
            // Crear store de cuentas
            const store = recreateDb.createObjectStore(STORE_NAME, { keyPath: 'address' })
            store.createIndex('byType', 'type', { unique: false })
            store.createIndex('byCreatedAt', 'createdAt', { unique: false })
            store.createIndex('byName', 'meta.name', { unique: false })
            console.log(`[IndexedDB Shared] ObjectStore '${STORE_NAME}' creado`)
            
            // Crear store de WebAuthn
            const webauthnStore = recreateDb.createObjectStore(WEBAUTHN_STORE_NAME, { keyPath: 'id' })
            webauthnStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
            console.log(`[IndexedDB Shared] ObjectStore '${WEBAUTHN_STORE_NAME}' creado`)
            
            // Crear store de transacciones
            const TRANSACTIONS_STORE_NAME = 'transactions'
            const transactionsStore = recreateDb.createObjectStore(TRANSACTIONS_STORE_NAME, { keyPath: 'id' })
            transactionsStore.createIndex('byAccount', 'accountAddress', { unique: false })
            transactionsStore.createIndex('byChain', 'chain', { unique: false })
            transactionsStore.createIndex('byStatus', 'status', { unique: false })
            transactionsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
            console.log(`[IndexedDB Shared] ObjectStore '${TRANSACTIONS_STORE_NAME}' creado con índices`)

            // Crear store de documentos
            const DOCUMENTS_STORE_NAME = 'documents'
            const documentsStore = recreateDb.createObjectStore(DOCUMENTS_STORE_NAME, { keyPath: 'documentId' })
            documentsStore.createIndex('byType', 'type', { unique: false })
            documentsStore.createIndex('byHash', 'pdfHash', { unique: false })
            documentsStore.createIndex('byAccount', 'relatedAccount', { unique: false })
            documentsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
            documentsStore.createIndex('bySynced', 'synced', { unique: false })
            documentsStore.createIndex('bySignatureStatus', 'signatureStatus', { unique: false })
            documentsStore.createIndex('byBatchId', 'batchId', { unique: false })
            documentsStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
            console.log(`[IndexedDB Shared] ObjectStore '${DOCUMENTS_STORE_NAME}' creado con índices`)

            // Crear store de configuraciones de API externa
            const EXTERNAL_API_CONFIGS_STORE_NAME = 'external-api-configs'
            const externalAPIConfigsStore = recreateDb.createObjectStore(EXTERNAL_API_CONFIGS_STORE_NAME, { keyPath: 'apiId' })
            externalAPIConfigsStore.createIndex('byName', 'name', { unique: false })
            externalAPIConfigsStore.createIndex('byActive', 'isActive', { unique: false })
            externalAPIConfigsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
            console.log(`[IndexedDB Shared] ObjectStore '${EXTERNAL_API_CONFIGS_STORE_NAME}' creado con índices`)

            // Crear store de cola de documentos
            const DOCUMENT_QUEUE_STORE_NAME = 'document-queue'
            const documentQueueStore = recreateDb.createObjectStore(DOCUMENT_QUEUE_STORE_NAME, { keyPath: 'id' })
            documentQueueStore.createIndex('byStatus', 'status', { unique: false })
            documentQueueStore.createIndex('byPriority', 'priority', { unique: false })
            documentQueueStore.createIndex('byDocument', 'documentId', { unique: false })
            documentQueueStore.createIndex('byExternalApi', 'externalApiId', { unique: false })
            documentQueueStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
            console.log(`[IndexedDB Shared] ObjectStore '${DOCUMENT_QUEUE_STORE_NAME}' creado con índices`)

            // Crear store de bitácoras de montañismo
            const MOUNTAIN_LOGS_STORE_NAME = 'mountain-logs'
            const mountainLogsStore = recreateDb.createObjectStore(MOUNTAIN_LOGS_STORE_NAME, { keyPath: 'logId' })
            mountainLogsStore.createIndex('byStatus', 'status', { unique: false })
            mountainLogsStore.createIndex('byAccount', 'relatedAccount', { unique: false })
            mountainLogsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
            mountainLogsStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
            mountainLogsStore.createIndex('byStartDate', 'startDate', { unique: false })
            mountainLogsStore.createIndex('bySynced', 'synced', { unique: false })
            console.log(`[IndexedDB Shared] ObjectStore '${MOUNTAIN_LOGS_STORE_NAME}' creado con índices`)

            const AUTOGRAPHIC_SIGNATURES_STORE_NAME = 'autographic-signatures'
            const autographicSignaturesStore = recreateDb.createObjectStore(AUTOGRAPHIC_SIGNATURES_STORE_NAME, { keyPath: 'accountAddress' })
            autographicSignaturesStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
            autographicSignaturesStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
            console.log(`[IndexedDB Shared] ObjectStore '${AUTOGRAPHIC_SIGNATURES_STORE_NAME}' creado con índices`)

            // Crear store de emergencias
            const EMERGENCIES_STORE_NAME = 'emergencies'
            const emergenciesStore = recreateDb.createObjectStore(EMERGENCIES_STORE_NAME, { keyPath: 'emergencyId' })
            emergenciesStore.createIndex('byAccount', 'reporterAccount', { unique: false })
            emergenciesStore.createIndex('byStatus', 'status', { unique: false })
            emergenciesStore.createIndex('byType', 'type', { unique: false })
            emergenciesStore.createIndex('byRelatedLogId', 'relatedLogId', { unique: false })
            emergenciesStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
            emergenciesStore.createIndex('byBlockchainTxHash', 'blockchainTxHash', { unique: false })
            console.log(`[IndexedDB Shared] ObjectStore '${EMERGENCIES_STORE_NAME}' creado con índices`)
          }
        }
        
        deleteRequest.onerror = () => {
          const error = deleteRequest.error || new Error('Error al eliminar base de datos')
          console.error('[IndexedDB Shared] ❌ Error al eliminar:', error)
          rejectOnce(error as Error)
        }
        
        return // No continuar con el resolve original
      }
      
      // Verificar si falta el store de emergencias
      // Esto puede pasar si la migración falló o si se creó la versión sin el store
      // EMERGENCIES_STORE_NAME ya está declarado arriba en la línea 181
      if (!db.objectStoreNames.contains(EMERGENCIES_STORE_NAME)) {
        console.warn(`[IndexedDB Shared] ⚠️ Store de emergencias falta (versión actual: ${db.version}). Forzando upgrade...`)
        db.close()
        dbInstance = null
        openPromise = null
        
        // Reabrir con versión incrementada para forzar upgrade
        // Siempre incrementar la versión para asegurar que onupgradeneeded se ejecute
        const newVersion = db.version + 1
        console.log(`[IndexedDB Shared] Forzando upgrade de versión ${db.version} a ${newVersion}`)
        const upgradeRequest = indexedDB.open(DB_NAME, newVersion)
        
        upgradeRequest.onerror = () => {
          const error = upgradeRequest.error || new Error('Error al forzar upgrade')
          console.error('[IndexedDB Shared] ❌ Error al forzar upgrade:', error)
          rejectOnce(error as Error)
        }
        
        upgradeRequest.onsuccess = () => {
          if (!upgradeRequest.result) {
            rejectOnce(new Error('Upgrade exitoso pero sin resultado'))
            return
          }
          console.log('[IndexedDB Shared] ✅ Upgrade forzado completado')
          resolveOnce(upgradeRequest.result)
        }
        
        upgradeRequest.onupgradeneeded = (event) => {
          const upgradeDb = (event.target as IDBOpenDBRequest).result
          
          if (!upgradeDb.objectStoreNames.contains(EMERGENCIES_STORE_NAME)) {
            try {
              const emergenciesStore = upgradeDb.createObjectStore(EMERGENCIES_STORE_NAME, { keyPath: 'emergencyId' })
              emergenciesStore.createIndex('byAccount', 'reporterAccount', { unique: false })
              emergenciesStore.createIndex('byStatus', 'status', { unique: false })
              emergenciesStore.createIndex('byType', 'type', { unique: false })
              emergenciesStore.createIndex('byRelatedLogId', 'relatedLogId', { unique: false })
              emergenciesStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
              emergenciesStore.createIndex('byBlockchainTxHash', 'blockchainTxHash', { unique: false })
              console.log(`[IndexedDB Shared] ✅ ObjectStore '${EMERGENCIES_STORE_NAME}' creado en upgrade forzado`)
            } catch (error) {
              console.error(`[IndexedDB Shared] ❌ Error al crear store en upgrade forzado:`, error)
            }
          }
        }
        
        return // No continuar con el resolve original
      }
      
      resolveOnce(db)
    }

    req.onupgradeneeded = (event) => {
      console.log('[IndexedDB Shared] ⚠️ Ejecutando upgrade...')
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion || 0
      const newVersion = event.newVersion || DB_VERSION
      console.log(`[IndexedDB Shared] Migrando de versión ${oldVersion} a ${newVersion}`)

      const STORE_NAME = 'encrypted-accounts'
      const WEBAUTHN_STORE_NAME = 'webauthn-credentials'
      const TRANSACTIONS_STORE_NAME = 'transactions'
      const DOCUMENTS_STORE_NAME = 'documents'
      const EXTERNAL_API_CONFIGS_STORE_NAME = 'external-api-configs'
      const DOCUMENT_QUEUE_STORE_NAME = 'document-queue'
      const MOUNTAIN_LOGS_STORE_NAME = 'mountain-logs'

      try {
        // Si es una instalación nueva (sin versión anterior)
        if (oldVersion === 0) {
          // Crear store de cuentas encriptadas
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'address' })
          store.createIndex('byType', 'type', { unique: false })
          store.createIndex('byCreatedAt', 'createdAt', { unique: false })
          store.createIndex('byName', 'meta.name', { unique: false })
          console.log(`[IndexedDB Shared] ObjectStore '${STORE_NAME}' creado con índices`)

          // Crear store de WebAuthn
          const webauthnStore = db.createObjectStore(WEBAUTHN_STORE_NAME, { keyPath: 'id' })
          webauthnStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
          console.log(`[IndexedDB Shared] ObjectStore '${WEBAUTHN_STORE_NAME}' creado`)

          // Crear store de transacciones
          const transactionsStore = db.createObjectStore(TRANSACTIONS_STORE_NAME, { keyPath: 'id' })
          transactionsStore.createIndex('byAccount', 'accountAddress', { unique: false })
          transactionsStore.createIndex('byChain', 'chain', { unique: false })
          transactionsStore.createIndex('byStatus', 'status', { unique: false })
          transactionsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
          console.log(`[IndexedDB Shared] ObjectStore '${TRANSACTIONS_STORE_NAME}' creado con índices`)

          // Crear store de documentos
          const documentsStore = db.createObjectStore(DOCUMENTS_STORE_NAME, { keyPath: 'documentId' })
          documentsStore.createIndex('byType', 'type', { unique: false })
          documentsStore.createIndex('byHash', 'pdfHash', { unique: false })
          documentsStore.createIndex('byAccount', 'relatedAccount', { unique: false })
          documentsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
          documentsStore.createIndex('bySynced', 'synced', { unique: false })
          documentsStore.createIndex('bySignatureStatus', 'signatureStatus', { unique: false })
          documentsStore.createIndex('byBatchId', 'batchId', { unique: false })
          documentsStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
          console.log(`[IndexedDB Shared] ObjectStore '${DOCUMENTS_STORE_NAME}' creado con índices`)

          // Crear store de configuraciones de API externa
          const externalAPIConfigsStore = db.createObjectStore(EXTERNAL_API_CONFIGS_STORE_NAME, { keyPath: 'apiId' })
          externalAPIConfigsStore.createIndex('byName', 'name', { unique: false })
          externalAPIConfigsStore.createIndex('byActive', 'isActive', { unique: false })
          externalAPIConfigsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
          console.log(`[IndexedDB Shared] ObjectStore '${EXTERNAL_API_CONFIGS_STORE_NAME}' creado con índices`)

          // Crear store de cola de documentos
          const documentQueueStore = db.createObjectStore(DOCUMENT_QUEUE_STORE_NAME, { keyPath: 'id' })
          documentQueueStore.createIndex('byStatus', 'status', { unique: false })
          documentQueueStore.createIndex('byPriority', 'priority', { unique: false })
          documentQueueStore.createIndex('byDocument', 'documentId', { unique: false })
          documentQueueStore.createIndex('byExternalApi', 'externalApiId', { unique: false })
          documentQueueStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
          console.log(`[IndexedDB Shared] ObjectStore '${DOCUMENT_QUEUE_STORE_NAME}' creado con índices`)

          // Crear store de bitácoras de montañismo
          const mountainLogsStore = db.createObjectStore(MOUNTAIN_LOGS_STORE_NAME, { keyPath: 'logId' })
          mountainLogsStore.createIndex('byStatus', 'status', { unique: false })
          mountainLogsStore.createIndex('byAccount', 'relatedAccount', { unique: false })
          mountainLogsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
          mountainLogsStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
          mountainLogsStore.createIndex('byStartDate', 'startDate', { unique: false })
          mountainLogsStore.createIndex('bySynced', 'synced', { unique: false })
          console.log(`[IndexedDB Shared] ObjectStore '${MOUNTAIN_LOGS_STORE_NAME}' creado con índices`)

          // Crear store de firmas autográficas
          const AUTOGRAPHIC_SIGNATURES_STORE_NAME = 'autographic-signatures'
          const autographicSignaturesStore = db.createObjectStore(AUTOGRAPHIC_SIGNATURES_STORE_NAME, { keyPath: 'accountAddress' })
          autographicSignaturesStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
          autographicSignaturesStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
          console.log(`[IndexedDB Shared] ObjectStore '${AUTOGRAPHIC_SIGNATURES_STORE_NAME}' creado con índices`)

          // Crear store de emergencias
          const EMERGENCIES_STORE_NAME = 'emergencies'
          const emergenciesStore = db.createObjectStore(EMERGENCIES_STORE_NAME, { keyPath: 'emergencyId' })
          emergenciesStore.createIndex('byAccount', 'reporterAccount', { unique: false })
          emergenciesStore.createIndex('byStatus', 'status', { unique: false })
          emergenciesStore.createIndex('byType', 'type', { unique: false })
          emergenciesStore.createIndex('byRelatedLogId', 'relatedLogId', { unique: false })
          emergenciesStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
          emergenciesStore.createIndex('byBlockchainTxHash', 'blockchainTxHash', { unique: false })
          console.log(`[IndexedDB Shared] ObjectStore '${EMERGENCIES_STORE_NAME}' creado con índices`)
        } else {
          const transaction = (event.target as IDBOpenDBRequest).transaction
          if (!transaction) {
            console.error('[IndexedDB Shared] No se pudo obtener la transacción de migración')
            return
          }

          // Migración de versión 1 a 2: Agregar índices
          if (oldVersion < 2) {
            if (db.objectStoreNames.contains(STORE_NAME)) {
              const store = transaction.objectStore(STORE_NAME)

              if (!store.indexNames.contains('byType')) {
                store.createIndex('byType', 'type', { unique: false })
                console.log('[IndexedDB Shared] Índice "byType" creado')
              }
              
              if (!store.indexNames.contains('byCreatedAt')) {
                store.createIndex('byCreatedAt', 'createdAt', { unique: false })
                console.log('[IndexedDB Shared] Índice "byCreatedAt" creado')
              }

              if (!store.indexNames.contains('byName')) {
                store.createIndex('byName', 'meta.name', { unique: false })
                console.log('[IndexedDB Shared] Índice "byName" creado')
              }
            }
          }

          // Migración de versión 2 a 3: Agregar store de WebAuthn
          if (oldVersion < 3) {
            if (!db.objectStoreNames.contains(WEBAUTHN_STORE_NAME)) {
              const webauthnStore = db.createObjectStore(WEBAUTHN_STORE_NAME, { keyPath: 'id' })
              webauthnStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
              console.log(`[IndexedDB Shared] ObjectStore '${WEBAUTHN_STORE_NAME}' creado`)
            }
          }

          // Migración de versión 3 a 4: (puede agregarse aquí si hay cambios futuros)
          // Por ahora no hay cambios en la versión 4

          // Migración de versión 4 a 5: Agregar store de transacciones
          if (oldVersion < 5) {
            console.log('[IndexedDB Shared] Migrando de versión 4 a 5: Agregando store de transacciones...')
            if (!db.objectStoreNames.contains(TRANSACTIONS_STORE_NAME)) {
              try {
                const transactionsStore = db.createObjectStore(TRANSACTIONS_STORE_NAME, { keyPath: 'id' })
                transactionsStore.createIndex('byAccount', 'accountAddress', { unique: false })
                transactionsStore.createIndex('byChain', 'chain', { unique: false })
                transactionsStore.createIndex('byStatus', 'status', { unique: false })
                transactionsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
                console.log(`[IndexedDB Shared] ✅ ObjectStore '${TRANSACTIONS_STORE_NAME}' creado con índices`)
              } catch (error) {
                console.error(`[IndexedDB Shared] ❌ Error al crear store '${TRANSACTIONS_STORE_NAME}':`, error)
                throw error
              }
            } else {
              console.log(`[IndexedDB Shared] ⚠️ ObjectStore '${TRANSACTIONS_STORE_NAME}' ya existe`)
            }
          }

          // Migración de versión 5 a 6: Agregar stores de documentos
          if (oldVersion < 6) {
            console.log('[IndexedDB Shared] Migrando de versión 5 a 6: Agregando stores de documentos...')
            
            // Store de documentos
            if (!db.objectStoreNames.contains(DOCUMENTS_STORE_NAME)) {
              try {
                const documentsStore = db.createObjectStore(DOCUMENTS_STORE_NAME, { keyPath: 'documentId' })
                documentsStore.createIndex('byType', 'type', { unique: false })
                documentsStore.createIndex('byHash', 'pdfHash', { unique: false })
                documentsStore.createIndex('byAccount', 'relatedAccount', { unique: false })
                documentsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
                documentsStore.createIndex('bySynced', 'synced', { unique: false })
                documentsStore.createIndex('bySignatureStatus', 'signatureStatus', { unique: false })
                documentsStore.createIndex('byBatchId', 'batchId', { unique: false })
                documentsStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
                console.log(`[IndexedDB Shared] ✅ ObjectStore '${DOCUMENTS_STORE_NAME}' creado con índices`)
              } catch (error) {
                console.error(`[IndexedDB Shared] ❌ Error al crear store '${DOCUMENTS_STORE_NAME}':`, error)
                throw error
              }
            }

            // Store de configuraciones de API externa
            if (!db.objectStoreNames.contains(EXTERNAL_API_CONFIGS_STORE_NAME)) {
              try {
                const externalAPIConfigsStore = db.createObjectStore(EXTERNAL_API_CONFIGS_STORE_NAME, { keyPath: 'apiId' })
                externalAPIConfigsStore.createIndex('byName', 'name', { unique: false })
                externalAPIConfigsStore.createIndex('byActive', 'isActive', { unique: false })
                externalAPIConfigsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
                console.log(`[IndexedDB Shared] ✅ ObjectStore '${EXTERNAL_API_CONFIGS_STORE_NAME}' creado con índices`)
              } catch (error) {
                console.error(`[IndexedDB Shared] ❌ Error al crear store '${EXTERNAL_API_CONFIGS_STORE_NAME}':`, error)
                throw error
              }
            }

            // Store de cola de documentos
            if (!db.objectStoreNames.contains(DOCUMENT_QUEUE_STORE_NAME)) {
              try {
                const documentQueueStore = db.createObjectStore(DOCUMENT_QUEUE_STORE_NAME, { keyPath: 'id' })
                documentQueueStore.createIndex('byStatus', 'status', { unique: false })
                documentQueueStore.createIndex('byPriority', 'priority', { unique: false })
                documentQueueStore.createIndex('byDocument', 'documentId', { unique: false })
                documentQueueStore.createIndex('byExternalApi', 'externalApiId', { unique: false })
                documentQueueStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
                console.log(`[IndexedDB Shared] ✅ ObjectStore '${DOCUMENT_QUEUE_STORE_NAME}' creado con índices`)
              } catch (error) {
                console.error(`[IndexedDB Shared] ❌ Error al crear store '${DOCUMENT_QUEUE_STORE_NAME}':`, error)
                throw error
              }
            }
          }

          // Migración de versión 6 a 7: Agregar store de bitácoras de montañismo
          if (oldVersion < 7) {
            console.log('[IndexedDB Shared] Migrando de versión 6 a 7: Agregando store de bitácoras de montañismo...')
            if (!db.objectStoreNames.contains(MOUNTAIN_LOGS_STORE_NAME)) {
              try {
                const mountainLogsStore = db.createObjectStore(MOUNTAIN_LOGS_STORE_NAME, { keyPath: 'logId' })
                mountainLogsStore.createIndex('byStatus', 'status', { unique: false })
                mountainLogsStore.createIndex('byAccount', 'relatedAccount', { unique: false })
                mountainLogsStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
                mountainLogsStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
                mountainLogsStore.createIndex('byStartDate', 'startDate', { unique: false })
                mountainLogsStore.createIndex('bySynced', 'synced', { unique: false })
                console.log(`[IndexedDB Shared] ✅ ObjectStore '${MOUNTAIN_LOGS_STORE_NAME}' creado con índices`)
              } catch (error) {
                console.error(`[IndexedDB Shared] ❌ Error al crear store '${MOUNTAIN_LOGS_STORE_NAME}':`, error)
                throw error
              }
            }
          }

          // Migración de versión 7 a 8: Agregar store de firmas autográficas
          if (oldVersion < 8) {
            console.log('[IndexedDB Shared] Migrando de versión 7 a 8: Agregando store de firmas autográficas...')
            const AUTOGRAPHIC_SIGNATURES_STORE_NAME = 'autographic-signatures'
            if (!db.objectStoreNames.contains(AUTOGRAPHIC_SIGNATURES_STORE_NAME)) {
              try {
                const autographicSignaturesStore = db.createObjectStore(AUTOGRAPHIC_SIGNATURES_STORE_NAME, { keyPath: 'accountAddress' })
                autographicSignaturesStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
                autographicSignaturesStore.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
                console.log(`[IndexedDB Shared] ✅ ObjectStore '${AUTOGRAPHIC_SIGNATURES_STORE_NAME}' creado con índices`)
              } catch (error) {
                console.error(`[IndexedDB Shared] ❌ Error al crear store '${AUTOGRAPHIC_SIGNATURES_STORE_NAME}':`, error)
                throw error
              }
            }
          }

          // Migración de versión 8 a 9: Agregar store de emergencias
          if (oldVersion < 9) {
            console.log('[IndexedDB Shared] Migrando de versión 8 a 9: Agregando store de emergencias...')
            const EMERGENCIES_STORE_NAME = 'emergencies'
            if (!db.objectStoreNames.contains(EMERGENCIES_STORE_NAME)) {
              try {
                const emergenciesStore = db.createObjectStore(EMERGENCIES_STORE_NAME, { keyPath: 'emergencyId' })
                emergenciesStore.createIndex('byAccount', 'reporterAccount', { unique: false })
                emergenciesStore.createIndex('byStatus', 'status', { unique: false })
                emergenciesStore.createIndex('byType', 'type', { unique: false })
                emergenciesStore.createIndex('byRelatedLogId', 'relatedLogId', { unique: false })
                emergenciesStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
                emergenciesStore.createIndex('byBlockchainTxHash', 'blockchainTxHash', { unique: false })
                console.log(`[IndexedDB Shared] ✅ ObjectStore '${EMERGENCIES_STORE_NAME}' creado con índices`)
              } catch (error) {
                console.error(`[IndexedDB Shared] ❌ Error al crear store '${EMERGENCIES_STORE_NAME}':`, error)
                throw error
              }
            }
          }

          // Migración de versión 9 a 10: Asegurar que el store de emergencias existe
          if (oldVersion < 10) {
            console.log('[IndexedDB Shared] Migrando de versión 9 a 10: Verificando store de emergencias...')
            const EMERGENCIES_STORE_NAME = 'emergencies'
            if (!db.objectStoreNames.contains(EMERGENCIES_STORE_NAME)) {
              try {
                const emergenciesStore = db.createObjectStore(EMERGENCIES_STORE_NAME, { keyPath: 'emergencyId' })
                emergenciesStore.createIndex('byAccount', 'reporterAccount', { unique: false })
                emergenciesStore.createIndex('byStatus', 'status', { unique: false })
                emergenciesStore.createIndex('byType', 'type', { unique: false })
                emergenciesStore.createIndex('byRelatedLogId', 'relatedLogId', { unique: false })
                emergenciesStore.createIndex('byCreatedAt', 'createdAt', { unique: false })
                emergenciesStore.createIndex('byBlockchainTxHash', 'blockchainTxHash', { unique: false })
                console.log(`[IndexedDB Shared] ✅ ObjectStore '${EMERGENCIES_STORE_NAME}' creado con índices en migración 9->10`)
              } catch (error) {
                console.error(`[IndexedDB Shared] ❌ Error al crear store '${EMERGENCIES_STORE_NAME}' en migración 9->10:`, error)
                throw error
              }
            } else {
              console.log(`[IndexedDB Shared] ✅ ObjectStore '${EMERGENCIES_STORE_NAME}' ya existe`)
            }
          }
        }
        console.log('[IndexedDB Shared] ✅ Migración completada exitosamente')
      } catch (error) {
        console.error('[IndexedDB Shared] ❌ Error durante la migración:', error)
        // No rechazar aquí, dejar que el upgrade continúe
      }
    }
    
    req.onblocked = () => {
      console.warn('[IndexedDB Shared] ⚠️ Base de datos bloqueada. Cierra otras pestañas que usen esta base de datos.')
      console.warn('[IndexedDB Shared] Esto puede causar que la conexión se quede colgada.')
    }
  })

  return openPromise
}

/**
 * Cierra la conexión a la base de datos
 */
export function closeSharedDB(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
    openPromise = null
    console.log('[IndexedDB Shared] Conexión cerrada')
  }
}

/**
 * Espera una apertura en curso, cierra la conexión y limpia el singleton.
 * Necesario antes de `deleteDatabase` para que el navegador no deje la eliminación en `blocked`.
 */
export async function drainOpenPromiseAndCloseSharedDb(): Promise<void> {
  if (openPromise) {
    try {
      const db = await openPromise
      db.close()
    } catch {
      // apertura fallida o abortada
    }
    openPromise = null
  }
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
  openPromise = null
  await new Promise((r) => setTimeout(r, 120))
}

/**
 * Obtiene la instancia actual de la base de datos (sin abrir si no existe)
 */
export function getSharedDB(): IDBDatabase | null {
  return dbInstance
}

/**
 * Intenta eliminar la base de datos si está corrupta
 * Úsalo solo como último recurso
 */
export async function deleteDatabase(): Promise<void> {
  console.warn('[IndexedDB Shared] ⚠️ Eliminando base de datos (esto borrará todos los datos)...')

  const maxAttempts = 15
  const blockedWaitMs = 10_000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await drainOpenPromiseAndCloseSharedDb()

    try {
      await new Promise<void>((resolve, reject) => {
        const r = indexedDB.deleteDatabase(DB_NAME)
        const timer = setTimeout(() => {
          reject(new Error('blocked-timeout'))
        }, blockedWaitMs)

        r.onsuccess = () => {
          clearTimeout(timer)
          console.log('[IndexedDB Shared] ✅ Base de datos eliminada exitosamente')
          resolve()
        }
        r.onerror = () => {
          clearTimeout(timer)
          reject(r.error || new Error('Error al eliminar la base de datos'))
        }
        r.onblocked = () => {
          console.warn(
            `[IndexedDB Shared] ⚠️ Eliminación bloqueada (${attempt}/${maxAttempts}). Cerrando conexión local; cierra otras pestañas con criterIA si sigue bloqueado.`,
          )
          void drainOpenPromiseAndCloseSharedDb()
        }
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg !== 'blocked-timeout' && !msg.includes('blocked')) {
        throw e instanceof Error ? e : new Error(msg)
      }
      console.warn(`[IndexedDB Shared] Reintentando eliminar (${attempt}/${maxAttempts})…`)
      await new Promise((res) => setTimeout(res, 300 + attempt * 100))
      continue
    }

    try {
      const databases = await indexedDB.databases()
      if (!databases.some((d) => d.name === DB_NAME)) return
      console.warn('[IndexedDB Shared] La BD sigue listada tras delete; reintentando…')
    } catch {
      return
    }
  }

  throw new Error(
    `No se pudo eliminar IndexedDB "${DB_NAME}". Cierra todas las pestañas de esta app y recarga antes de borrar datos.`,
  )
}

/**
 * Verifica el estado de IndexedDB
 */
export async function checkIndexedDBStatus(): Promise<{
  available: boolean
  databases: Array<{ name: string; version: number }>
  error?: string
}> {
  if (!('indexedDB' in window)) {
    return {
      available: false,
      databases: [],
      error: 'IndexedDB no está disponible en este navegador'
    }
  }
  
  try {
    const databases = await indexedDB.databases()
    return {
      available: true,
      databases: databases.map(db => ({
        name: db.name || '',
        version: db.version || 0
      }))
    }
  } catch (error) {
    return {
      available: true,
      databases: [],
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

