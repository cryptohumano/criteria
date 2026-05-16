/**
 * Utilidades para hacer backup e importar datos de la aplicación
 */

import { openSharedDB } from './indexedDB'
import type { EncryptedAccount } from './secureStorage'
import type { WebAuthnCredential } from './webauthn'
import type { StoredTransaction } from './transactionStorage'
import type { MountainLog, MountainLogImage } from '@/types/mountainLogs'
import type { Document, DocumentQueueItem, ExternalAPIConfig } from '@/types/documents'
import type { Emergency } from '@/types/emergencies'
import type { AutographicSignature } from '@/utils/autographicSignatureStorage'
import { CRITERIA_STORAGE, LEGACY_NELAI_STORAGE } from '@/constants/storageKeys'

export interface BackupData {
  version: string
  createdAt: number
  accounts: EncryptedAccount[]
  webauthnCredentials: WebAuthnCredential[]
  transactions: StoredTransaction[]
  contacts: any[]
  apiConfigs: any[]
  mountainLogs?: MountainLog[] // Bitácoras de montañismo
  documents?: Document[] // Documentos firmados
  /** Configs de API externa en IndexedDB (diferente de `apiConfigs` en localStorage) */
  externalApiConfigs?: ExternalAPIConfig[]
  documentQueue?: DocumentQueueItem[]
  autographicSignatures?: AutographicSignature[]
  emergencies?: Emergency[]
  metadata?: {
    appName: string
    appVersion?: string
    description?: string
    includesImages?: boolean // Si incluye imágenes completas (base64)
    includesPDFs?: boolean // Si incluye PDFs completos (base64)
    includesAutographicSignatures?: boolean
  }
}

const BACKUP_VERSION = '1.2.0' // Incluye external-api-configs, cola de documentos, firmas autográficas y emergencias
const CONTACTS_STORAGE_KEY = CRITERIA_STORAGE.contacts
const API_CONFIGS_STORAGE_KEY = CRITERIA_STORAGE.apiConfigs
const LEGACY_CONTACTS_STORAGE_KEY = LEGACY_NELAI_STORAGE.contacts
const LEGACY_API_CONFIGS_STORAGE_KEY = LEGACY_NELAI_STORAGE.apiConfigs

/**
 * Sanitiza una bitácora removiendo base64 de imágenes si no se incluyen
 */
function sanitizeMountainLog(log: MountainLog, includeImages: boolean): MountainLog {
  if (includeImages) {
    return log // Incluir todo
  }

  // Remover base64 de imágenes, mantener solo metadata
  const sanitizedLog: MountainLog = {
    ...log,
    milestones: log.milestones.map(milestone => ({
      ...milestone,
      images: milestone.images.map((img: MountainLogImage) => ({
        id: img.id,
        // data y thumbnail se remueven (solo metadata)
        metadata: img.metadata,
        description: img.description,
        tags: img.tags,
      })) as MountainLogImage[],
    })),
    // También sanitizar imágenes legacy si existen
    images: log.images?.map((img: MountainLogImage) => ({
      id: img.id,
      metadata: img.metadata,
      description: img.description,
      tags: img.tags,
    })) as MountainLogImage[] || [],
  }

  return sanitizedLog
}

/**
 * Sanitiza un documento removiendo base64 del PDF si no se incluye.
 * No elimina chat del agente, bitácora de fuentes (researchEvidenceLog), HTML del editor ni adjuntos en el chat.
 */
function sanitizeDocument(doc: Document, includePDFs: boolean): Document {
  if (includePDFs) {
    return doc // Incluir todo
  }

  // Remover base64 del PDF, mantener solo metadata y hash
  const sanitizedDoc: Document = {
    ...doc,
    pdf: undefined, // Remover base64 del PDF
    // Mantener pdfHash y pdfSize para referencia
    versions: doc.versions?.map(version => ({
      ...version,
      pdf: undefined, // Remover base64 de versiones también
    })),
  }

  return sanitizedDoc
}

function sanitizeAutographicSignature(
  sig: AutographicSignature,
  includeImage: boolean
): AutographicSignature {
  if (includeImage) return sig
  return {
    ...sig,
    signatureImage: '',
  }
}

/**
 * Exporta todos los datos de la aplicación a un objeto JSON
 * @param options Opciones de exportación
 */
