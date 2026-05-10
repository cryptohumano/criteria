import { ensurePdfjsWorker, pdfjs } from '@/utils/pdfjsWorker'

/**
 * Extrae texto de un PDF en base64 (sin prefijo data:).
 * Requiere texto embebido en el PDF (no OCR).
 */
export async function extractTextFromPdfBase64(base64: string): Promise<string> {
  ensurePdfjsWorker()
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const loadingTask = pdfjs.getDocument({ data: bytes, useSystemFonts: true })
  const doc = await loadingTask.promise
  const parts: string[] = []

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : '') || '')
      .filter(Boolean)
      .join(' ')
    if (line.trim()) parts.push(line.trim())
  }

  return parts.join('\n\n').trim()
}
