/**
 * Servicio principal para gestión de documentos
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  Document,
  DocumentType,
  DocumentMetadata,
  GPSMetadata,
  PrivacyPlaceholderEntry,
  ResearchEvidenceLogEntry,
} from '@/types/documents'
import { saveDocument, getDocument, updateDocument } from '@/utils/documentStorage'
import { appendResearchEvidenceEntries } from '@/utils/researchEvidenceLog'
import { generatePDF, generateSimplePDF, generateContractPDF } from '@/services/pdf/PDFGenerator'
import type { PDFGenerationOptions } from '@/services/pdf/PDFGenerator'

export interface CreateDocumentOptions {
  type: DocumentType
  category?: string
  subcategory?: string
  metadata: DocumentMetadata
  gpsMetadata?: GPSMetadata
  pdfContent?: PDFGenerationOptions['content']
  relatedAccount?: string
  encrypted?: boolean
}

/**
 * Crea un nuevo documento
 */
export async function createDocument(options: CreateDocumentOptions): Promise<Document> {
  const documentId = uuidv4()
  
  // Generar PDF si se proporciona contenido
  let pdfBase64: string | undefined
  let pdfHash: string
  let pdfSize: number

  if (options.pdfContent) {
    const pdfResult = await generatePDF({
      metadata: options.metadata,
      gpsMetadata: options.gpsMetadata,
      content: options.pdfContent,
    })
    pdfBase64 = pdfResult.pdfBase64
    pdfHash = pdfResult.pdfHash
    pdfSize = pdfResult.pdfSize
  } else {
    // Crear PDF básico con solo metadata
    const pdfResult = await generateSimplePDF(
      options.metadata.title || 'Documento sin título',
      options.metadata.description || '',
      options.metadata
    )
    pdfBase64 = pdfResult.pdfBase64
    pdfHash = pdfResult.pdfHash
    pdfSize = pdfResult.pdfSize
  }

  // Extraer contentHtml si viene en pdfContent
  const contentHtml =
    options.pdfContent?.sections?.[0]?.content && typeof options.pdfContent.sections[0].content === 'string'
      ? (options.pdfContent.sections[0].content as string)
      : undefined

  // Crear objeto Document
  const document: Document = {
    documentId,
    type: options.type,
    category: options.category,
    subcategory: options.subcategory,
    pdf: pdfBase64,
    pdfHash,
    pdfSize,
    signatures: [],
    encrypted: options.encrypted || false,
    metadata: {
      ...options.metadata,
      contentHtml,
      createdAt: new Date().toISOString(),
      creator: 'CriterIA',
      producer: 'CriterIA PDF',
    },
    gpsMetadata: options.gpsMetadata,
    relatedAccount: options.relatedAccount,
    synced: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    researchEvidenceLog: [],
  }

  await saveDocument(document)

  return document
}

/**
 * Actualiza un documento existente con nuevo contenido.
 * Regenera el PDF y limpia firmas (el contenido cambió).
 * Guarda una versión en el historial si se solicita.
 */
export async function updateDocumentContent(
  documentId: string,
  options: {
    content: string
    metadata: Partial<DocumentMetadata>
    relatedAccount?: string
    chatHistory?: any[]
    appliedMods?: Record<string, number>
    /** Registro de placeholders del editor (revertir / etiquetas). */
    privacyPlaceholderRegistry?: PrivacyPlaceholderEntry[]
    /**
     * Añade entradas a la bitácora de fuentes sin sustituir las existentes
     * (deduplicación por `id` de entrada).
     */
    researchEvidenceLogAppend?: ResearchEvidenceLogEntry[]
    changeDescription?: string        // Descripción para el historial (ej: "Sugerencia de IA aplicada")
    saveVersion?: boolean             // Si se debe guardar este cambio en el historial
  }
): Promise<Document> {
  const existing = await getDocument(documentId)
  if (!existing) {
    throw new Error(`Documento ${documentId} no encontrado`)
  }

  const metadata: DocumentMetadata = {
    ...existing.metadata,
    ...options.metadata,
    contentHtml: options.content,
    modifiedAt: new Date().toISOString(),
  }

  const pdfResult = await generatePDF({
    metadata,
    content: {
      title: metadata.title,
      subtitle: metadata.description,
      sections: [
        {
          title: 'Contenido',
          content: options.content || '<p>Sin contenido</p>',
          isTable: false,
        },
      ],
    },
  })

  // Gestionar historial de versiones
  const versions = existing.versions || []
  if (options.saveVersion) {
    versions.push({
      version: versions.length + 1,
      pdfHash: pdfResult.pdfHash,
      pdf: pdfResult.pdfBase64,
      contentHtml: options.content,
      title: metadata.title,
      createdAt: Date.now(),
      changes: options.changeDescription || 'Actualización de contenido',
    })
  }

  const updated: Document = {
    ...existing,
    pdf: pdfResult.pdfBase64,
    pdfHash: pdfResult.pdfHash,
    pdfSize: pdfResult.pdfSize,
    metadata,
    versions: versions.length > 0 ? versions : undefined,
    relatedAccount: options.relatedAccount ?? existing.relatedAccount,
    chatHistory: options.chatHistory ?? existing.chatHistory,
    appliedMods: options.appliedMods ?? existing.appliedMods,
    researchEvidenceLog:
      options.researchEvidenceLogAppend?.length
        ? appendResearchEvidenceEntries(existing.researchEvidenceLog, options.researchEvidenceLogAppend)
        : existing.researchEvidenceLog,
    privacyPlaceholderRegistry:
      options.privacyPlaceholderRegistry ?? existing.privacyPlaceholderRegistry,
    signatures: [], // Contenido cambió, firmas anteriores ya no aplican
    signatureStatus: undefined,
    pendingSigners: undefined,
    signedMetadata: undefined, // Se regenera al firmar de nuevo
    updatedAt: Date.now(),
  }

  await updateDocument(documentId, updated)
  return updated
}

