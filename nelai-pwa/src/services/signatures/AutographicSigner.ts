/**
 * Servicio para agregar firmas autográficas a PDFs
 */

import { v4 as uuidv4 } from 'uuid'
import { PDFDocument } from 'pdf-lib'
import type { Document, DocumentSignature, GPSMetadata } from '@/types/documents'
import { updateDocument } from '@/utils/documentStorage'
import { calculatePDFHash } from '@/services/pdf/PDFHash'
import { getCurrentGPSLocation } from '@/services/pdf/PDFMetadata'

export interface AddAutographicSignatureOptions {
  document: Document
  signatureImage: string // Base64 PNG o SVG de la firma
  position: {
    page: number
    x: number // mm desde la izquierda, o -1 para desde la derecha
    y: number // mm desde arriba
    width?: number // mm
    height?: number // mm
  }
  captureGPS?: boolean
}

/**
 * Agrega una firma autográfica a un PDF
 */
export async function addAutographicSignature(
  options: AddAutographicSignatureOptions
): Promise<Document> {
  const { document, signatureImage, position, captureGPS = false } = options

  if (!document.pdf) {
    throw new Error('El documento no tiene PDF para firmar')
  }

  // Convertir base64 a Uint8Array
  // Manejar tanto base64 puro como data URL
  const base64Data = document.pdf.includes(',') ? document.pdf.split(',')[1] : document.pdf
  const pdfBytes = base64ToUint8Array(base64Data)
  
  console.log('[Autographic Signer] Cargando PDF para agregar firma. Tamaño:', pdfBytes.length, 'bytes')

  // Cargar PDF con pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBytes)

  // Preservar metadatos existentes del PDF ANTES de modificar
  const existingTitle = pdfDoc.getTitle()
  const existingAuthor = pdfDoc.getAuthor()
  const existingSubject = pdfDoc.getSubject()
  const existingCreator = pdfDoc.getCreator()
  const existingProducer = pdfDoc.getProducer()
  const existingKeywordsRaw = pdfDoc.getKeywords()
  // Convertir keywords a array si es necesario (pdf-lib puede devolver string o array)
  const existingKeywords = Array.isArray(existingKeywordsRaw) 
    ? existingKeywordsRaw 
    : typeof existingKeywordsRaw === 'string' && existingKeywordsRaw.length > 0
      ? existingKeywordsRaw.split(',').map(k => k.trim()).filter(Boolean)
      : []
  const existingCreationDate = pdfDoc.getCreationDate()
  const existingModificationDate = pdfDoc.getModificationDate()
  
  console.log('[Autographic Signer] Metadatos existentes del PDF:', {
    title: existingTitle,
    author: existingAuthor,
    subject: existingSubject,
    creator: existingCreator,
    producer: existingProducer,
    keywords: existingKeywords,
  })

  // Convertir imagen de firma (una sola vez para todas las páginas)
  // Detectar si es SVG o PNG/JPEG
  const signatureBase64Data = signatureImage.split(',')[1] || signatureImage
  const mimeType = signatureImage.includes('data:') 
    ? signatureImage.split(',')[0].match(/data:([^;]+)/)?.[1] || 'image/png'
    : 'image/png'
  
  let signatureImageEmbed
  
  if (mimeType.includes('svg')) {
    // Convertir SVG a PNG usando canvas
    signatureImageEmbed = await convertSVGToPDFImage(pdfDoc, signatureBase64Data)
  } else {
    // PNG o JPEG
    const signatureImageBytes = base64ToUint8Array(signatureBase64Data)
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      signatureImageEmbed = await pdfDoc.embedJpg(signatureImageBytes)
    } else {
      signatureImageEmbed = await pdfDoc.embedPng(signatureImageBytes)
    }
  }

  // Calcular dimensiones
  const width = position.width || 60 // mm por defecto
  const height = position.height || 30 // mm por defecto

  // Convertir mm a puntos (1 mm = 2.83465 puntos)
  const mmToPoints = 2.83465
  const widthPoints = width * mmToPoints
  const heightPoints = height * mmToPoints

  // Obtener todas las páginas
  const pages = pdfDoc.getPages()
  
  // Si position.page es -1, agregar a todas las páginas
  // Si es un número específico, solo a esa página
  const pagesToSign = position.page === -1 
    ? pages 
    : position.page >= 0 && position.page < pages.length 
      ? [pages[position.page]] 
      : []

  if (pagesToSign.length === 0) {
    throw new Error(`No hay páginas válidas para firmar`)
  }

  // Agregar firma en la esquina inferior derecha de cada página
  for (const page of pagesToSign) {
    // Calcular posición X
    // Si x es -1, colocar desde la derecha
    let xPoints: number
    if (position.x === -1) {
      // Desde la derecha: ancho de página - ancho de firma - margen
      const margin = 10 * mmToPoints // 10mm de margen desde la derecha
      xPoints = page.getWidth() - widthPoints - margin
    } else {
      // Desde la izquierda
      xPoints = position.x * mmToPoints
    }
    
    const yFromBottom = position.y * mmToPoints // y desde abajo
    
    page.drawImage(signatureImageEmbed, {
      x: xPoints,
      y: yFromBottom, // Y se mide desde abajo
      width: widthPoints,
      height: heightPoints,
    })
  }
  
  console.log(`[Autographic Signer] Firma agregada en ${pagesToSign.length} página(s)`)

  // Re-establecer metadatos para asegurar que se preserven
  if (existingTitle) pdfDoc.setTitle(existingTitle)
  if (existingAuthor) pdfDoc.setAuthor(existingAuthor)
  if (existingSubject) pdfDoc.setSubject(existingSubject)
  if (existingCreator) pdfDoc.setCreator(existingCreator)
  if (existingProducer) pdfDoc.setProducer(existingProducer)
  // setKeywords requiere un array, no un string
  if (Array.isArray(existingKeywords) && existingKeywords.length > 0) {
    pdfDoc.setKeywords(existingKeywords)
  }
  if (existingCreationDate) pdfDoc.setCreationDate(existingCreationDate)
  if (existingModificationDate) pdfDoc.setModificationDate(existingModificationDate)

  // Guardar PDF modificado
  const modifiedPdfBytes = await pdfDoc.save()
  const modifiedPdfBase64 = uint8ArrayToBase64(modifiedPdfBytes)
  
  // Verificar que los metadatos se preservaron (cargar de nuevo para verificar)
  const verifyDoc = await PDFDocument.load(modifiedPdfBytes)
  console.log('[Autographic Signer] Metadatos del PDF después de agregar firma:', {
    title: verifyDoc.getTitle(),
    author: verifyDoc.getAuthor(),
    subject: verifyDoc.getSubject(),
    creator: verifyDoc.getCreator(),
    producer: verifyDoc.getProducer(),
    keywords: verifyDoc.getKeywords(),
  })

  // Calcular nuevo hash
  const newHash = await calculatePDFHash(modifiedPdfBase64)

  // Obtener GPS si se solicita
  let gpsMetadata: GPSMetadata | undefined
  if (captureGPS) {
    try {
      gpsMetadata = await getCurrentGPSLocation()
    } catch (error) {
      console.warn('[Autographic Signer] No se pudo obtener GPS:', error)
    }
  }

  // Crear objeto de firma
  // Si se agregó en todas las páginas (page === -1), guardar como -1
  const signaturePage = position.page === -1 ? -1 : position.page
  
  const documentSignature: DocumentSignature = {
    id: uuidv4(),
    type: 'autographic',
    autographic: {
      image: signatureImage,
      position: {
        page: signaturePage, // -1 significa todas las páginas
        x: position.x,
        y: position.y,
        width,
        height,
      },
      capturedAt: Date.now(),
      gpsMetadata,
    },
    timestamp: Date.now(),
    hash: newHash,
  }

  // Agregar firma al documento
  const updatedSignatures = [...(document.signatures || []), documentSignature]

  // Actualizar documento
  const updatedDocument: Document = {
    ...document,
    pdf: modifiedPdfBase64,
    pdfHash: newHash,
    pdfSize: modifiedPdfBytes.length,
    signatures: updatedSignatures,
    updatedAt: Date.now(),
  }

  // Guardar en IndexedDB
  await updateDocument(document.documentId, updatedDocument)

  return updatedDocument
}

