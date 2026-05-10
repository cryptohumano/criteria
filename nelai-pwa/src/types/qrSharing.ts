/**
 * Tipos para el sistema de compartir datos vía QR
 */

import type { MountainLog } from './mountainLogs'

/**
 * Datos personales que se pueden compartir vía QR
 * Versión compacta para caber en QR (máx ~3KB)
 */
export interface QRPersonalData {
  version: string // Versión del formato QR (para compatibilidad futura)
  type: 'personal_data' | 'expedition_invite' | 'expedition_sync'
  timestamp: number
  
  // Datos personales básicos (para auto-llenar formularios)
  personalInfo: {
    nombres: string
    apellidos: string
    documentoIdentidad?: string
    rutPasaporte?: string
    email?: string
    telefono?: string
    nacionalidad?: string
    edad?: number
    profesion?: string
    domicilio?: string
    institucionEmpresa?: string
    previsionSalud?: string
  }
  
  // Contactos de emergencia (máximo 3 para mantener QR pequeño)
  contactosEmergencia?: Array<{
    nombres: string
    telefonos: string[]
  }>
  
  // Cuenta Substrate asociada (opcional)
  substrateAccount?: string
  
  // Hash de verificación (SHA-256 de los datos)
  hash: string
}

/**
 * Invitación a expedición (para unirse como participante)
 */
export interface QRExpeditionInvite {
  version: string
  type: 'expedition_invite'
  timestamp: number
  
  // ID de la expedición (logId)
  expeditionId: string
  
  // Datos del líder
  leader: {
    nombres: string
    apellidos: string
    substrateAccount?: string
    telefono?: string
  }
  
  // Información básica de la expedición
  expedition: {
    title: string
    mountainName?: string
    location?: string
    fechaSalida: number
    fechaRegreso?: number
    tipoActividad?: string
  }
  
  // Código de sincronización (para P2P)
  syncCode: string // Código único para conectar P2P
  
  // Hash de verificación
  hash: string
}

/**
 * Sincronización de datos de expedición (P2P)
 */
export interface QRExpeditionSync {
  version: string
  type: 'expedition_sync'
  timestamp: number
  
  expeditionId: string
  
  // Datos a sincronizar (solo cambios incrementales)
  updates: {
    milestones?: number // Número de milestones
    gpsPoints?: number // Número de puntos GPS
    status?: MountainLog['status']
    lastUpdate?: number // Timestamp de última actualización
  }
  
  // Código de sincronización
  syncCode: string
  
  // Hash de verificación
  hash: string
}

export type QRData = QRPersonalData | QRExpeditionInvite | QRExpeditionSync
