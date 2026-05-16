/**
 * Tipos TypeScript para el sistema de documentos
 */

import type { PiiKind } from '@/services/privacy/piiTypes'

export type DocumentType = 'flight_log' | 'medical_record' | 'attestation' | 'contract' | 'generic' | 'mountain_log' | 'other'

export type SignatureStatus = 'pending' | 'partially_signed' | 'fully_signed' | 'expired' | 'rejected'

export type BatchOperation = 'sign' | 'verify' | 'encrypt' | 'export'

export type SignatureType = 'substrate' | 'x509' | 'autographic' | 'hybrid'

export interface DocumentSignature {
  // Identificación
  id: string                            // UUID de la firma
  type: SignatureType                   // Tipo de firma
  
  // Firma Substrate (Ed25519/sr25519)
  signer?: string                       // Dirección SS58 del firmante
  signature?: string                    // Firma en hex
  keyType?: 'sr25519' | 'ed25519' | 'ecdsa'
  
  // Firma X.509
  x509?: {
    certificate: string                 // Certificado en base64
    signature: string                   // Firma del PDF (si aplica)
    certificateInfo?: {
      subject: string
      issuer: string
      validFrom: string
      validTo: string
    }
  }
  
  // Firma Autográfica
  autographic?: {
    image: string                       // Imagen de la firma (base64 PNG)
    position: {
      page: number
      x: number                         // mm desde la izquierda
      y: number                         // mm desde arriba
      width?: number                    // mm
      height?: number                   // mm
    }
    capturedAt: number
    gpsMetadata?: GPSMetadata
  }
  
  // Metadata común
  timestamp: number                     // Timestamp de la firma
  hash: string                          // Hash del documento firmado
  valid?: boolean                       // Si la firma es válida (verificado)
  verifiedAt?: number                   // Cuándo se verificó
  metadata?: {
    reason?: string                     // Razón de la firma
    location?: string                   // Ubicación
    contactInfo?: string               // Información de contacto
    [key: string]: any
  }
}

export interface DocumentVersion {
  version: number
  pdfHash: string
  pdf?: string
  contentHtml?: string                // Contenido editable
  title?: string                      // Título en ese momento
  createdAt: number
  changes?: string                    // Descripción de cambios (ej: "Sugerencia de IA aplicada")
}

export interface EncryptionMetadata {
  iv: string                          // Initialization Vector (hex)
  salt: string                        // Salt usado (hex)
  iterations: number                  // Iteraciones PBKDF2
  keyDerivationMethod: 'PBKDF2' | 'HKDF'
}

/** Mapeo para restaurar texto o mostrar etiqueta en privacidad; el token sigue siendo el enviado a la IA. */
export interface PrivacyPlaceholderEntry {
  placeholder: string
  original: string
  /** Nombre descriptivo solo para la UI (no sustituye el token en el documento). */
  label?: string
  /** Tipo de patrón (opcional; se infiere del token si falta). */
  kind?: PiiKind
}

export interface DocumentMetadata {
  title?: string
  description?: string
  author?: string                      // Dirección del creador
  subject?: string
  keywords?: string[]
  /** Ámbito CriterIA para listados y filtros (Legal, Académico, Creador). */
  criteriaDomain?: 'legal' | 'academic' | 'creator'
  /** Etiquetas libres del usuario (normalizadas en minúsculas al guardar). */
  userTags?: string[]
  language?: string
  creator?: string                     // Aplicación que creó el documento
  producer?: string                    // Biblioteca PDF usada
  createdAt: string                   // ISO 8601
  modifiedAt?: string                 // ISO 8601
  /** Tamaño de hoja para editor y PDF (A4 por defecto). */
  paperFormat?: 'a4' | 'letter' | 'legal'
  [key: string]: any                  // Metadata adicional flexible
}

export interface GPSMetadata {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  timestamp: number
}

export interface ExternalSource {
  apiId: string                       // ID de la API externa
  externalId: string                  // ID del documento en el sistema externo
  receivedAt: number                  // Cuándo se recibió
  webhookUrl?: string                 // URL para notificar cuando se firme
  requiresSignature: boolean          // Si requiere firma
  signatureDeadline?: number          // Fecha límite para firmar
}

/** Origen de un registro en la bitácora de fuentes (observabilidad). */
export type ResearchEvidenceLogOrigin =
  | 'user_message'
  | 'assistant_message'
  | 'user_attachment'
  | 'document_scan'

/** Anclaje del evento a una revisión del documento (PDF / versión). */
export interface ResearchEvidenceDocumentAnchor {
  /** Índice en `Document.versions` (1-based, alineado con `version`) en el momento del evento. */
  documentVersion?: number
  /** Hash del PDF del documento en ese momento. */
  pdfHash?: string
  /** Hash opcional de un fragmento de texto citado. */
  excerptHash?: string
}

/**
 * Entrada append-only de la bitácora de fuentes externas (URLs, etc.).
 * No sustituye a `chatHistory`; correlaciona con él cuando aplica.
 */