/**
 * Crea un documento de contrato
 */
export async function createContractDocument(
  contractTitle: string,
  parties: Array<{ name: string; address: string; role: string }>,
  terms: string[],
  options: {
    metadata?: Partial<DocumentMetadata>
    relatedAccount?: string
    requiredSigners?: string[]
  } = {}
): Promise<Document> {
  const documentId = uuidv4()

  // Generar PDF del contrato
  const pdfResult = await generateContractPDF(
    contractTitle,
    parties,
    terms,
    options.metadata
  )

  // Crear objeto Document
  const document: Document = {
    documentId,
    type: 'contract',
    category: 'legal',
    pdf: pdfResult.pdfBase64,
    pdfHash: pdfResult.pdfHash,
    pdfSize: pdfResult.pdfSize,
    signatures: [],
    encrypted: false,
    metadata: {
      title: contractTitle,
      author: options.metadata?.author || '',
      subject: 'Contrato',
      keywords: ['contrato', 'legal'],
      language: 'es',
      creator: 'CriterIA',
      producer: 'CriterIA PDF',
      createdAt: new Date().toISOString(),
    },
    relatedAccount: options.relatedAccount,
    signatureStatus: options.requiredSigners && options.requiredSigners.length > 0
      ? 'pending'
      : undefined,
    requiredSigners: options.requiredSigners,
    pendingSigners: options.requiredSigners,
    synced: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    researchEvidenceLog: [],
  }

  await saveDocument(document)

  return document
}

/**
 * Crea un documento desde un PDF base64 ya generado
 */
export async function createDocumentFromPDF(
  options: {
    type: DocumentType
    category?: string
    subcategory?: string
    metadata: DocumentMetadata
    gpsMetadata?: GPSMetadata
    pdfBase64: string
    relatedAccount?: string
    encrypted?: boolean
  }
): Promise<Document> {
  const documentId = uuidv4()
  
  // Calcular hash y tamaño del PDF
  const { calculatePDFHash } = await import('@/services/pdf/PDFHash')
  const pdfHash = await calculatePDFHash(options.pdfBase64)
  
  // Calcular tamaño (aproximado desde base64)
  const pdfSize = Math.floor((options.pdfBase64.length * 3) / 4)

  // Crear objeto Document
  const document: Document = {
    documentId,
    type: options.type,
    category: options.category,
    subcategory: options.subcategory,
    pdf: options.pdfBase64,
    pdfHash,
    pdfSize,
    signatures: [],
    encrypted: options.encrypted || false,
    metadata: {
      ...options.metadata,
      createdAt: new Date().toISOString(),
      creator: 'CriterIA',
      producer: 'CriterIA PDF',
    },
    gpsMetadata: options.gpsMetadata,
    relatedAccount: options.relatedAccount,
    synced: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    researchEvidenceLog: [],
  }

  await saveDocument(document)

  return document
}

/**
 * Obtiene un documento por ID
 */
export async function getDocumentById(documentId: string): Promise<Document | null> {
  return await getDocument(documentId)
}

