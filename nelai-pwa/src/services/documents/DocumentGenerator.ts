/**
 * Servicio para generar documentos completos (PDF + metadata + hash)
 */

import { generateBasicPDF, generatePDFWithTable, getPDFSizeFromBase64, type PDFGenerationOptions } from '../pdf/PDFGenerator'
import { calculatePDFHash } from '../pdf/PDFHash'
import { saveDocument } from '@/utils/documentStorage'
import type { Document, DocumentType } from '@/types/documents'

// Polyfill para uuid si no está disponible
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback simple
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export interface CreateDocumentOptions {
  type: DocumentType
  pdfOptions: PDFGenerationOptions
  relatedAccount?: string
  category?: string
  subcategory?: string
  encrypted?: boolean
  requiredSigners?: string[]
  externalSource?: Document['externalSource']
}

/**
 * Crea un documento completo: genera PDF, calcula hash, y guarda en IndexedDB
 */
export async function createDocument(options: CreateDocumentOptions): Promise<Document> {
  // Generar PDF
  const pdfBase64 = generateBasicPDF(options.pdfOptions)
  const pdfSize = getPDFSizeFromBase64(pdfBase64)

  // Calcular hash SHA-256
  const pdfHash = await calculatePDFHash(pdfBase64)

  // Crear objeto Document
  const now = Date.now()
  const document: Document = {
    documentId: generateUUID(),
    type: options.type,
    category: options.category,
    subcategory: options.subcategory,
    pdf: pdfBase64,
    pdfHash,
    pdfSize,
    signatures: [],
    encrypted: options.encrypted || false,
    metadata: {
      title: options.pdfOptions.title || options.pdfOptions.metadata?.title || 'Documento sin título',
      description: options.pdfOptions.metadata?.description,
      author: options.pdfOptions.metadata?.author || options.pdfOptions.author || options.relatedAccount,
      subject: options.pdfOptions.metadata?.subject || options.pdfOptions.subject,
      keywords: options.pdfOptions.metadata?.keywords || options.pdfOptions.keywords,
      creator: 'CriterIA',
      producer: 'jsPDF',
      createdAt: new Date().toISOString(),
    },
    gpsMetadata: options.pdfOptions.gpsMetadata,
    relatedAccount: options.relatedAccount,
    signatureStatus: options.requiredSigners && options.requiredSigners.length > 0 
      ? 'pending' 
      : undefined,
    requiredSigners: options.requiredSigners,
    pendingSigners: options.requiredSigners,
    synced: false,
    createdAt: now,
    updatedAt: now,
    externalSource: options.externalSource,
    researchEvidenceLog: [],
  }

  await saveDocument(document)

  console.log(`[Document Generator] ✅ Documento creado: ${document.documentId}`)
  return document
}

/**
 * Crea un documento con tabla
 */
export async function createDocumentWithTable(
  type: DocumentType,
  title: string,
  headers: string[],
  rows: string[][],
  options?: {
    relatedAccount?: string
    category?: string
    metadata?: Document['metadata']
    gpsMetadata?: Document['gpsMetadata']
  }
): Promise<Document> {
  // Generar PDF con tabla
  const pdfBase64 = generatePDFWithTable(title, headers, rows, {
    metadata: options?.metadata,
    gpsMetadata: options?.gpsMetadata,
  })
  const pdfSize = getPDFSizeFromBase64(pdfBase64)

  // Calcular hash
  const pdfHash = await calculatePDFHash(pdfBase64)

  // Crear documento
  const now = Date.now()
  const document: Document = {
    documentId: generateUUID(),
    type,
    category: options?.category,
    pdf: pdfBase64,
    pdfHash,
    pdfSize,
    signatures: [],
    encrypted: false,
    metadata: {
      title,
      ...options?.metadata,
      creator: 'CriterIA',
      producer: 'jsPDF',
      createdAt: new Date().toISOString(),
    },
    gpsMetadata: options?.gpsMetadata,
    relatedAccount: options?.relatedAccount,
    synced: false,
    createdAt: now,
    updatedAt: now,
    researchEvidenceLog: [],
  }

  await saveDocument(document)
  return document
}

