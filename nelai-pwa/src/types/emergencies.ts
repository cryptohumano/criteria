/**
 * Tipos TypeScript para el sistema de emergencias
 * Compatible con el sistema de emergencias de Lumo
 */

import type { GPSPoint } from './mountainLogs'

/**
 * Tipos de emergencia según el sistema de Lumo
 */
export type EmergencyType = 
  | 'medical'           // Emergencia médica
  | 'rescue'            // Rescate
  | 'weather'           // Condiciones climáticas extremas
  | 'equipment'         // Fallo de equipo crítico
  | 'lost'              // Extraviado
  | 'injury'            // Lesión
  | 'illness'           // Enfermedad
  | 'avalanche'         // Avalancha
  | 'rockfall'          // Caída de rocas
  | 'other'             // Otra

/**
 * Severidad de la emergencia
 */
export type EmergencySeverity = 
  | 'low'               // Baja - No urgente
  | 'medium'            // Media - Requiere atención
  | 'high'              // Alta - Urgente
  | 'critical'          // Crítica - Inmediata

/**
 * Estado de la emergencia
 */
export type EmergencyStatus = 
  | 'pending'           // Pendiente de envío (offline)
  | 'submitted'        // Enviada a blockchain (remark)
  | 'acknowledged'      // Reconocida por servicios de emergencia
  | 'in_progress'      // En proceso de atención
  | 'resolved'         // Resuelta
  | 'cancelled'        // Cancelada (falsa alarma)

/**
 * Estructura de emergencia para envío a blockchain (remark)
 * Esta es la estructura que se serializa en el remark
 */
export interface EmergencyRemarkData {
  // Identificación
  emergencyId: string              // UUID local
  version: string                   // Versión del formato (ej: "1.0")
  
  // Tipo y descripción
  type: EmergencyType
  severity: EmergencySeverity
  description: string
  
  // Ubicación
  location: {
    latitude: number
    longitude: number
    altitude?: number
    accuracy?: number
    timestamp: number
  }
  
  // Relación con bitácora
  relatedLogId?: string            // ID de la bitácora relacionada
  relatedMilestoneId?: string       // ID del milestone donde ocurrió
  
  // Reporter
  reporterAccount: string           // Cuenta Substrate que reporta
  
  // Timestamps
  createdAt: number                // Timestamp de creación
  reportedAt: number               // Timestamp de reporte
  
  // Metadata adicional (opcional, para no hacer el remark muy grande)
  metadata?: {
    // Datos de la bitácora
    logTitle?: string
    mountainName?: string
    logLocation?: string
    logStartDate?: number
    
    // Datos del aviso de salida (resumidos para caber en remark)
    avisoSalida?: {
      guiaNombre?: string // Solo nombre del guía
      lugarDestino?: string
      numeroParticipantes?: number
      fechaSalida?: number
      tipoActividad?: string
    }
    
    // Datos del trail/ruta (si está disponible)
    trail?: {
      name?: string
      distance?: number // en metros
    }
    
    // Datos del milestone actual
    milestone?: {
      title?: string
      type?: string
      elevation?: number
    }
    
    // Datos climáticos
    weather?: string
    temperature?: number
    visibility?: number
    
    [key: string]: any
  }
}

/**
 * Estructura completa de emergencia (local + blockchain)
 */
export interface Emergency {
  // Identificación
  emergencyId: string              // UUID local
  blockchainTxHash?: string         // Hash de transacción blockchain
  blockchainBlockNumber?: number    // Número de bloque donde se registró
  blockchainExtrinsicIndex?: number // Índice del extrinsic
  
  // Tipo y descripción
  type: EmergencyType
  description: string
  severity: EmergencySeverity
  
  // Ubicación
  location: GPSPoint
  
  // Relación con bitácora
  relatedLogId?: string            // ID de la bitácora relacionada
  relatedMilestoneId?: string       // ID del milestone donde ocurrió
  
  // Contactos
  reporterAccount: string           // Cuenta Substrate que reporta
  emergencyContacts?: Array<{      // Contactos de emergencia del Aviso de Salida
    nombres: string
    telefonos: string[]
  }>
  
  // Estado
  status: EmergencyStatus
  createdAt: number
  updatedAt: number
  submittedAt?: number              // Cuando se envió a blockchain
  acknowledgedAt?: number           // Cuando fue reconocida
  resolvedAt?: number               // Cuando fue resuelta
  
  // Metadata adicional
  images?: string[]                 // IDs de imágenes relacionadas (de la bitácora)
  notes?: string
  metadata?: Record<string, any>
  
  // Sincronización
  synced: boolean                   // Si está sincronizado con backend de Lumo
  lastSyncAttempt?: number
  syncError?: string
  
  // Datos del remark (para referencia)
  remarkData?: EmergencyRemarkData
}

/**
 * Datos necesarios para crear una emergencia
 */
export interface CreateEmergencyData {
  type: EmergencyType
  description: string
  severity: EmergencySeverity
  location: GPSPoint
  relatedLogId?: string
  relatedMilestoneId?: string
  emergencyContacts?: Array<{
    nombres: string
    telefonos: string[]
  }>
  notes?: string
  metadata?: Record<string, any>
}

/**
 * Resultado de enviar emergencia a blockchain
 */
export interface EmergencySubmissionResult {
  success: boolean
  txHash?: string
  blockNumber?: number
  extrinsicIndex?: number
  error?: string
}

/**
 * Formato del remark para blockchain
 * El remark debe seguir un formato específico para que el listener de Lumo lo pueda parsear
 */
export interface EmergencyRemarkFormat {
  prefix: 'EMERGENCY'              // Prefijo para identificar emergencias
  version: string                  // Versión del formato
  data: EmergencyRemarkData        // Datos de la emergencia
}

/**
 * Constantes para el sistema de emergencias
 */
export const EMERGENCY_REMARK_PREFIX = 'EMERGENCY'
export const EMERGENCY_REMARK_VERSION = '1.0'
export const EMERGENCY_REMARK_SEPARATOR = ':'

/**
 * Helper para serializar emergencia a formato remark
 */
export function serializeEmergencyToRemark(data: EmergencyRemarkData): string {
  const remarkFormat: EmergencyRemarkFormat = {
    prefix: EMERGENCY_REMARK_PREFIX,
    version: EMERGENCY_REMARK_VERSION,
    data
  }
  
  // Serializar a JSON y crear el remark
  const remarkString = `${EMERGENCY_REMARK_PREFIX}${EMERGENCY_REMARK_SEPARATOR}${JSON.stringify(remarkFormat)}`
  
  return remarkString
}

/**
 * Helper para parsear remark y extraer datos de emergencia
 */
export function parseEmergencyFromRemark(remark: string): EmergencyRemarkData | null {
  try {
    // Verificar prefijo
    if (!remark.startsWith(EMERGENCY_REMARK_PREFIX + EMERGENCY_REMARK_SEPARATOR)) {
      return null
    }
    
    // Extraer JSON
    const jsonPart = remark.substring(EMERGENCY_REMARK_PREFIX.length + EMERGENCY_REMARK_SEPARATOR.length)
    const parsed = JSON.parse(jsonPart) as EmergencyRemarkFormat
    
    // Validar estructura
    if (parsed.prefix !== EMERGENCY_REMARK_PREFIX || !parsed.data) {
      return null
    }
    
    return parsed.data
  } catch (error) {
    console.error('[Emergency] Error al parsear remark:', error)
    return null
  }
}
