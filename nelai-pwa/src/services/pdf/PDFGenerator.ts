/**
 * Generador de PDFs usando jsPDF
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DocumentMetadata, GPSMetadata } from '@/types/documents'
import { normalizePaperFormat, pdfBodyWidthMm } from '@/constants/paperFormat'
import { calculatePDFHash, calculatePDFHashFromJsPDF } from './PDFHash'
import { injectGPSMetadata } from './PDFMetadata'
import { convertQuillHTMLToPDF } from '@/utils/quillToPDFAsync'

const PLAIN_TEXT_MARGIN_X_MM = 20
const PLAIN_TEXT_TOP_MARGIN_MM = 20
const PLAIN_TEXT_LINE_HEIGHT_MM = 6
const PLAIN_TEXT_BOTTOM_MARGIN_MM = 15

/**
 * Dibuja texto plano con ajuste de ancho y saltos de página.
 * `pdf.text(array, x, y)` de jsPDF pinta todas las líneas en la misma página y el resto queda fuera del lienzo.
 */
function appendPlainTextWithPageBreaks(
  pdf: jsPDF,
  body: string,
  yPosition: number,
  contentMaxWidthMm: number,
): number {
  const pageHeightMm = pdf.internal.pageSize.getHeight()
  const maxY = pageHeightMm - PLAIN_TEXT_BOTTOM_MARGIN_MM

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  const lines = pdf.splitTextToSize(body, contentMaxWidthMm)
  let y = yPosition

  for (const line of lines) {
    if (y + PLAIN_TEXT_LINE_HEIGHT_MM > maxY) {
      pdf.addPage()
      y = PLAIN_TEXT_TOP_MARGIN_MM
    }
    pdf.text(line, PLAIN_TEXT_MARGIN_X_MM, y)
    y += PLAIN_TEXT_LINE_HEIGHT_MM
  }
  return y + 5
}

export interface PDFGenerationOptions {
  metadata: DocumentMetadata
  gpsMetadata?: GPSMetadata
  content: {
    title?: string
    subtitle?: string
    sections?: Array<{
      title: string
      content: string | Array<Array<string | number>> // Para tablas
      isTable?: boolean
    }>
    footer?: string
  }
  orientation?: 'portrait' | 'landscape'
  format?: 'a4' | 'letter' | [number, number] // Ancho, Alto en mm
}

/**
 * Genera un PDF básico con el contenido especificado
 */
