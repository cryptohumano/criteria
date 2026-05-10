/**
 * Utilidades para calcular hash SHA-256 de PDFs
 */

/**
 * Calcula el hash SHA-256 de un PDF (en base64 o ArrayBuffer)
 */
export async function calculatePDFHash(pdfData: string | ArrayBuffer): Promise<string> {
  let buffer: ArrayBuffer

  if (typeof pdfData === 'string') {
    // Si es base64, convertir a ArrayBuffer
    const base64Data = pdfData.includes(',') 
      ? pdfData.split(',')[1] 
      : pdfData
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    buffer = bytes.buffer
  } else {
    buffer = pdfData
  }

  // Calcular hash SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  return `0x${hashHex}`
}

/**
 * Calcula el hash SHA-256 de un PDF desde un objeto jsPDF
 */
export async function calculatePDFHashFromJsPDF(pdf: any): Promise<string> {
  // Obtener el PDF como ArrayBuffer
  const pdfOutput = pdf.output('arraybuffer')
  return calculatePDFHash(pdfOutput)
}

/**
 * Verifica la integridad de un PDF comparando su hash
 */
export async function verifyPDFIntegrity(
  pdfData: string | ArrayBuffer,
  expectedHash: string
): Promise<boolean> {
  const calculatedHash = await calculatePDFHash(pdfData)
  return calculatedHash.toLowerCase() === expectedHash.toLowerCase()
}
