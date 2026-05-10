/**
 * Utilidades para convertir contenido de Quill (HTML) a formato PDF
 */

import jsPDF from 'jspdf'
import { CRITERIA_QUILL_PAGE_BREAK_CLASS, NELAI_QUILL_PAGE_BREAK_CLASS } from '@/constants/criteriaQuillEmbed'

/**
 * Parsea HTML de Quill y lo convierte a formato PDF preservando formato básico
 */
export function parseQuillHTMLToPDF(
  pdf: jsPDF,
  html: string,
  startY: number,
  maxWidth: number = 170
): number {
  // Crear un elemento temporal para parsear HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  tempDiv.style.position = 'absolute'
  tempDiv.style.visibility = 'hidden'
  tempDiv.style.width = `${maxWidth}mm`
  document.body.appendChild(tempDiv)

  let yPosition = startY
  const lineHeight = 6
  const margin = 20

  // Función recursiva para procesar nodos
  function processNode(node: Node, indent: number = 0): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) {
        // Verificar si necesitamos nueva página
        if (yPosition > 250) {
          pdf.addPage()
          yPosition = 20
        }
        
        const lines = pdf.splitTextToSize(text, maxWidth - indent)
        pdf.text(lines, margin + indent, yPosition)
        yPosition += lines.length * lineHeight
      }
      return
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      const tagName = element.tagName.toLowerCase()

      switch (tagName) {
        case 'p':
          // Párrafo - agregar espacio antes
          if (yPosition > 20) {
            yPosition += 3
          }
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          yPosition += 3 // Espacio después del párrafo
          break

        case 'br':
          yPosition += lineHeight
          break

        case 'strong':
        case 'b':
          // Texto en negrita
          pdf.setFont('helvetica', 'bold')
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          pdf.setFont('helvetica', 'normal')
          break

        case 'em':
        case 'i':
          // Texto en cursiva
          pdf.setFont('helvetica', 'italic')
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          pdf.setFont('helvetica', 'normal')
          break

        case 'u':
          // Texto subrayado (jsPDF no soporta subrayado directamente)
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          break

        case 'h1':
          if (yPosition > 20) yPosition += 5
          pdf.setFontSize(18)
          pdf.setFont('helvetica', 'bold')
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 5
          break

        case 'h2':
          if (yPosition > 20) yPosition += 4
          pdf.setFontSize(16)
          pdf.setFont('helvetica', 'bold')
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 4
          break

        case 'h3':
          if (yPosition > 20) yPosition += 3
          pdf.setFontSize(14)
          pdf.setFont('helvetica', 'bold')
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 3
          break

        case 'ul':
        case 'ol':
          // Listas
          Array.from(element.children).forEach((li, index) => {
            if (yPosition > 250) {
              pdf.addPage()
              yPosition = 20
            }
            const marker = tagName === 'ol' ? `${index + 1}. ` : '• '
            pdf.text(marker, margin + indent, yPosition)
            Array.from(li.childNodes).forEach(child => {
              if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim()
                if (text) {
                  const lines = pdf.splitTextToSize(text, maxWidth - indent - 10)
                  pdf.text(lines, margin + indent + 10, yPosition)
                  yPosition += lines.length * lineHeight
                }
              } else {
                processNode(child, indent + 10)
              }
            })
            yPosition += 2
          })
          break

        case 'li':
          // Items de lista (ya manejados en ul/ol)
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          break

        case 'img':
          // Imágenes - se procesarán de forma asíncrona después
          // Por ahora, solo agregar un marcador de posición
          if (yPosition > 200) {
            pdf.addPage()
            yPosition = 20
          }
          pdf.setFontSize(10)
          pdf.setFont('helvetica', 'italic')
          pdf.text('[Imagen]', margin + indent, yPosition)
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 10
          break

        case 'div':
          if (
            element.classList.contains(CRITERIA_QUILL_PAGE_BREAK_CLASS) ||
            element.classList.contains(NELAI_QUILL_PAGE_BREAK_CLASS) ||
            element.getAttribute('data-criteria-page-break') === '1' ||
            element.getAttribute('data-nelai-page-break') === '1'
          ) {
            pdf.addPage()
            yPosition = margin
            break
          }
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          break

        case 'span':
          // Contenedores genéricos
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
          break

        default:
          // Otros elementos - procesar hijos
          Array.from(element.childNodes).forEach(child => processNode(child, indent))
      }
    }
  }

  // Procesar todos los nodos
  Array.from(tempDiv.childNodes).forEach(node => processNode(node))

  // Limpiar
  document.body.removeChild(tempDiv)

  return yPosition
}

/**
 * Convierte HTML de Quill a texto formateado para PDF (versión mejorada)
 */
export async function convertQuillHTMLToPDFContent(
  pdf: jsPDF,
  html: string,
  startY: number,
  maxWidth: number = 170
): Promise<number> {
  return parseQuillHTMLToPDF(pdf, html, startY, maxWidth)
}

