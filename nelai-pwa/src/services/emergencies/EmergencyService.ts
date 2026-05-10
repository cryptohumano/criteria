/**
 * Servicio para manejar emergencias
 * Envía emergencias a blockchain usando system.remarkWithEvent
 * (emite evento System.Remarked para facilitar la escucha)
 */

import { DedotClient } from 'dedot'
import type { KeyringPair } from '@polkadot/keyring/types'
import type { 
  Emergency, 
  CreateEmergencyData, 
  EmergencySubmissionResult,
  EmergencyRemarkData
} from '@/types/emergencies'
import { serializeEmergencyToRemark } from '@/types/emergencies'
import { v4 as uuidv4 } from 'uuid'
import { saveTransaction, type StoredTransaction } from '@/utils/transactionStorage'
import { saveEmergency } from '@/utils/emergencyStorage'

/**
 * Crea una emergencia localmente
 */
export function createEmergencyLocal(
  data: CreateEmergencyData,
  reporterAccount: string
): Emergency {
  const now = Date.now()
  
  const emergency: Emergency = {
    emergencyId: uuidv4(),
    type: data.type,
    description: data.description,
    severity: data.severity,
    location: data.location,
    relatedLogId: data.relatedLogId,
    relatedMilestoneId: data.relatedMilestoneId,
    reporterAccount,
    emergencyContacts: data.emergencyContacts,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    notes: data.notes,
    metadata: data.metadata,
    synced: false,
  }
  
  return emergency
}

/**
 * Prepara los datos para el remark
 * Incluye datos de posición, bitácora, trail y aviso de salida (lo que quepa en 32KB)
 */
export function prepareEmergencyRemarkData(
  emergency: Emergency,
  logData?: {
    title?: string
    mountainName?: string
    location?: string
    startDate?: number
    avisoSalida?: {
      guia?: {
        nombres?: string
        apellidos?: string
      }
      actividad?: {
        lugarDestino?: string
        numeroParticipantes?: number
        fechaSalida?: number
        tipoActividad?: string
      }
    }
    routes?: Array<{
      name?: string
      distance?: number
    }>
    milestones?: Array<{
      id: string
      title?: string
      type?: string
      metadata?: {
        elevation?: number
      }
    }>
  }
): EmergencyRemarkData {
  // Construir metadata con datos de la bitácora
  const metadata: EmergencyRemarkData['metadata'] = {
    ...emergency.metadata,
  }

  // Agregar datos de la bitácora
  if (logData) {
    if (logData.title) metadata.logTitle = logData.title
    if (logData.mountainName) metadata.mountainName = logData.mountainName
    if (logData.location) metadata.logLocation = logData.location
    if (logData.startDate) metadata.logStartDate = logData.startDate

    // Agregar datos del aviso de salida (resumidos)
    if (logData.avisoSalida) {
      metadata.avisoSalida = {}
      if (logData.avisoSalida.guia?.nombres) {
        metadata.avisoSalida.guiaNombre = logData.avisoSalida.guia.nombres
        if (logData.avisoSalida.guia.apellidos) {
          metadata.avisoSalida.guiaNombre += ` ${logData.avisoSalida.guia.apellidos}`
        }
      }
      if (logData.avisoSalida.actividad?.lugarDestino) {
        metadata.avisoSalida.lugarDestino = logData.avisoSalida.actividad.lugarDestino
      }
      if (logData.avisoSalida.actividad?.numeroParticipantes) {
        metadata.avisoSalida.numeroParticipantes = logData.avisoSalida.actividad.numeroParticipantes
      }
      if (logData.avisoSalida.actividad?.fechaSalida) {
        metadata.avisoSalida.fechaSalida = logData.avisoSalida.actividad.fechaSalida
      }
      if (logData.avisoSalida.actividad?.tipoActividad) {
        metadata.avisoSalida.tipoActividad = logData.avisoSalida.actividad.tipoActividad
      }
    }

    // Agregar datos del trail/ruta (primera ruta si existe)
    if (logData.routes && logData.routes.length > 0) {
      const firstRoute = logData.routes[0]
      metadata.trail = {}
      if (firstRoute.name) metadata.trail.name = firstRoute.name
      if (firstRoute.distance) metadata.trail.distance = firstRoute.distance
    }

    // Agregar datos del milestone actual si existe
    if (emergency.relatedMilestoneId && logData.milestones) {
      const milestone = logData.milestones.find(m => m.id === emergency.relatedMilestoneId)
      if (milestone) {
        metadata.milestone = {}
        if (milestone.title) metadata.milestone.title = milestone.title
        if (milestone.type) metadata.milestone.type = milestone.type
        if (milestone.metadata?.elevation) metadata.milestone.elevation = milestone.metadata.elevation
      }
    }
  }

  const remarkData: EmergencyRemarkData = {
    emergencyId: emergency.emergencyId,
    version: '1.0',
    type: emergency.type,
    severity: emergency.severity,
    description: emergency.description,
    location: {
      latitude: emergency.location.latitude,
      longitude: emergency.location.longitude,
      altitude: emergency.location.altitude,
      accuracy: emergency.location.accuracy,
      timestamp: emergency.location.timestamp,
    },
    relatedLogId: emergency.relatedLogId,
    relatedMilestoneId: emergency.relatedMilestoneId,
    reporterAccount: emergency.reporterAccount,
    createdAt: emergency.createdAt,
    reportedAt: Date.now(),
    metadata,
  }
  
  return remarkData
}