export async function exportBackup(options: {
  includeImages?: boolean // Si incluir imágenes completas (base64) en bitácoras
  includePDFs?: boolean // Si incluir PDFs completos (base64) en documentos
  includeAutographicSignatures?: boolean // Base64 de firmas autográficas (pesado)
} = {}): Promise<BackupData> {
  const {
    includeImages = false,
    includePDFs = false,
    includeAutographicSignatures = false,
  } = options
  console.log('[Backup] Iniciando exportación de datos...')

  // 1. Obtener cuentas encriptadas de IndexedDB
  const accounts: EncryptedAccount[] = []
  try {
    const db = await openSharedDB()
    const transaction = db.transaction(['encrypted-accounts'], 'readonly')
    const store = transaction.objectStore('encrypted-accounts')
    const request = store.getAll()

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result as EncryptedAccount[]
        accounts.push(...results)
        console.log(`[Backup] ✅ ${results.length} cuenta(s) encontrada(s) en IndexedDB`)
        // Esperar a que la transacción se complete
      }
      request.onerror = () => {
        const error = request.error || new Error('Error al leer cuentas')
        console.error('[Backup] ❌ Error al leer cuentas:', error)
        reject(error)
      }
      
      // Esperar a que la transacción se complete para asegurar que los datos estén disponibles
      transaction.oncomplete = () => {
        console.log(`[Backup] ✅ Transacción completada - ${accounts.length} cuenta(s) exportada(s)`)
        resolve()
      }
      
      transaction.onerror = () => {
        const error = transaction.error || request.error || new Error('Error en la transacción')
        console.error('[Backup] ❌ Error en transacción al leer cuentas:', error)
        reject(error)
      }
    })
  } catch (error) {
    console.error('[Backup] ❌ Error al acceder a cuentas:', error)
    throw error
  }

  // 2. Obtener credenciales WebAuthn de IndexedDB
  const webauthnCredentials: WebAuthnCredential[] = []
  try {
    const db = await openSharedDB()
    const transaction = db.transaction(['webauthn-credentials'], 'readonly')
    const store = transaction.objectStore('webauthn-credentials')
    const request = store.getAll()

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result as WebAuthnCredential[]
        webauthnCredentials.push(...results)
        console.log(`[Backup] ✅ ${results.length} credencial(es) WebAuthn exportada(s)`)
        resolve()
      }
      request.onerror = () => {
        const error = request.error || new Error('Error al leer credenciales WebAuthn')
        console.error('[Backup] ❌ Error al leer credenciales WebAuthn:', error)
        reject(error)
      }
    })
  } catch (error) {
    console.error('[Backup] ❌ Error al acceder a credenciales WebAuthn:', error)
    // No fallar si no hay credenciales WebAuthn
  }

  // 3. Obtener transacciones de IndexedDB
  const transactions: StoredTransaction[] = []
  try {
    const db = await openSharedDB()
    const transaction = db.transaction(['transactions'], 'readonly')
    const store = transaction.objectStore('transactions')
    const request = store.getAll()

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result as StoredTransaction[]
        transactions.push(...results)
        console.log(`[Backup] ✅ ${results.length} transacción(es) exportada(s)`)
        resolve()
      }
      request.onerror = () => {
        const error = request.error || new Error('Error al leer transacciones')
        console.error('[Backup] ❌ Error al leer transacciones:', error)
        reject(error)
      }
    })
  } catch (error) {
    console.error('[Backup] ❌ Error al acceder a transacciones:', error)
    // No fallar si no hay transacciones
  }

  // 4. Obtener contactos de localStorage
  const contacts: any[] = []
  try {
    const stored = localStorage.getItem(CONTACTS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_CONTACTS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      contacts.push(...(Array.isArray(parsed) ? parsed : []))
      console.log(`[Backup] ✅ ${contacts.length} contacto(s) exportado(s)`)
    }
  } catch (error) {
    console.error('[Backup] ❌ Error al leer contactos:', error)
    // No fallar si no hay contactos
  }

  // 5. Obtener configuraciones de API de localStorage
  const apiConfigs: any[] = []
  try {
    const stored =
      localStorage.getItem(API_CONFIGS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_API_CONFIGS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      apiConfigs.push(...(Array.isArray(parsed) ? parsed : []))
      console.log(`[Backup] ✅ ${apiConfigs.length} configuración(es) de API exportada(s)`)
    }
  } catch (error) {
    console.error('[Backup] ❌ Error al leer configuraciones de API:', error)
    // No fallar si no hay configuraciones
  }

  // 6. Obtener bitácoras de montañismo de IndexedDB
  const mountainLogs: MountainLog[] = []
  try {
    const db = await openSharedDB()
    const transaction = db.transaction(['mountain-logs'], 'readonly')
    const store = transaction.objectStore('mountain-logs')
    const request = store.getAll()

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result as MountainLog[]
        // Sanitizar bitácoras: remover base64 de imágenes si no se incluyen
        const sanitizedLogs = results.map(log => sanitizeMountainLog(log, includeImages))
        mountainLogs.push(...sanitizedLogs)
        console.log(`[Backup] ✅ ${results.length} bitácora(s) exportada(s)`)
        resolve()
      }
      request.onerror = () => {
        const error = request.error || new Error('Error al leer bitácoras')
        console.error('[Backup] ❌ Error al leer bitácoras:', error)
        reject(error)
      }
    })
  } catch (error) {
    console.error('[Backup] ❌ Error al acceder a bitácoras:', error)
    // No fallar si no hay bitácoras
  }

  // 7. Obtener documentos de IndexedDB
  const documents: Document[] = []
  try {
    const db = await openSharedDB()
    const transaction = db.transaction(['documents'], 'readonly')
    const store = transaction.objectStore('documents')
    const request = store.getAll()

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result as Document[]
        // Sanitizar documentos: remover base64 de PDFs si no se incluyen
        const sanitizedDocs = results.map(doc => sanitizeDocument(doc, includePDFs))
        documents.push(...sanitizedDocs)
        console.log(`[Backup] ✅ ${results.length} documento(s) exportado(s)`)
        resolve()
      }
      request.onerror = () => {
        const error = request.error || new Error('Error al leer documentos')
        console.error('[Backup] ❌ Error al leer documentos:', error)
        reject(error)
      }
    })
  } catch (error) {
    console.error('[Backup] ❌ Error al acceder a documentos:', error)
    // No fallar si no hay documentos
  }

  // 8. Configuraciones de API externa (IndexedDB; distinto de apiConfigs en localStorage)
  const externalApiConfigs: ExternalAPIConfig[] = []
  try {
    const db = await openSharedDB()
    const transaction = db.transaction(['external-api-configs'], 'readonly')
    const store = transaction.objectStore('external-api-configs')
    const request = store.getAll()
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        externalApiConfigs.push(...((request.result as ExternalAPIConfig[]) || []))
        console.log(`[Backup] ✅ ${externalApiConfigs.length} config(s) API externa exportada(s)`)
        resolve()
      }
      request.onerror = () => {
        console.error('[Backup] ❌ Error al leer external-api-configs:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Backup] ❌ Error al acceder a external-api-configs:', error)
  }

  // 9. Cola de documentos (offline / pendientes)
  const documentQueue: DocumentQueueItem[] = []
  try {
    const db = await openSharedDB()
    const transaction = db.transaction(['document-queue'], 'readonly')
    const store = transaction.objectStore('document-queue')
    const request = store.getAll()
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        documentQueue.push(...((request.result as DocumentQueueItem[]) || []))
        console.log(`[Backup] ✅ ${documentQueue.length} elemento(s) de cola exportado(s)`)
        resolve()
      }
      request.onerror = () => {
        console.error('[Backup] ❌ Error al leer document-queue:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Backup] ❌ Error al acceder a document-queue:', error)
  }

  // 10. Firmas autográficas (base64 opcional)
  const autographicSignatures: AutographicSignature[] = []
  try {
    const db = await openSharedDB()
    const transaction = db.transaction(['autographic-signatures'], 'readonly')
    const store = transaction.objectStore('autographic-signatures')
    const request = store.getAll()
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const raw = (request.result as AutographicSignature[]) || []
        autographicSignatures.push(
          ...raw.map(s => sanitizeAutographicSignature(s, includeAutographicSignatures))
        )
        console.log(`[Backup] ✅ ${autographicSignatures.length} firma(s) autográfica(s) exportada(s)`)
        resolve()
      }
      request.onerror = () => {
        console.error('[Backup] ❌ Error al leer autographic-signatures:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Backup] ❌ Error al acceder a autographic-signatures:', error)
  }

  // 11. Emergencias (montañismo / Lumo)
  const emergencies: Emergency[] = []
  try {
    const db = await openSharedDB()
    const transaction = db.transaction(['emergencies'], 'readonly')
    const store = transaction.objectStore('emergencies')
    const request = store.getAll()
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        emergencies.push(...((request.result as Emergency[]) || []))
        console.log(`[Backup] ✅ ${emergencies.length} emergencia(s) exportada(s)`)
        resolve()
      }
      request.onerror = () => {
        console.error('[Backup] ❌ Error al leer emergencies:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Backup] ❌ Error al acceder a emergencies:', error)
  }

  const backup: BackupData = {
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    accounts,
    webauthnCredentials,
    transactions,
    contacts,
    apiConfigs,
    mountainLogs: mountainLogs.length > 0 ? mountainLogs : undefined,
    documents: documents.length > 0 ? documents : undefined,
    externalApiConfigs: externalApiConfigs.length > 0 ? externalApiConfigs : undefined,
    documentQueue: documentQueue.length > 0 ? documentQueue : undefined,
    autographicSignatures: autographicSignatures.length > 0 ? autographicSignatures : undefined,
    emergencies: emergencies.length > 0 ? emergencies : undefined,
    metadata: {
      appName: 'CriterIA',
      description: 'Backup de datos de CriterIA',
      includesImages: includeImages,
      includesPDFs: includePDFs,
      includesAutographicSignatures,
    },
  }

  console.log('[Backup] ✅ Exportación completada')
  return backup
}

