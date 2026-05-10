/**
 * Utilidades para generar y leer datos compartidos vía QR
 */

// Hash calculation using Web Crypto API (browser compatible)
import type { QRData, QRPersonalData, QRExpeditionInvite, QRExpeditionSync } from '@/types/qrSharing'
import type { MountainLog } from '@/types/mountainLogs'

const QR_VERSION = '1.0.0'
const MAX_QR_SIZE = 2953 // bytes (versión 40-L binario)

/**
 * Calcula el hash SHA-256 de los datos usando Web Crypto API
 */
async function calculateHashAsync(data: Omit<QRData, 'hash'>): Promise<string> {
  const jsonString = JSON.stringify(data)
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(jsonString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32) // Primeros 32 caracteres
}

/**
 * Calcula el hash de forma síncrona (versión simplificada para compatibilidad)
 */
function calculateHash(data: Omit<QRData, 'hash'>): string {
  const jsonString = JSON.stringify(data)
  // Versión simplificada: hash de los primeros caracteres del JSON
  // En producción, usar calculateHashAsync
  let hash = 0
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/**
 * Genera datos personales para QR
 */
export function generatePersonalDataQR(
  personalInfo: QRPersonalData['personalInfo'],
  contactosEmergencia?: QRPersonalData['contactosEmergencia'],
  substrateAccount?: string
): QRPersonalData {
  const data: Omit<QRPersonalData, 'hash'> = {
    version: QR_VERSION,
    type: 'personal_data',
    timestamp: Date.now(),
    personalInfo,
    contactosEmergencia: contactosEmergencia?.slice(0, 3), // Máximo 3 para mantener QR pequeño
    substrateAccount,
  }
  
  return {
    ...data,
    hash: calculateHash(data),
  }
}

/**
 * Genera invitación a expedición para QR
 */
export function generateExpeditionInviteQR(
  expeditionId: string,
  leader: QRExpeditionInvite['leader'],
  expedition: QRExpeditionInvite['expedition'],
  syncCode: string
): QRExpeditionInvite {
  const data: Omit<QRExpeditionInvite, 'hash'> = {
    version: QR_VERSION,
    type: 'expedition_invite',
    timestamp: Date.now(),
    expeditionId,
    leader,
    expedition,
    syncCode,
  }
  
  return {
    ...data,
    hash: calculateHash(data),
  }
}

/**
 * Genera datos de sincronización para QR
 */
export function generateExpeditionSyncQR(
  expeditionId: string,
  updates: QRExpeditionSync['updates'],
  syncCode: string
): QRExpeditionSync {
  const data: Omit<QRExpeditionSync, 'hash'> = {
    version: QR_VERSION,
    type: 'expedition_sync',
    timestamp: Date.now(),
    expeditionId,
    updates,
    syncCode,
  }
  
  return {
    ...data,
    hash: calculateHash(data),
  }
}

/**
 * Convierte datos QR a string JSON (para generar QR)
 */
export function qrDataToJSON(data: QRData): string {
  return JSON.stringify(data)
}

/**
 * Parsea string JSON a datos QR
 */
export function parseQRData(jsonString: string): QRData | null {
  try {
    const data = JSON.parse(jsonString) as QRData
    
    // Validar estructura básica
    if (!data.version || !data.type || !data.timestamp) {
      return null
    }
    
    // Validar hash
    const { hash, ...dataWithoutHash } = data
    const calculatedHash = calculateHash(dataWithoutHash)
    
    if (hash !== calculatedHash) {
      console.warn('[QR Sharing] Hash de verificación no coincide')
      // Por ahora permitir continuar, pero registrar advertencia
    }
    
    return data
  } catch (error) {
    console.error('[QR Sharing] Error al parsear datos QR:', error)
    return null
  }
}

/**
 * Estima el tamaño en bytes de los datos QR
 */
export function estimateQRSize(data: QRData): number {
  const jsonString = qrDataToJSON(data)
  // Estimar tamaño en bytes (UTF-8)
  return new Blob([jsonString]).size
}

/**
 * Verifica si los datos caben en un QR estándar
 */
export function fitsInQR(data: QRData): boolean {
  const size = estimateQRSize(data)
  return size <= MAX_QR_SIZE
}

/**
 * Extrae datos personales del aviso de salida para QR
 */
export function extractPersonalDataFromAvisoSalida(
  avisoSalida: MountainLog['avisoSalida']
): QRPersonalData['personalInfo'] | null {
  if (!avisoSalida?.guia) {
    return null
  }
  
  return {
    nombres: avisoSalida.guia.nombres,
    apellidos: avisoSalida.guia.apellidos,
    documentoIdentidad: avisoSalida.guia.documentoIdentidad,
    rutPasaporte: avisoSalida.guia.rutPasaporte,
    email: avisoSalida.guia.email,
    telefono: avisoSalida.guia.telefono,
    nacionalidad: avisoSalida.guia.nacionalidad,
    edad: avisoSalida.guia.edad,
    profesion: avisoSalida.guia.profesion,
    domicilio: avisoSalida.guia.domicilio,
    institucionEmpresa: avisoSalida.guia.institucionEmpresa,
    previsionSalud: avisoSalida.guia.previsionSalud,
  }
}

/**
 * Aplica datos personales del QR al aviso de salida
 */
export function applyPersonalDataToAvisoSalida(
  personalData: QRPersonalData['personalInfo'],
  avisoSalida: MountainLog['avisoSalida']
): MountainLog['avisoSalida'] {
  return {
    ...avisoSalida,
    guia: {
      ...avisoSalida?.guia,
      nombres: personalData.nombres || avisoSalida?.guia?.nombres || '',
      apellidos: personalData.apellidos || avisoSalida?.guia?.apellidos || '',
      documentoIdentidad: personalData.documentoIdentidad || avisoSalida?.guia?.documentoIdentidad,
      rutPasaporte: personalData.rutPasaporte || avisoSalida?.guia?.rutPasaporte,
      email: personalData.email || avisoSalida?.guia?.email,
      telefono: personalData.telefono || avisoSalida?.guia?.telefono,
      nacionalidad: personalData.nacionalidad || avisoSalida?.guia?.nacionalidad,
      edad: personalData.edad || avisoSalida?.guia?.edad,
      profesion: personalData.profesion || avisoSalida?.guia?.profesion,
      domicilio: personalData.domicilio || avisoSalida?.guia?.domicilio,
      institucionEmpresa: personalData.institucionEmpresa || avisoSalida?.guia?.institucionEmpresa,
      previsionSalud: personalData.previsionSalud || avisoSalida?.guia?.previsionSalud,
      // Mantener campos booleanos existentes
      experienciaSector: avisoSalida?.guia?.experienciaSector || false,
      experienciaExpediciones: avisoSalida?.guia?.experienciaExpediciones || false,
      seguroAccidente: avisoSalida?.guia?.seguroAccidente || false,
    },
  }
}

/**
 * Genera código de sincronización único
 */
export function generateSyncCode(): string {
  // Generar código alfanumérico de 8 caracteres
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