/**
 * Envía una emergencia a blockchain usando system.remarkWithEvent
 * Este método emite un evento System.Remarked que facilita la escucha
 * y monitoreo de emergencias en la blockchain
 */
export async function submitEmergencyToBlockchain(
  client: DedotClient,
  pair: KeyringPair,
  emergency: Emergency,
  logData?: Parameters<typeof prepareEmergencyRemarkData>[1]
): Promise<EmergencySubmissionResult> {
  // PROTECCIÓN: Verificar que la emergencia no haya sido enviada ya
  if (emergency.blockchainTxHash) {
    console.warn('[EmergencyService] ⚠️ Emergencia ya enviada anteriormente:', {
      emergencyId: emergency.emergencyId,
      txHash: emergency.blockchainTxHash,
      blockNumber: emergency.blockchainBlockNumber,
    })
    return {
      success: true,
      txHash: emergency.blockchainTxHash,
      blockNumber: emergency.blockchainBlockNumber,
      extrinsicIndex: emergency.blockchainExtrinsicIndex,
    }
  }

  // PROTECCIÓN: Verificar que no esté en estado submitted
  if (emergency.status === 'submitted' && emergency.submittedAt) {
    console.warn('[EmergencyService] ⚠️ Emergencia ya está en estado submitted:', {
      emergencyId: emergency.emergencyId,
      status: emergency.status,
      submittedAt: emergency.submittedAt,
    })
    return {
      success: true,
      txHash: emergency.blockchainTxHash,
      blockNumber: emergency.blockchainBlockNumber,
      extrinsicIndex: emergency.blockchainExtrinsicIndex,
    }
  }

  try {
    // Preparar datos del remark (incluye datos de bitácora si están disponibles)
    const remarkData = prepareEmergencyRemarkData(emergency, logData)
    
    // Importar función de serialización
    const { serializeEmergencyToRemark } = await import('@/types/emergencies')
    
    // Serializar a formato remark
    let remarkString = serializeEmergencyToRemark(remarkData)
    
    console.log('[EmergencyService] Enviando emergencia a blockchain:', {
      emergencyId: emergency.emergencyId,
      type: emergency.type,
      severity: emergency.severity,
      remarkLength: remarkString.length,
      // Datos incluidos en el remark
      datosIncluidos: {
        gps: {
          lat: remarkData.location.latitude,
          lon: remarkData.location.longitude,
          alt: remarkData.location.altitude,
          accuracy: remarkData.location.accuracy,
        },
        descripcion: remarkData.description.substring(0, 50) + '...',
        tieneMetadata: !!remarkData.metadata,
        metadataKeys: remarkData.metadata ? Object.keys(remarkData.metadata) : [],
        tieneBitacora: !!(remarkData.metadata?.logTitle || remarkData.metadata?.mountainName),
        tieneAvisoSalida: !!remarkData.metadata?.avisoSalida,
        tieneTrail: !!remarkData.metadata?.trail,
        tieneMilestone: !!remarkData.metadata?.milestone,
      },
      // Preview del remark (primeros 200 caracteres)
      remarkPreview: remarkString.substring(0, 200) + '...',
    })
    
    // Verificar que el remark no sea demasiado largo
    // Los remarks en Substrate tienen un límite (típicamente 32KB)
    // Si excede, reducir metadata progresivamente
    const MAX_REMARK_SIZE = 30000 // Dejar margen de seguridad
    
    if (remarkString.length > MAX_REMARK_SIZE) {
      console.warn('[EmergencyService] ⚠️ Remark demasiado largo, reduciendo metadata...', {
        originalLength: remarkString.length,
        maxSize: MAX_REMARK_SIZE,
      })
      
      // Intentar reducir metadata si es necesario
      if (remarkData.metadata) {
        // Eliminar datos menos críticos primero
        const reducedMetadata = { ...remarkData.metadata }
        delete reducedMetadata.trail
        delete reducedMetadata.milestone
        if (reducedMetadata.avisoSalida) {
          // Mantener solo datos esenciales del aviso de salida
          reducedMetadata.avisoSalida = {
            lugarDestino: reducedMetadata.avisoSalida.lugarDestino,
            numeroParticipantes: reducedMetadata.avisoSalida.numeroParticipantes,
            fechaSalida: reducedMetadata.avisoSalida.fechaSalida,
          }
        }
        
        remarkData.metadata = reducedMetadata
        remarkString = serializeEmergencyToRemark(remarkData)
        
        // Si aún es demasiado largo, reducir más
        if (remarkString.length > MAX_REMARK_SIZE) {
          // Eliminar más metadata
          delete reducedMetadata.avisoSalida
          remarkData.metadata = reducedMetadata
          remarkString = serializeEmergencyToRemark(remarkData)
        }
        
        // Si aún es demasiado largo después de reducir, lanzar error
        if (remarkString.length > MAX_REMARK_SIZE) {
          throw new Error(`El remark es demasiado largo (${remarkString.length} bytes). Reduce la descripción.`)
        }
        
        console.log('[EmergencyService] ✅ Remark reducido a:', remarkString.length, 'bytes')
      } else {
        throw new Error(`El remark es demasiado largo (${remarkString.length} bytes). Reduce la descripción.`)
      }
    }
    
    // Crear transacción system.remarkWithEvent (emite evento System.Remarked)
    const tx = client.tx.system.remarkWithEvent(remarkString)
    
    // Firmar y enviar usando el mismo patrón que Send.tsx
    let txHash: string | undefined
    let blockNumber: number | undefined
    let extrinsicIndex: number | undefined
    
    const result = await tx.signAndSend(
      pair,
      {}, // Opciones del signer (vacías por defecto)
      async (result) => {
        // Callback para actualizaciones de estado
        const { status } = result
        txHash = result.txHash
        
        if (status.type === 'BestChainBlockIncluded' || status.type === 'Finalized') {
          if (status.type === 'Finalized') {
            blockNumber = status.value.blockNumber
            extrinsicIndex = status.value.extrinsicIndex
          }
        }
      }
    ).untilFinalized()
    
    // Obtener información final
    txHash = result.txHash
    if (result.status.type === 'Finalized') {
      blockNumber = result.status.value.blockNumber
      extrinsicIndex = result.status.value.extrinsicIndex
    }
    
    console.log('[EmergencyService] ✅ Emergencia enviada exitosamente:', {
      emergencyId: emergency.emergencyId,
      txHash,
      blockNumber,
      extrinsicIndex,
    })
    
    return {
      success: true,
      txHash,
      blockNumber,
      extrinsicIndex,
    }
  } catch (error) {
    console.error('[EmergencyService] ❌ Error al enviar emergencia:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Actualiza una emergencia con los resultados de la blockchain
 */
export function updateEmergencyWithBlockchainResult(
  emergency: Emergency,
  result: EmergencySubmissionResult
): Emergency {
  return {
    ...emergency,
    status: result.success ? 'submitted' : 'pending',
    blockchainTxHash: result.txHash,
    blockchainBlockNumber: result.blockNumber,
    blockchainExtrinsicIndex: result.extrinsicIndex,
    submittedAt: result.success ? Date.now() : emergency.submittedAt,
    updatedAt: Date.now(),
    syncError: result.error,
  }
}