/**
 * Descarga el backup como archivo JSON
 * En dispositivos móviles, intenta usar la Share API primero
 * @param options Opciones de exportación
 */
export async function downloadBackup(options: {
  includeImages?: boolean
  includePDFs?: boolean
  includeAutographicSignatures?: boolean
} = {}): Promise<void> {
  try {
    console.log('[Backup] Iniciando exportación...')
    const backup = await exportBackup(options)
    console.log('[Backup] Exportación completada, creando archivo...')
    
    const json = JSON.stringify(backup, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const filename = `aura-wallet-backup-${new Date().toISOString().split('T')[0]}.json`
    
    console.log('[Backup] Blob creado, tamaño:', blob.size, 'bytes')
    
    // Intentar usar Share API en dispositivos móviles (iOS/Android)
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: 'application/json' })
        
        // Verificar si podemos compartir el archivo
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'CriterIA Backup',
            text: 'Respaldo de mi wallet CriterIA',
          })
          console.log('[Backup] ✅ Backup compartido usando Share API')
          return
        }
      } catch (shareError) {
        // Si falla Share API, continuar con el método tradicional
        console.log('[Backup] Share API no disponible o falló, usando método tradicional:', shareError)
      }
    }
    
    // Método tradicional: crear link de descarga
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    // Agregar atributos para mejor compatibilidad en móviles
    link.setAttribute('download', filename)
    link.setAttribute('target', '_blank')
    
    document.body.appendChild(link)
    console.log('[Backup] Link agregado al DOM, iniciando descarga...')
    
    // En dispositivos móviles, puede que necesitemos un pequeño delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Intentar click programático
    link.click()
    
    // En algunos navegadores móviles, necesitamos un enfoque diferente
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      // iOS: abrir en nueva ventana
      window.open(url, '_blank')
    }
    
    // Esperar un momento antes de limpiar
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link)
      }
      URL.revokeObjectURL(url)
      console.log('[Backup] ✅ Archivo descargado y recursos liberados')
    }, 2000)
    
    // Verificar si estamos en un entorno que soporta descargas
    if (typeof window !== 'undefined' && 'download' in document.createElement('a')) {
      console.log('[Backup] ✅ Navegador soporta descargas')
    } else {
      console.warn('[Backup] ⚠️ El navegador puede no soportar descargas automáticas')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[Backup] ❌ Error al descargar backup:', error)
    console.error('[Backup] Detalles del error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    throw new Error(`Error al descargar backup: ${errorMessage}`)
  }
}