export async function generatePDF(options: PDFGenerationOptions): Promise<{
  pdfBase64: string
  pdfHash: string
  pdfSize: number
}> {
  const {
    metadata,
    gpsMetadata,
    content,
    orientation = 'portrait',
    format: formatOption,
  } = options

  const paper = normalizePaperFormat(metadata?.paperFormat)
  const format = formatOption ?? paper

  // Crear instancia de jsPDF
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
    compress: true,
  })

  const contentMaxWidthMm = pdfBodyWidthMm(pdf.internal.pageSize.getWidth())
  const pageHeightMm = pdf.internal.pageSize.getHeight()
  const sectionPageBreakY = pageHeightMm - 15

  // Configurar metadata del PDF (esto se incluye en las propiedades del PDF)
  pdf.setProperties({
    title: metadata.title || 'Documento',
    author: metadata.author || 'CriterIA', // Este autor aparecerá en las propiedades del PDF
    subject: metadata.subject || '',
    keywords: metadata.keywords?.join(', ') || '',
    creator: metadata.creator || 'CriterIA',
    producer: metadata.producer || 'CriterIA PDF',
  })

  // Inyectar metadata GPS si está disponible
  if (gpsMetadata) {
    injectGPSMetadata(pdf, gpsMetadata)
  }

  // Agregar contenido
  let yPosition = 20

  // Título
  if (content.title) {
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text(content.title, 20, yPosition)
    yPosition += 10
  }

  // Subtítulo
  if (content.subtitle) {
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'normal')
    pdf.text(content.subtitle, 20, yPosition)
    yPosition += 10
  }

  // Espacio
  yPosition += 5

  // Secciones
  if (content.sections) {
    for (const section of content.sections) {
      if (yPosition > sectionPageBreakY) {
        pdf.addPage()
        yPosition = 20
      }

      // Título de sección
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text(section.title, 20, yPosition)
      yPosition += 8

      // Contenido de sección
      if (section.isTable && Array.isArray(section.content)) {
        // Es una tabla
        const tableData = section.content as Array<Array<string | number>>
        autoTable(pdf, {
          head: tableData.length > 0 ? [tableData[0]] : [],
          body: tableData.slice(1),
          startY: yPosition,
          margin: { left: 20, right: 20 },
          styles: { fontSize: 10 },
        })
        yPosition = (pdf as any).lastAutoTable.finalY + 10
      } else if (typeof section.content === 'string') {
        // Es texto - verificar si es HTML de Quill
        if (section.content.includes('<') && section.content.includes('>')) {
          // Es HTML - usar conversor de Quill
          try {
            yPosition = await convertQuillHTMLToPDF(
              pdf,
              section.content,
              yPosition,
              contentMaxWidthMm
            )
          } catch (error) {
            console.error('Error al convertir HTML a PDF:', error)
            // Fallback a texto plano (con paginación; no usar pdf.text(array) en una sola página)
            const plainText = section.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
            yPosition = appendPlainTextWithPageBreaks(pdf, plainText, yPosition, contentMaxWidthMm)
          }
        } else {
          // Es texto plano (p. ej. Etherpad): paginar en varias hojas
          yPosition = appendPlainTextWithPageBreaks(
            pdf,
            section.content,
            yPosition,
            contentMaxWidthMm,
          )
        }
      }
    }
  }

  // Footer
  if (content.footer) {
    const pageCount = pdf.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'italic')
      pdf.text(
        content.footer,
        pdf.internal.pageSize.getWidth() / 2,
        pdf.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }
  }

  // Generar PDF como ArrayBuffer primero para validar
  const pdfArrayBuffer = pdf.output('arraybuffer')
  const pdfSize = pdfArrayBuffer.byteLength

  // Convertir ArrayBuffer a base64
  const uint8Array = new Uint8Array(pdfArrayBuffer)
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  const pdfBase64 = btoa(binary)

  // Calcular hash desde el ArrayBuffer
  const pdfHash = await calculatePDFHash(pdfArrayBuffer)

  return {
    pdfBase64,
    pdfHash,
    pdfSize,
  }
}

/**
 * Genera un PDF simple con solo texto
 */
export async function generateSimplePDF(
  title: string,
  content: string,
  metadata?: Partial<DocumentMetadata>
): Promise<{
  pdfBase64: string
  pdfHash: string
  pdfSize: number
}> {
  return generatePDF({
    metadata: {
      title,
      author: metadata?.author || '',
      subject: metadata?.subject || '',
      keywords: metadata?.keywords || [],
      language: metadata?.language || 'es',
      creator: 'CriterIA',
      producer: 'CriterIA PDF',
      createdAt: new Date().toISOString(),
    },
    content: {
      title,
      sections: [
        {
          title: 'Contenido',
          content,
        },
      ],
    },
  })
}

/**
 * Genera un PDF de contrato básico
 */
export async function generateContractPDF(
  contractTitle: string,
  parties: Array<{ name: string; address: string; role: string }>,
  terms: string[],
  metadata?: Partial<DocumentMetadata>
): Promise<{
  pdfBase64: string
  pdfHash: string
  pdfSize: number
}> {
  const partiesTable = [
    ['Parte', 'Nombre', 'Dirección'],
    ...parties.map(p => [p.role, p.name, p.address]),
  ]

  const termsContent = terms.map((term, index) => `${index + 1}. ${term}`).join('\n\n')

  return generatePDF({
    metadata: {
      title: contractTitle,
      author: metadata?.author || '',
      subject: 'Contrato',
      keywords: ['contrato', 'legal', ...(metadata?.keywords || [])],
      language: metadata?.language || 'es',
      creator: 'CriterIA',
      producer: 'CriterIA PDF',
      createdAt: new Date().toISOString(),
    },
    content: {
      title: contractTitle,
      sections: [
        {
          title: 'Partes',
          content: partiesTable,
          isTable: true,
        },
        {
          title: 'Términos y Condiciones',
          content: termsContent,
        },
      ],
      footer: `Generado el ${new Date().toLocaleDateString('es-ES')} por CriterIA`,
    },
  })
}
