/**
 * Utilidades para manejar PDFs
 */

/**
 * Descarga un PDF desde base64
 */
export function downloadPDF(base64: string, filename: string): void {
  try {
    // Convertir base64 a blob
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'application/pdf' })

    // Crear URL del blob
    const url = URL.createObjectURL(blob)

    // Crear elemento <a> para descargar
    const link = document.createElement('a')
    link.href = url
    link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
    document.body.appendChild(link)
    link.click()

    // Limpiar
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error al descargar PDF:', error)
    throw error
  }
}

/**
 * Convierte base64 a Blob URL para visualización
 */
export function base64ToBlobURL(base64: string): string {
  try {
    // Limpiar el base64 si tiene prefijo data URI
    let cleanBase64 = base64.trim()
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1]
    }
    
    // Validar que no esté vacío
    if (!cleanBase64 || cleanBase64.length === 0) {
      throw new Error('Base64 string está vacío')
    }
    
    const byteCharacters = atob(cleanBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    
    // Validar que el blob no esté vacío
    if (byteArray.length === 0) {
      throw new Error('El PDF generado está vacío')
    }
    
    const blob = new Blob([byteArray], { type: 'application/pdf' })
    
    // Validar tamaño del blob
    if (blob.size === 0) {
      throw new Error('El blob del PDF está vacío')
    }
    
    return URL.createObjectURL(blob)
  } catch (error) {
    console.error('Error al convertir base64 a Blob URL:', error)
    console.error('Base64 length:', base64?.length)
    console.error('Base64 preview:', base64?.substring(0, 200))
    throw error
  }
}

/**
 * Abre un PDF en una nueva ventana/pestaña
 */
export function openPDFInNewTab(base64: string): void {
  try {
    const blobURL = base64ToBlobURL(base64)
    window.open(blobURL, '_blank')
    // Nota: No revocar la URL inmediatamente, dejar que el navegador la maneje
  } catch (error) {
    console.error('Error al abrir PDF:', error)
    throw error
  }
}