/**
 * Lee un archivo de backup desde un input de archivo
 */
export function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = JSON.parse(text)
        
        // Verificar si es un backup de Polkadot.js (tiene 'encoded' y 'accounts' array)
        // Si es así, no es un backup de CriterIA, rechazarlo con un mensaje apropiado
        if (parsed.encoded && Array.isArray(parsed.accounts) && parsed.encoding) {
          throw new Error('Este es un archivo de backup de Polkadot.js. Por favor, usa la opción "Importar Cuenta" > "Archivo JSON" para importarlo.')
        }
        
        const backup = parsed as BackupData
        
        // Validar estructura básica
        if (!backup.version || !backup.createdAt) {
          throw new Error('El archivo de backup no es válido: falta información de versión o fecha')
        }
        
        // Validar que tenga arrays (pueden estar vacíos)
        if (!Array.isArray(backup.accounts)) {
          backup.accounts = []
        }
        if (!Array.isArray(backup.webauthnCredentials)) {
          backup.webauthnCredentials = []
        }
        if (!Array.isArray(backup.transactions)) {
          backup.transactions = []
        }
        if (!Array.isArray(backup.contacts)) {
          backup.contacts = []
        }
        if (!Array.isArray(backup.apiConfigs)) {
          backup.apiConfigs = []
        }
        // Bitácoras y documentos son opcionales (nuevos en v1.1.0)
        if (backup.mountainLogs && !Array.isArray(backup.mountainLogs)) {
          backup.mountainLogs = []
        }
        if (backup.documents && !Array.isArray(backup.documents)) {
          backup.documents = []
        }
        if (backup.externalApiConfigs && !Array.isArray(backup.externalApiConfigs)) {
          backup.externalApiConfigs = []
        }
        if (backup.documentQueue && !Array.isArray(backup.documentQueue)) {
          backup.documentQueue = []
        }
        if (backup.autographicSignatures && !Array.isArray(backup.autographicSignatures)) {
          backup.autographicSignatures = []
        }
        if (backup.emergencies && !Array.isArray(backup.emergencies)) {
          backup.emergencies = []
        }
        
        console.log('[Backup] ✅ Archivo de backup leído y validado')
        resolve(backup)
      } catch (error) {
        console.error('[Backup] ❌ Error al leer archivo de backup:', error)
        reject(new Error('El archivo de backup no es válido o está corrupto'))
      }
    }
    reader.onerror = () => {
      const error = new Error('Error al leer el archivo')
      console.error('[Backup] ❌', error)
      reject(error)
    }
    reader.readAsText(file)
  })
}

/**
 * Importa datos desde un backup
 * @param backup Datos del backup a importar
 * @param options Opciones de importación
 */