export interface ResearchEvidenceLogEntry {
  id: string
  documentId: string
  /** Momento en que el sistema registró el evento (ms). */
  createdAt: number
  /** Fecha de consulta del recurso (útil para citación legal/académica). */
  accessedAt?: number
  url: string
  canonicalUrl?: string
  title?: string
  snippet?: string
  origin: ResearchEvidenceLogOrigin
  /** Índice en `chatHistory` al registrar (si el evento viene del hilo del agente). */
  chatHistoryIndex?: number
  anchor?: ResearchEvidenceDocumentAnchor
  /** Cuenta o identificador local del usuario que añadió/registró la fuente. */
  addedBy?: string
  /**
   * Mensaje del usuario que originó la indexación (p. ej. la pregunta que disparó la respuesta
   * del asistente con fuentes, o el propio mensaje si el enlace lo envió el usuario).
   */
  indexedFromUserPrompt?: string
  /** Comentario manual del usuario sobre la fuente (editable en la bitácora). */
  userComment?: string
  /** Si este evento matiza o reemplaza la lectura de otro registro de la bitácora. */
  supersedesId?: string
}

export interface Document {
  // Identificación
  documentId: string                    // UUID (clave primaria)
  
  // Tipo y clasificación
  type: DocumentType
  category?: string                     // Categoría adicional
  subcategory?: string                  // Subcategoría (ej: "employment_contract", "nda", "invoice")
  
  // Contenido del PDF
  pdf?: string                          // PDF en base64 (opcional - puede estar solo en cache)
  pdfHash: string                       // Hash SHA-256 del PDF original
  pdfSize: number                       // Tamaño en bytes
  
  // Versiones del documento
  versions?: DocumentVersion[]          // Historial de versiones
  
  // Firmas Digitales
  signatures: DocumentSignature[]       // Array de firmas
  
  // Encriptación
  encrypted: boolean                    // Si está encriptado
  encryptionMethod?: 'AES-GCM-256' | 'AES-GCM-128'
  encryptionKeyId?: string               // ID de la clave (referencia a clave derivada)
  encryptionMetadata?: EncryptionMetadata
  
  // Metadata del Documento
  metadata: DocumentMetadata
  
  // Metadata GPS (si aplica)
  gpsMetadata?: GPSMetadata
  
  // Relaciones
  relatedAccount?: string               // Cuenta que creó el documento
  relatedFlightLogId?: string          // ID de flight log relacionado
  relatedMedicalRecordId?: string       // ID de medical record relacionado
  relatedAttestationId?: string        // ID de attestation relacionado
  relatedContractId?: string           // ID de contrato relacionado (si es parte de un contrato)
  
  // Integración Externa
  externalSource?: ExternalSource
  
  // Estado de Firma (para contratos y documentos que requieren firma)
  signatureStatus?: SignatureStatus
  requiredSigners?: string[]            // Direcciones que deben firmar
  pendingSigners?: string[]            // Direcciones que aún no han firmado
  
  // Sincronización
  synced: boolean                       // Si está sincronizado con servidor
  serverId?: string                     // ID en el servidor (si existe)
  lastSyncAt?: number                   // Última sincronización
  
  // Batch Operations
  batchId?: string                      // ID del batch (si es parte de una operación en batch)
  batchOperation?: BatchOperation

  /** Metadata firmada compatible con VerifyProcedence (para QR de verificación) */
  signedMetadata?: {
    metadata: Record<string, unknown>
    signature: string
    signer: string
  }
  
  // Timestamps
  createdAt: number                     // Timestamp de creación
  updatedAt: number                     // Última actualización

  // Chat/AI History
  chatHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    attachments?: Array<{ mimeType: string; data: string; fileName: string }>
    /** Si el asistente devolvió bloque [SCORE_LEGAL] (también usado en modo académico). */
    documentScore?: {
      score: number
      level: string
      summary: string
      risks: string[]
    } | null
  }>
  appliedMods?: Record<string, number>    // Mapeo de mods aplicadas [msgIndex-modIndex]: timestamp

  /** Registro local de placeholders ↔ original para revertir y etiquetar (IndexedDB). */
  privacyPlaceholderRegistry?: PrivacyPlaceholderEntry[]

  /**
   * Bitácora append-only de fuentes externas (p. ej. URLs de consulta).
   * Los documentos antiguos pueden no tener el campo; usar `normalizeResearchEvidenceLog` en `@/utils/researchEvidenceLog` al leer.
   */
  researchEvidenceLog?: ResearchEvidenceLogEntry[]
}

export interface ExternalAPIConfig {
  apiId: string                         // UUID (clave primaria)
  name: string                          // Nombre descriptivo
  baseUrl: string                       // URL base
  webhookEndpoint?: string              // Endpoint para recibir documentos
  authentication: {
    type: 'api_key' | 'jwt' | 'signature' | 'oauth2'
    apiKey?: string                     // Encriptado
    secret?: string                     // Encriptado
    token?: string                      // Encriptado
  }
  features: {
    canReceiveDocuments: boolean
    canSendDocuments: boolean
    requiresWebhook: boolean
    supportsBatch: boolean
  }
  webhookConfig?: {
    url: string
    secret: string                      // Encriptado
    events: string[]
  }
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface DocumentQueueItem {
  id: string                            // UUID (clave primaria)
  documentId: string                    // ID del documento
  operation: 'sign' | 'verify' | 'sync' | 'notify_external'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: 'low' | 'normal' | 'high'
  retries: number
  maxRetries: number
  lastError?: string
  externalApiId?: string                // Si es para API externa
  createdAt: number
  updatedAt: number
  processedAt?: number
}