/**
 * Convierte SVG a imagen PDF usando canvas
 */
async function convertSVGToPDFImage(
  pdfDoc: PDFDocument,
  svgBase64: string
): Promise<ReturnType<typeof pdfDoc.embedPng>> {
  return new Promise((resolve, reject) => {
    try {
      // Decodificar SVG
      const svgString = atob(svgBase64)
      
      // Crear un blob URL del SVG
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' })
      const svgUrl = URL.createObjectURL(svgBlob)
      
      // Crear imagen desde SVG
      const img = new Image()
      
      img.onload = async () => {
        try {
          // Crear canvas para convertir SVG a PNG
          const canvas = document.createElement('canvas')
          canvas.width = img.width || 800
          canvas.height = img.height || 200
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            throw new Error('No se pudo obtener contexto del canvas')
          }
          
          // Dibujar SVG en canvas (con fondo transparente)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          
          // Convertir canvas a PNG base64
          const pngDataUrl = canvas.toDataURL('image/png')
          const pngBase64 = pngDataUrl.split(',')[1]
          const pngBytes = base64ToUint8Array(pngBase64)
          
          // Limpiar URL del blob
          URL.revokeObjectURL(svgUrl)
          
          // Incrustar PNG en PDF
          const embedded = await pdfDoc.embedPng(pngBytes)
          resolve(embedded)
        } catch (error) {
          URL.revokeObjectURL(svgUrl)
          reject(error)
        }
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        reject(new Error('Error al cargar SVG'))
      }
      
      img.src = svgUrl
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Convierte base64 a Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Convierte Uint8Array a base64
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return btoa(binary)
}