export async function importBackup(
  backup: BackupData,
  options: {
    overwriteAccounts?: boolean
    overwriteContacts?: boolean
    overwriteApiConfigs?: boolean
    overwriteWebAuthn?: boolean
    overwriteMountainLogs?: boolean
    overwriteDocuments?: boolean
    overwriteTransactions?: boolean
    overwriteExternalApiConfigs?: boolean
    overwriteDocumentQueue?: boolean
    overwriteAutographicSignatures?: boolean
    overwriteEmergencies?: boolean
  } = {}
): Promise<{
  accountsImported: number
  contactsImported: number
  apiConfigsImported: number
  webauthnImported: number
  transactionsImported: number
  mountainLogsImported: number
  documentsImported: number
  externalApiConfigsImported: number
  documentQueueImported: number
  autographicSignaturesImported: number
  emergenciesImported: number
  errors: string[]
}> {
  console.log('[Backup] Iniciando importación de datos...')
  const errors: string[] = []
  let accountsImported = 0
  let contactsImported = 0
  let apiConfigsImported = 0
  let webauthnImported = 0
  let transactionsImported = 0
  let mountainLogsImported = 0
  let documentsImported = 0
  let externalApiConfigsImported = 0
  let documentQueueImported = 0
  let autographicSignaturesImported = 0
  let emergenciesImported = 0

  // 1. Importar cuentas
  if (backup.accounts && backup.accounts.length > 0) {
    try {
      console.log(`[Backup] Importando ${backup.accounts.length} cuenta(s)...`)
      const db = await openSharedDB()
      const transaction = db.transaction(['encrypted-accounts'], 'readwrite')
      const store = transaction.objectStore('encrypted-accounts')

      // Importar cuentas una por una dentro de la transacción
      // (IndexedDB requiere que las operaciones se completen antes de que la transacción termine)
      for (const account of backup.accounts) {
        try {
          // Verificar si la cuenta ya existe
          const existingRequest = store.get(account.address)
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn(`[Backup] ⚠️ Timeout verificando cuenta ${account.address}`)
              resolve()
            }, 5000)

            existingRequest.onsuccess = () => {
              clearTimeout(timeout)
              const exists = existingRequest.result !== undefined
              if (exists && !options.overwriteAccounts) {
                console.log(`[Backup] ⚠️ Cuenta ${account.address} ya existe, omitiendo`)
                resolve()
                return
              }

              const putRequest = store.put(account)
              putRequest.onsuccess = () => {
                accountsImported++
                console.log(`[Backup] ✅ Cuenta importada: ${account.address}`)
                resolve()
              }
              putRequest.onerror = () => {
                const error = putRequest.error || new Error('Error al importar cuenta')
                errors.push(`Error al importar cuenta ${account.address}: ${error.message}`)
                console.error('[Backup] ❌', error)
                resolve() // Continuar con las siguientes
              }
            }
            
            existingRequest.onerror = () => {
              clearTimeout(timeout)
              const error = existingRequest.error || new Error('Error al verificar cuenta')
              errors.push(`Error al verificar cuenta ${account.address}: ${error.message}`)
              console.error('[Backup] ❌', error)
              resolve() // Continuar con las siguientes
            }
          })
        } catch (error) {
          errors.push(`Error al importar cuenta ${account.address}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      
      console.log(`[Backup] ✅ ${accountsImported} cuenta(s) procesada(s) de ${backup.accounts.length}`)

      // Esperar a que la transacción se complete completamente
      await new Promise<void>((resolve) => {
        // Timeout de seguridad para evitar que se quede colgado
        const timeout = setTimeout(() => {
          console.warn('[Backup] ⚠️ Timeout esperando transacción de cuentas')
          resolve()
        }, 10000) // 10 segundos

        transaction.oncomplete = () => {
          clearTimeout(timeout)
          console.log('[Backup] ✅ Transacción de cuentas completada')
          // Esperar un momento adicional para asegurar que IndexedDB se haya actualizado
          setTimeout(() => {
            resolve()
          }, 100)
        }
        transaction.onerror = () => {
          clearTimeout(timeout)
          const error = transaction.error || new Error('Error en la transacción de cuentas')
          errors.push(`Error en la transacción de cuentas: ${error.message}`)
          console.error('[Backup] ❌ Error en transacción de cuentas:', error)
          resolve()
        }
      })
      
      // Verificar que las cuentas se guardaron correctamente
      if (accountsImported > 0) {
        try {
          const db = await openSharedDB()
          const verifyTransaction = db.transaction(['encrypted-accounts'], 'readonly')
          const verifyStore = verifyTransaction.objectStore('encrypted-accounts')
          const verifyRequest = verifyStore.count()
          
          await new Promise<void>((resolve) => {
            verifyRequest.onsuccess = () => {
              const count = verifyRequest.result
              console.log(`[Backup] ✅ Verificación: ${count} cuenta(s) en IndexedDB después de importación`)
              resolve()
            }
            verifyRequest.onerror = () => {
              console.warn('[Backup] ⚠️ No se pudo verificar el conteo de cuentas')
              resolve()
            }
          })
        } catch (error) {
          console.warn('[Backup] ⚠️ Error al verificar cuentas importadas:', error)
        }
      }
    } catch (error) {
      errors.push(`Error al importar cuentas: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 2. Importar credenciales WebAuthn
  if (backup.webauthnCredentials && backup.webauthnCredentials.length > 0) {
    try {
      const db = await openSharedDB()
      const transaction = db.transaction(['webauthn-credentials'], 'readwrite')
      const store = transaction.objectStore('webauthn-credentials')

      for (const credential of backup.webauthnCredentials) {
        try {
          const existingRequest = store.get(credential.id)
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              console.warn(`[Backup] ⚠️ Timeout verificando credencial WebAuthn ${credential.id}`)
              resolve()
            }, 5000)

            existingRequest.onsuccess = () => {
              clearTimeout(timeout)
              const exists = existingRequest.result !== undefined
              if (exists && !options.overwriteWebAuthn) {
                console.log(`[Backup] ⚠️ Credencial WebAuthn ${credential.id} ya existe, omitiendo`)
                resolve()
                return
              }

              const putRequest = store.put(credential)
              putRequest.onsuccess = () => {
                webauthnImported++
                console.log(`[Backup] ✅ Credencial WebAuthn importada: ${credential.id}`)
                resolve()
              }
              putRequest.onerror = () => {
                const error = putRequest.error || new Error('Error al importar credencial WebAuthn')
                errors.push(`Error al importar credencial WebAuthn ${credential.id}: ${error.message}`)
                console.error('[Backup] ❌', error)
                resolve()
              }
            }
            existingRequest.onerror = () => {
              clearTimeout(timeout)
              errors.push(`Error al verificar credencial WebAuthn ${credential.id}`)
              resolve()
            }
          })
        } catch (error) {
          errors.push(`Error al importar credencial WebAuthn ${credential.id}`)
        }
      }
      
      console.log(`[Backup] ✅ ${webauthnImported} credencial(es) WebAuthn procesada(s) de ${backup.webauthnCredentials.length}`)

      await new Promise<void>((resolve) => {
        // Timeout de seguridad
        const timeout = setTimeout(() => {
          console.warn('[Backup] ⚠️ Timeout esperando transacción de WebAuthn')
          resolve()
        }, 10000)

        transaction.oncomplete = () => {
          clearTimeout(timeout)
          console.log('[Backup] ✅ Transacción de WebAuthn completada')
          resolve()
        }
        transaction.onerror = () => {
          clearTimeout(timeout)
          const error = transaction.error || new Error('Error en la transacción de credenciales WebAuthn')
          errors.push(`Error en la transacción de credenciales WebAuthn: ${error.message}`)
          console.error('[Backup] ❌ Error en transacción de WebAuthn:', error)
          resolve()
        }
      })
    } catch (error) {
      errors.push(`Error al importar credenciales WebAuthn: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 3. Importar contactos
  if (backup.contacts && backup.contacts.length > 0) {
    try {
      const existing = localStorage.getItem(CONTACTS_STORAGE_KEY)
      let existingContacts: any[] = []
      
      if (existing && !options.overwriteContacts) {
        try {
          existingContacts = JSON.parse(existing)
        } catch (e) {
          // Si hay error, empezar de cero
        }
      }

      // Combinar contactos (evitar duplicados por ID)
      const contactMap = new Map<string, any>()
      existingContacts.forEach((c: any) => contactMap.set(c.id, c))
      backup.contacts.forEach((c: any) => {
        if (!contactMap.has(c.id) || options.overwriteContacts) {
          contactMap.set(c.id, c)
        }
      })

      const mergedContacts = Array.from(contactMap.values())
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(mergedContacts))
      contactsImported = mergedContacts.length - (options.overwriteContacts ? 0 : existingContacts.length)
      console.log(`[Backup] ✅ ${contactsImported} contacto(s) importado(s)`)
    } catch (error) {
      errors.push(`Error al importar contactos: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 4. Importar configuraciones de API
  if (backup.apiConfigs && backup.apiConfigs.length > 0) {
    try {
      const existing = localStorage.getItem(API_CONFIGS_STORAGE_KEY)
      let existingConfigs: any[] = []
      
      if (existing && !options.overwriteApiConfigs) {
        try {
          existingConfigs = JSON.parse(existing)
        } catch (e) {
          // Si hay error, empezar de cero
        }
      }

      // Combinar configuraciones (evitar duplicados por ID)
      const configMap = new Map<string, any>()
      existingConfigs.forEach((c: any) => configMap.set(c.id, c))
      backup.apiConfigs.forEach((c: any) => {
        if (!configMap.has(c.id) || options.overwriteApiConfigs) {
          configMap.set(c.id, c)
        }
      })

      const mergedConfigs = Array.from(configMap.values())
      localStorage.setItem(API_CONFIGS_STORAGE_KEY, JSON.stringify(mergedConfigs))
      apiConfigsImported = mergedConfigs.length - (options.overwriteApiConfigs ? 0 : existingConfigs.length)
      console.log(`[Backup] ✅ ${apiConfigsImported} configuración(es) de API importada(s)`)
    } catch (error) {
      errors.push(`Error al importar configuraciones de API: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 5. Importar transacciones
  if (backup.transactions && backup.transactions.length > 0) {
    try {
      console.log(`[Backup] Importando ${backup.transactions.length} transacción(es)...`)
      const db = await openSharedDB()
      const transaction = db.transaction(['transactions'], 'readwrite')
      const store = transaction.objectStore('transactions')

      for (const tx of backup.transactions) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[Backup] ⚠️ Timeout verificando transacción ${tx.id}`)
            resolve()
          }, 5000)

          try {
            const existingRequest = store.get(tx.id)
            existingRequest.onsuccess = () => {
              clearTimeout(timeout)
              const exists = existingRequest.result !== undefined
              if (exists && !options.overwriteTransactions) {
                console.log(`[Backup] ⚠️ Transacción ${tx.id} ya existe, omitiendo`)
                resolve()
                return
              }

              const putRequest = store.put(tx)
              putRequest.onsuccess = () => {
                transactionsImported++
                console.log(`[Backup] ✅ Transacción importada: ${tx.id}`)
                resolve()
              }
              putRequest.onerror = () => {
                const error = putRequest.error || new Error('Error al importar transacción')
                errors.push(`Error al importar transacción ${tx.id}: ${error.message}`)
                console.error('[Backup] ❌', error)
                resolve()
              }
            }
            existingRequest.onerror = () => {
              clearTimeout(timeout)
              errors.push(`Error al verificar transacción ${tx.id}`)
              resolve()
            }
          } catch (error) {
            errors.push(`Error al procesar transacción ${tx.id}`)
            clearTimeout(timeout)
            resolve()
          }
        })
      }
      
      console.log(`[Backup] ✅ ${transactionsImported} transacción(es) procesada(s) de ${backup.transactions.length}`)

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[Backup] ⚠️ Timeout esperando transacción de transacciones')
          resolve()
        }, 10000)

        transaction.oncomplete = () => {
          clearTimeout(timeout)
          console.log('[Backup] ✅ Transacción de transacciones completada')
          resolve()
        }
        transaction.onerror = () => {
          clearTimeout(timeout)
          const error = transaction.error || new Error('Error en la transacción de transacciones')
          errors.push(`Error en la transacción de transacciones: ${error.message}`)
          console.error('[Backup] ❌ Error en transacción de transacciones:', error)
          resolve()
        }
      })
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      errors.push(`Error al importar transacciones: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 6. Importar bitácoras de montañismo
  if (backup.mountainLogs && backup.mountainLogs.length > 0) {
    try {
      console.log(`[Backup] Importando ${backup.mountainLogs.length} bitácora(s)...`)
      const db = await openSharedDB()
      const transaction = db.transaction(['mountain-logs'], 'readwrite')
      const store = transaction.objectStore('mountain-logs')

      for (const log of backup.mountainLogs) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[Backup] ⚠️ Timeout verificando bitácora ${log.logId}`)
            resolve()
          }, 5000)

          try {
            const existingRequest = store.get(log.logId)
            existingRequest.onsuccess = () => {
              clearTimeout(timeout)
              const exists = existingRequest.result !== undefined
              if (exists && !options.overwriteMountainLogs) {
                console.log(`[Backup] ⚠️ Bitácora ${log.logId} ya existe, omitiendo`)
                resolve()
                return
              }

              // Asegurar que updatedAt esté actualizado
              const logToSave = {
                ...log,
                updatedAt: Date.now(),
              }

              const putRequest = store.put(logToSave)
              putRequest.onsuccess = () => {
                mountainLogsImported++
                console.log(`[Backup] ✅ Bitácora importada: ${log.logId}`)
                resolve()
              }
              putRequest.onerror = () => {
                const error = putRequest.error || new Error('Error al importar bitácora')
                errors.push(`Error al importar bitácora ${log.logId}: ${error.message}`)
                console.error('[Backup] ❌', error)
                resolve()
              }
            }
            existingRequest.onerror = () => {
              clearTimeout(timeout)
              errors.push(`Error al verificar bitácora ${log.logId}`)
              resolve()
            }
          } catch (error) {
            errors.push(`Error al procesar bitácora ${log.logId}`)
            clearTimeout(timeout)
            resolve()
          }
        })
      }

      console.log(`[Backup] ✅ ${mountainLogsImported} bitácora(s) procesada(s) de ${backup.mountainLogs.length}`)

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[Backup] ⚠️ Timeout esperando transacción de bitácoras')
          resolve()
        }, 10000)

        transaction.oncomplete = () => {
          clearTimeout(timeout)
          console.log('[Backup] ✅ Transacción de bitácoras completada')
          resolve()
        }
        transaction.onerror = () => {
          clearTimeout(timeout)
          const error = transaction.error || new Error('Error en la transacción de bitácoras')
          errors.push(`Error en la transacción de bitácoras: ${error.message}`)
          console.error('[Backup] ❌ Error en transacción de bitácoras:', error)
          resolve()
        }
      })
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      errors.push(`Error al importar bitácoras: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 7. Importar documentos
  if (backup.documents && backup.documents.length > 0) {
    try {
      console.log(`[Backup] Importando ${backup.documents.length} documento(s)...`)
      const db = await openSharedDB()
      const transaction = db.transaction(['documents'], 'readwrite')
      const store = transaction.objectStore('documents')

      for (const doc of backup.documents) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[Backup] ⚠️ Timeout verificando documento ${doc.documentId}`)
            resolve()
          }, 5000)

          try {
            const existingRequest = store.get(doc.documentId)
            existingRequest.onsuccess = () => {
              clearTimeout(timeout)
              const exists = existingRequest.result !== undefined
              if (exists && !options.overwriteDocuments) {
                console.log(`[Backup] ⚠️ Documento ${doc.documentId} ya existe, omitiendo`)
                resolve()
                return
              }

              const putRequest = store.put(doc)
              putRequest.onsuccess = () => {
                documentsImported++
                console.log(`[Backup] ✅ Documento importado: ${doc.documentId}`)
                resolve()
              }
              putRequest.onerror = () => {
                const error = putRequest.error || new Error('Error al importar documento')
                errors.push(`Error al importar documento ${doc.documentId}: ${error.message}`)
                console.error('[Backup] ❌', error)
                resolve()
              }
            }
            existingRequest.onerror = () => {
              clearTimeout(timeout)
              errors.push(`Error al verificar documento ${doc.documentId}`)
              resolve()
            }
          } catch (error) {
            errors.push(`Error al procesar documento ${doc.documentId}`)
            clearTimeout(timeout)
            resolve()
          }
        })
      }

      console.log(`[Backup] ✅ ${documentsImported} documento(s) procesado(s) de ${backup.documents.length}`)

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[Backup] ⚠️ Timeout esperando transacción de documentos')
          resolve()
        }, 10000)

        transaction.oncomplete = () => {
          clearTimeout(timeout)
          console.log('[Backup] ✅ Transacción de documentos completada')
          resolve()
        }
        transaction.onerror = () => {
          clearTimeout(timeout)
          const error = transaction.error || new Error('Error en la transacción de documentos')
          errors.push(`Error en la transacción de documentos: ${error.message}`)
          console.error('[Backup] ❌ Error en transacción de documentos:', error)
          resolve()
        }
      })
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      errors.push(`Error al importar documentos: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 8. Importar configuraciones de API externa (IndexedDB)
  if (backup.externalApiConfigs && backup.externalApiConfigs.length > 0) {
    try {
      console.log(`[Backup] Importando ${backup.externalApiConfigs.length} config(s) de API externa...`)
      const db = await openSharedDB()
      const transaction = db.transaction(['external-api-configs'], 'readwrite')
      const store = transaction.objectStore('external-api-configs')

      for (const cfg of backup.externalApiConfigs) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[Backup] ⚠️ Timeout verificando external API ${cfg.apiId}`)
            resolve()
          }, 5000)
          try {
            const existingRequest = store.get(cfg.apiId)
            existingRequest.onsuccess = () => {
              clearTimeout(timeout)
              const exists = existingRequest.result !== undefined
              if (exists && !options.overwriteExternalApiConfigs) {
                console.log(`[Backup] ⚠️ External API ${cfg.apiId} ya existe, omitiendo`)
                resolve()
                return
              }
              const putRequest = store.put(cfg)
              putRequest.onsuccess = () => {
                externalApiConfigsImported++
                console.log(`[Backup] ✅ External API importada: ${cfg.apiId}`)
                resolve()
              }
              putRequest.onerror = () => {
                const err = putRequest.error || new Error('put')
                errors.push(`Error al importar external API ${cfg.apiId}: ${err.message}`)
                resolve()
              }
            }
            existingRequest.onerror = () => {
              clearTimeout(timeout)
              errors.push(`Error al verificar external API ${cfg.apiId}`)
              resolve()
            }
          } catch {
            clearTimeout(timeout)
            resolve()
          }
        })
      }

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 10000)
        transaction.oncomplete = () => {
          clearTimeout(timeout)
          resolve()
        }
        transaction.onerror = () => {
          clearTimeout(timeout)
          errors.push(`Error en transacción external-api-configs: ${transaction.error?.message || ''}`)
          resolve()
        }
      })
      await new Promise(r => setTimeout(r, 100))
    } catch (error) {
      errors.push(`Error al importar external-api-configs: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 9. Cola de documentos
  if (backup.documentQueue && backup.documentQueue.length > 0) {
    try {
      console.log(`[Backup] Importando ${backup.documentQueue.length} elemento(s) de cola...`)
      const db = await openSharedDB()
      const transaction = db.transaction(['document-queue'], 'readwrite')
      const store = transaction.objectStore('document-queue')

      for (const item of backup.documentQueue) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[Backup] ⚠️ Timeout verificando cola ${item.id}`)
            resolve()
          }, 5000)
          try {
            const existingRequest = store.get(item.id)
            existingRequest.onsuccess = () => {
              clearTimeout(timeout)
              const exists = existingRequest.result !== undefined
              if (exists && !options.overwriteDocumentQueue) {
                resolve()
                return
              }
              const putRequest = store.put(item)
              putRequest.onsuccess = () => {
                documentQueueImported++
                resolve()
              }
              putRequest.onerror = () => {
                errors.push(`Error al importar cola ${item.id}: ${putRequest.error?.message || ''}`)
                resolve()
              }
            }
            existingRequest.onerror = () => {
              clearTimeout(timeout)
              resolve()
            }
          } catch {
            clearTimeout(timeout)
            resolve()
          }
        })
      }

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 10000)
        transaction.oncomplete = () => {
          clearTimeout(timeout)
          resolve()
        }
        transaction.onerror = () => {
          clearTimeout(timeout)
          errors.push(`Error en transacción document-queue: ${transaction.error?.message || ''}`)
          resolve()
        }
      })
      await new Promise(r => setTimeout(r, 100))
    } catch (error) {
      errors.push(`Error al importar document-queue: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 10. Firmas autográficas
  if (backup.autographicSignatures && backup.autographicSignatures.length > 0) {
    try {
      console.log(`[Backup] Importando ${backup.autographicSignatures.length} firma(s) autográfica(s)...`)
      const db = await openSharedDB()
      const transaction = db.transaction(['autographic-signatures'], 'readwrite')
      const store = transaction.objectStore('autographic-signatures')

      for (const sig of backup.autographicSignatures) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 5000)
          try {
            const existingRequest = store.get(sig.accountAddress)
            existingRequest.onsuccess = () => {
              clearTimeout(timeout)
              const exists = existingRequest.result !== undefined
              if (exists && !options.overwriteAutographicSignatures) {
                resolve()
                return
              }
              const putRequest = store.put({
                ...sig,
                updatedAt: Date.now(),
              })
              putRequest.onsuccess = () => {
                autographicSignaturesImported++
                resolve()
              }
              putRequest.onerror = () => {
                errors.push(`Error al importar firma autográfica ${sig.accountAddress}`)
                resolve()
              }
            }
            existingRequest.onerror = () => {
              clearTimeout(timeout)
              resolve()
            }
          } catch {
            clearTimeout(timeout)
            resolve()
          }
        })
      }

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 10000)
        transaction.oncomplete = () => {
          clearTimeout(timeout)
          resolve()
        }
        transaction.onerror = () => {
          clearTimeout(timeout)
          errors.push(`Error en transacción autographic-signatures: ${transaction.error?.message || ''}`)
          resolve()
        }
      })
      await new Promise(r => setTimeout(r, 100))
    } catch (error) {
      errors.push(`Error al importar autographic-signatures: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 11. Emergencias
  if (backup.emergencies && backup.emergencies.length > 0) {
    try {
      console.log(`[Backup] Importando ${backup.emergencies.length} emergencia(s)...`)
      const db = await openSharedDB()
      const transaction = db.transaction(['emergencies'], 'readwrite')
      const store = transaction.objectStore('emergencies')

      for (const em of backup.emergencies) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 5000)
          try {
            const existingRequest = store.get(em.emergencyId)
            existingRequest.onsuccess = () => {
              clearTimeout(timeout)
              const exists = existingRequest.result !== undefined
              if (exists && !options.overwriteEmergencies) {
                resolve()
                return
              }
              const putRequest = store.put({ ...em, updatedAt: em.updatedAt ?? Date.now() })
              putRequest.onsuccess = () => {
                emergenciesImported++
                resolve()
              }
              putRequest.onerror = () => {
                errors.push(`Error al importar emergencia ${em.emergencyId}`)
                resolve()
              }
            }
            existingRequest.onerror = () => {
              clearTimeout(timeout)
              resolve()
            }
          } catch {
            clearTimeout(timeout)
            resolve()
          }
        })
      }

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 10000)
        transaction.oncomplete = () => {
          clearTimeout(timeout)
          resolve()
        }
        transaction.onerror = () => {
          clearTimeout(timeout)
          errors.push(`Error en transacción emergencies: ${transaction.error?.message || ''}`)
          resolve()
        }
      })
      await new Promise(r => setTimeout(r, 100))
    } catch (error) {
      errors.push(`Error al importar emergencies: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log('[Backup] ✅ Importación completada')
  return {
    accountsImported,
    contactsImported,
    apiConfigsImported,
    webauthnImported,
    transactionsImported,
    mountainLogsImported,
    documentsImported,
    externalApiConfigsImported,
    documentQueueImported,
    autographicSignaturesImported,
    emergenciesImported,
    errors,
  }
}

