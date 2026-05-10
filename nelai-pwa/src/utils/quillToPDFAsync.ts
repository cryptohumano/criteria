/**
 * Utilidades asíncronas para convertir contenido de Quill (HTML) a formato PDF con imágenes.
 *
 * Importante: `processNode` es async; hay que **await** cada hijo. Si se usa `forEach` sin await,
 * varios fragmentos (p. ej. texto + <strong>placeholder</strong>) se dibujan en paralelo y
 * comparten `yPosition` → líneas superpuestas en el PDF.
 */

import jsPDF from 'jspdf'
import { CRITERIA_QUILL_PAGE_BREAK_CLASS, NELAI_QUILL_PAGE_BREAK_CLASS } from '@/constants/criteriaQuillEmbed'

export async function convertQuillHTMLToPDF(
  pdf: jsPDF,
  html: string,
  startY: number,
  maxWidth: number = 170
): Promise<number> {
  const margin = 20
  let yPosition = startY
  /** ~11 pt con interlineado cómodo (similar al editor 1,5). */
  const lineHeight = 6.8

  const pageBottom = () => pdf.internal.pageSize.getHeight() - 18

  const ensurePage = () => {
    if (yPosition > pageBottom()) {
      pdf.addPage()
      yPosition = margin
    }
  }

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  tempDiv.style.position = 'absolute'
  tempDiv.style.visibility = 'hidden'
  tempDiv.style.width = `${maxWidth}mm`
  document.body.appendChild(tempDiv)

  async function processChildren(nodes: ArrayLike<Node>, indent: number): Promise<void> {
    for (const child of Array.from(nodes)) {
      await processNode(child, indent)
    }
  }

  async function processNode(node: Node, indent: number = 0): Promise<void> {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent ?? ''
      const text = raw.replace(/\u00a0/g, ' ').trim()
      if (text && text !== '[Imagen]') {
        ensurePage()
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
        case 'p': {
          if (yPosition > margin) yPosition += 3
          await processChildren(element.childNodes, indent)
          yPosition += 3
          break
        }

        case 'br':
          yPosition += lineHeight
          break

        case 'strong':
        case 'b': {
          pdf.setFont('helvetica', 'bold')
          await processChildren(element.childNodes, indent)
          pdf.setFont('helvetica', 'normal')
          break
        }

        case 'em':
        case 'i': {
          pdf.setFont('helvetica', 'italic')
          await processChildren(element.childNodes, indent)
          pdf.setFont('helvetica', 'normal')
          break
        }

        case 'h1': {
          if (yPosition > margin) yPosition += 5
          pdf.setFontSize(18)
          pdf.setFont('helvetica', 'bold')
          await processChildren(element.childNodes, indent)
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 5
          break
        }

        case 'h2': {
          if (yPosition > margin) yPosition += 4
          pdf.setFontSize(16)
          pdf.setFont('helvetica', 'bold')
          await processChildren(element.childNodes, indent)
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 4
          break
        }

        case 'h3': {
          if (yPosition > margin) yPosition += 3
          pdf.setFontSize(14)
          pdf.setFont('helvetica', 'bold')
          await processChildren(element.childNodes, indent)
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'normal')
          yPosition += 3
          break
        }

        case 'ul':
        case 'ol': {
          let index = 0
          for (const li of Array.from(element.children)) {
            ensurePage()
            const marker = tagName === 'ol' ? `${index + 1}. ` : '• '
            pdf.text(marker, margin + indent, yPosition)
            for (const child of Array.from(li.childNodes)) {
              if (child.nodeType === Node.TEXT_NODE) {
                const t = (child.textContent ?? '').replace(/\u00a0/g, ' ').trim()
                if (t) {
                  const lines = pdf.splitTextToSize(t, maxWidth - indent - 10)
                  pdf.text(lines, margin + indent + 10, yPosition)
                  yPosition += lines.length * lineHeight
                }
              } else {
                await processNode(child, indent + 10)
              }
            }
            yPosition += 2
            index += 1
          }
          break
        }

        case 'li':
          await processChildren(element.childNodes, indent)
          break

        case 'img': {
          const img = element as HTMLImageElement
          const src = img.src || img.getAttribute('src')
          if (src && src.startsWith('data:')) {
            ensurePage()
            try {
              const imgElement = new Image()
              imgElement.src = src

              await new Promise<void>((resolve, reject) => {
                if (imgElement.complete) {
                  resolve()
                } else {
                  imgElement.onload = () => resolve()
                  imgElement.onerror = () => reject(new Error('Error'))
                  setTimeout(() => reject(new Error('Timeout')), 3000)
                }
              })

              const imgWidth = imgElement.width
              const imgHeight = imgElement.height
              const maxImgWidth = maxWidth - indent
              const maxImgHeight = 50

              let displayWidth = imgWidth * 0.264583
              let displayHeight = imgHeight * 0.264583

              if (displayWidth > maxImgWidth) {
                const ratio = maxImgWidth / displayWidth
                displayWidth = maxImgWidth
                displayHeight = displayHeight * ratio
              }
              if (displayHeight > maxImgHeight) {
                const ratio = maxImgHeight / displayHeight
                displayHeight = maxImgHeight
                displayWidth = displayWidth * ratio
              }

              pdf.addImage(src, 'PNG', margin + indent, yPosition, displayWidth, displayHeight)
              yPosition += displayHeight + 3
            } catch (error) {
              console.warn('Error al agregar imagen:', error)
            }
          }
          break
        }

        case 'div': {
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
          await processChildren(element.childNodes, indent)
          break
        }

        case 'span':
          await processChildren(element.childNodes, indent)
          break

        default:
          await processChildren(element.childNodes, indent)
      }
    }
  }

  for (const node of Array.from(tempDiv.childNodes)) {
    await processNode(node)
  }

  document.body.removeChild(tempDiv)

  return yPosition
}
