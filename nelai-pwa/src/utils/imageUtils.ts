/**
 * Utilidades para mostrar imágenes en la app.
 * Normaliza data URLs, base64 raw y maneja casos sin datos.
 */

/**
 * Obtiene un src válido para <img> desde image.data o thumbnail.
 * - Si es data URL (data:image/...) o blob URL → se usa tal cual
 * - Si es base64 raw sin prefijo → se añade data:image/jpeg;base64,
 * - Si falta → undefined (mostrar placeholder)
 */
export function getImageSrc(
  data?: string | null,
  thumbnail?: string | null,
  mimeType?: string
): string | undefined {
  const raw = thumbnail || data
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  // Ya es data URL o blob URL
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed
  }
  // Base64 raw sin prefijo
  const mime = mimeType?.includes('png') ? 'image/png' : 'image/jpeg'
  return `data:${mime};base64,${trimmed}`
}
