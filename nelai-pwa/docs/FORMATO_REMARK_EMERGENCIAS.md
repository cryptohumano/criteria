# Formato de Remark para Emergencias

Este documento explica cómo se serializa, envía, escucha y decodifica el remark de emergencias en la blockchain.

## 📋 Índice

1. [Serialización del Remark (Envío)](#-serialización-del-remark-envío)
2. [Escucha y Decodificación (Recepción)](#-escucha-y-decodificación-del-remark-recepción)
3. [Flujo Completo](#-flujo-completo)
4. [Ejemplo Completo](#-ejemplo-completo-de-remark)
5. [Implementación del Listener](#-implementación-del-listener)
6. [Resumen](#-resumen)

## 📤 Serialización del Remark (Envío)

### Formato del Remark

El remark se serializa en el siguiente formato:

```
EMERGENCY:{"prefix":"EMERGENCY","version":"1.0","data":{...datos de emergencia...}}
```

### Estructura Completa

```typescript
interface EmergencyRemarkFormat {
  prefix: 'EMERGENCY'              // Prefijo para identificar emergencias
  version: string                  // Versión del formato (ej: "1.0")
  data: EmergencyRemarkData        // Datos de la emergencia
}

interface EmergencyRemarkData {
  // Identificación
  emergencyId: string              // UUID local
  version: string                   // Versión del formato
  
  // Tipo y descripción
  type: EmergencyType              // 'medical' | 'rescue' | 'weather' | etc.
  severity: EmergencySeverity      // 'low' | 'medium' | 'high' | 'critical'
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
  relatedLogId?: string
  relatedMilestoneId?: string
  
  // Reporter
  reporterAccount: string          // Cuenta Substrate (SS58)
  
  // Timestamps
  createdAt: number
  reportedAt: number
  
  // Metadata adicional
  metadata?: {
    logTitle?: string
    mountainName?: string
    logLocation?: string
    logStartDate?: number
    avisoSalida?: {
      guiaNombre?: string
      lugarDestino?: string
      numeroParticipantes?: number
      fechaSalida?: number
      tipoActividad?: string
    }
    trail?: {
      name?: string
      distance?: number
    }
    milestone?: {
      title?: string
      type?: string
      elevation?: number
    }
    [key: string]: any
  }
}
```

### Función de Serialización

```typescript
// src/types/emergencies.ts

export const EMERGENCY_REMARK_PREFIX = 'EMERGENCY'
export const EMERGENCY_REMARK_VERSION = '1.0'
export const EMERGENCY_REMARK_SEPARATOR = ':'

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
```

### Ejemplo de Remark Serializado

```json
EMERGENCY:{"prefix":"EMERGENCY","version":"1.0","data":{"emergencyId":"550e8400-e29b-41d4-a716-446655440000","version":"1.0","type":"medical","severity":"high","description":"Lesión en la rodilla durante descenso","location":{"latitude":-33.4489,"longitude":-70.6693,"altitude":3500,"accuracy":10,"timestamp":1704067200000},"relatedLogId":"log-123","relatedMilestoneId":"milestone-456","reporterAccount":"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY","createdAt":1704067200000,"reportedAt":1704067200000,"metadata":{"logTitle":"Ascenso al Cerro El Plomo","mountainName":"Cerro El Plomo","logLocation":"Cordillera de los Andes","logStartDate":1704000000000,"avisoSalida":{"guiaNombre":"Juan Pérez","lugarDestino":"Cerro El Plomo","numeroParticipantes":4,"fechaSalida":1704000000000,"tipoActividad":"Montañismo"},"milestone":{"title":"Campamento Base","type":"camp","elevation":3500}}}}
```

### Envío a Blockchain

```typescript
// src/services/emergencies/EmergencyService.ts

export async function submitEmergencyToBlockchain(
  client: DedotClient,
  pair: KeyringPair,
  emergency: Emergency,
  logData?: {...}
): Promise<EmergencySubmissionResult> {
  // 1. Preparar datos del remark
  const remarkData = prepareEmergencyRemarkData(emergency, logData)
  
  // 2. Serializar a formato remark
  const remarkString = serializeEmergencyToRemark(remarkData)
  
  // 3. Verificar tamaño (máximo ~30KB)
  const MAX_REMARK_SIZE = 30000
  if (remarkString.length > MAX_REMARK_SIZE) {
    // Reducir metadata progresivamente
    // ...
  }
  
  // 4. Crear transacción system.remarkWithEvent (emite evento System.Remarked)
  const tx = client.tx.system.remarkWithEvent(remarkString)
  
  // 5. Firmar y enviar
  const txHash = await tx.signAndSend(pair)
  
  return { success: true, txHash, ... }
}
```

## 📥 Escucha y Decodificación del Remark (Recepción)

### Estrategia de Escucha

**Recomendada**: Escuchar eventos `System.Remarked` y extraer el contenido del remark desde el bloque.

### Paso 1: Escuchar Eventos System.Remarked

**Importante**: Los eventos `System.Remarked` solo contienen el hash del remark, NO el contenido. Necesitamos obtener el contenido desde la extrinsic del bloque.

```typescript
// src/hooks/useRemarkListener.ts

import { useEffect, useState, useCallback } from 'react'
import { useNetwork } from '@/contexts/NetworkContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { parseEmergencyFromRemark } from '@/types/emergencies'
import { saveEmergency } from '@/utils/emergencyStorage'
import { createEmergencyLocal } from '@/services/emergencies/EmergencyService'

export function useRemarkListener() {
  const { client } = useNetwork()
  const { activeAccount } = useActiveAccount()
  const [isListening, setIsListening] = useState(false)
  const [receivedCount, setReceivedCount] = useState(0)

  useEffect(() => {
    if (!client || !activeAccount) {
      setIsListening(false)
      return
    }

    let unsubscribe: (() => void) | null = null

    const startListening = async () => {
      try {
        // Suscribirse a eventos System.Remarked
        unsubscribe = await client.query.system.events(async (eventRecords: any[]) => {
          try {
            // Filtrar solo eventos System.Remarked
            const remarkEvents = eventRecords.filter((record: any) => {
              const event = record?.event
              return event?.pallet === 'System' && event?.name === 'Remarked'
            })
            
            // Solo procesar si hay remarks
            if (remarkEvents.length === 0) {
              return
            }
            
            // Para cada remark, obtener el contenido del bloque
            for (const eventRecord of remarkEvents) {
              const event = eventRecord.event
              const [accountId, remarkHash] = event.data
              
              // Obtener el bloque completo (solo cuando hay remark)
              const blockHash = eventRecord.blockHash
              const extrinsicIndex = eventRecord.extrinsicIndex
              
              try {
                // Obtener el bloque
                const block = await client.chain.getBlock(blockHash)
                const extrinsic = block.block.extrinsics[extrinsicIndex]
                
                // Verificar que es system.remark
                if (extrinsic?.method?.pallet === 'System' && 
                    extrinsic?.method?.method === 'remark') {
                  
                  // Extraer contenido del remark
                  // El contenido está en el primer argumento de system.remark
                  // system.remark(bytes) → args[0] es el string del remark
                  const remarkContent = extrinsic.method.args[0] as string
                  
                  // El remarkContent es el string completo: "EMERGENCY:{"prefix":"EMERGENCY",..."
                  console.log('[RemarkListener] Remark encontrado:', {
                    length: remarkContent.length,
                    preview: remarkContent.substring(0, 50) + '...',
                    startsWithEmergency: remarkContent.startsWith('EMERGENCY:')
                  })
                  
                  // Parsear si es emergencia
                  const emergencyData = parseEmergencyFromRemark(remarkContent)
                  if (emergencyData) {
                    // Filtrar por cuenta activa
                    if (emergencyData.reporterAccount === activeAccount) {
                      // Procesar emergencia
                      await processEmergency(emergencyData)
                    }
                  }
                }
              } catch (error) {
                console.error('[RemarkListener] Error al procesar remark:', error)
              }
            }
          } catch (error) {
            console.error('[RemarkListener] Error al procesar eventos:', error)
          }
        })
        
        setIsListening(true)
        console.log('[RemarkListener] Escucha iniciada (eventos System.Remarked)')
      } catch (error) {
        console.error('[RemarkListener] Error al iniciar escucha:', error)
        setIsListening(false)
      }
    }

    startListening()

    return () => {
      if (unsubscribe) {
        unsubscribe()
        setIsListening(false)
        console.log('[RemarkListener] Escucha detenida')
      }
    }
  }, [client, activeAccount])

  return { isListening, receivedCount }
}
```

### Paso 2: Parsear el Remark

```typescript
// src/types/emergencies.ts

export function parseEmergencyFromRemark(remark: string): EmergencyRemarkData | null {
  try {
    // 1. Verificar prefijo
    if (!remark.startsWith(EMERGENCY_REMARK_PREFIX + EMERGENCY_REMARK_SEPARATOR)) {
      return null // No es una emergencia
    }
    
    // 2. Extraer JSON (después de "EMERGENCY:")
    const jsonPart = remark.substring(
      EMERGENCY_REMARK_PREFIX.length + EMERGENCY_REMARK_SEPARATOR.length
    )
    
    // 3. Parsear JSON
    const parsed = JSON.parse(jsonPart) as EmergencyRemarkFormat
    
    // 4. Validar estructura
    if (parsed.prefix !== EMERGENCY_REMARK_PREFIX || !parsed.data) {
      return null // Formato inválido
    }
    
    // 5. Retornar datos de emergencia
    return parsed.data
  } catch (error) {
    console.error('[Emergency] Error al parsear remark:', error)
    return null
  }
}
```

### Paso 3: Procesar la Emergencia

```typescript
// En useRemarkListener.ts

const processEmergency = useCallback(async (remarkData: EmergencyRemarkData) => {
  try {
    // 1. Crear Emergency desde los datos del remark
    const emergency = createEmergencyLocal({
      type: remarkData.type,
      severity: remarkData.severity,
      description: remarkData.description,
      location: {
        latitude: remarkData.location.latitude,
        longitude: remarkData.location.longitude,
        altitude: remarkData.location.altitude,
        accuracy: remarkData.location.accuracy,
        timestamp: remarkData.location.timestamp,
      },
      relatedLogId: remarkData.relatedLogId,
      relatedMilestoneId: remarkData.relatedMilestoneId,
      metadata: remarkData.metadata,
    }, remarkData.reporterAccount)

    // 2. Actualizar con datos del blockchain
    emergency.status = 'submitted'
    emergency.submittedAt = remarkData.reportedAt
    emergency.synced = true

    // 3. Guardar en IndexedDB
    await saveEmergency(emergency)
    setReceivedCount(prev => prev + 1)
    
    // 4. Notificar al usuario
    console.log('[RemarkListener] Emergencia recibida:', emergency.emergencyId)
    toast.success('Nueva emergencia recibida', {
      description: `Tipo: ${emergency.type}, Severidad: ${emergency.severity}`
    })
  } catch (error) {
    console.error('[RemarkListener] Error al procesar emergencia:', error)
  }
}, [])
```

## 🔍 Flujo Completo

### Envío (Cliente → Blockchain)

```
1. Usuario activa emergencia
   ↓
2. createEmergencyLocal() → Crea Emergency local
   ↓
3. prepareEmergencyRemarkData() → Prepara EmergencyRemarkData
   ↓
4. serializeEmergencyToRemark() → Serializa a string
   Formato: "EMERGENCY:{"prefix":"EMERGENCY","version":"1.0","data":{...}}"
   ↓
5. client.tx.system.remark(remarkString) → Crea transacción
   ↓
6. tx.signAndSend(pair) → Firma y envía
   ↓
7. Blockchain procesa → Emite evento System.Remarked
```

### Recepción (Blockchain → Cliente)

```
1. Escuchar eventos System.Remarked
   ↓
2. Para cada evento System.Remarked:
   - Obtener blockHash y extrinsicIndex
   - Obtener bloque completo
   - Extraer extrinsic[extrinsicIndex]
   - Verificar que es system.remark
   ↓
3. Extraer contenido: extrinsic.method.args[0] (string)
   ↓
4. parseEmergencyFromRemark(remarkContent)
   - Verificar prefijo "EMERGENCY:"
   - Extraer JSON
   - Parsear JSON
   - Validar estructura
   - Retornar EmergencyRemarkData
   ↓
5. Filtrar por cuenta activa
   - Si reporterAccount === activeAccount → procesar
   ↓
6. processEmergency(emergencyData)
   - Crear Emergency local
   - Guardar en IndexedDB
   - Notificar usuario
```

## 📝 Ejemplo Completo de Remark

### Input (EmergencyRemarkData)

```typescript
{
  emergencyId: "550e8400-e29b-41d4-a716-446655440000",
  version: "1.0",
  type: "medical",
  severity: "high",
  description: "Lesión en la rodilla durante descenso",
  location: {
    latitude: -33.4489,
    longitude: -70.6693,
    altitude: 3500,
    accuracy: 10,
    timestamp: 1704067200000
  },
  relatedLogId: "log-123",
  relatedMilestoneId: "milestone-456",
  reporterAccount: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  createdAt: 1704067200000,
  reportedAt: 1704067200000,
  metadata: {
    logTitle: "Ascenso al Cerro El Plomo",
    mountainName: "Cerro El Plomo",
    logLocation: "Cordillera de los Andes",
    logStartDate: 1704000000000,
    avisoSalida: {
      guiaNombre: "Juan Pérez",
      lugarDestino: "Cerro El Plomo",
      numeroParticipantes: 4,
      fechaSalida: 1704000000000,
      tipoActividad: "Montañismo"
    },
    milestone: {
      title: "Campamento Base",
      type: "camp",
      elevation: 3500
    }
  }
}
```

### Output (Remark String)

```
EMERGENCY:{"prefix":"EMERGENCY","version":"1.0","data":{"emergencyId":"550e8400-e29b-41d4-a716-446655440000","version":"1.0","type":"medical","severity":"high","description":"Lesión en la rodilla durante descenso","location":{"latitude":-33.4489,"longitude":-70.6693,"altitude":3500,"accuracy":10,"timestamp":1704067200000},"relatedLogId":"log-123","relatedMilestoneId":"milestone-456","reporterAccount":"5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY","createdAt":1704067200000,"reportedAt":1704067200000,"metadata":{"logTitle":"Ascenso al Cerro El Plomo","mountainName":"Cerro El Plomo","logLocation":"Cordillera de los Andes","logStartDate":1704000000000,"avisoSalida":{"guiaNombre":"Juan Pérez","lugarDestino":"Cerro El Plomo","numeroParticipantes":4,"fechaSalida":1704000000000,"tipoActividad":"Montañismo"},"milestone":{"title":"Campamento Base","type":"camp","elevation":3500}}}}
```

### Decodificación (Parseo)

```typescript
// 1. Verificar prefijo
remark.startsWith("EMERGENCY:") // ✅ true

// 2. Extraer JSON
const jsonPart = remark.substring(9) // "{"prefix":"EMERGENCY",..."

// 3. Parsear JSON
const parsed = JSON.parse(jsonPart)
// {
//   prefix: "EMERGENCY",
//   version: "1.0",
//   data: { ... }
// }

// 4. Validar
parsed.prefix === "EMERGENCY" // ✅ true
parsed.data // ✅ existe

// 5. Retornar datos
return parsed.data // EmergencyRemarkData
```

## 🔧 Implementación del Listener

### Servicio de Listener (Recomendado)

```typescript
// src/services/blockchain/RemarkListener.ts

import { DedotClient } from 'dedot'
import { parseEmergencyFromRemark } from '@/types/emergencies'
import type { EmergencyRemarkData } from '@/types/emergencies'

export class RemarkListener {
  private client: DedotClient
  private activeAccount: string
  private unsubscribe: (() => void) | null = null
  private onEmergencyReceived?: (data: EmergencyRemarkData) => void

  constructor(
    client: DedotClient,
    activeAccount: string,
    onEmergencyReceived?: (data: EmergencyRemarkData) => void
  ) {
    this.client = client
    this.activeAccount = activeAccount
    this.onEmergencyReceived = onEmergencyReceived
  }

  async start() {
    if (this.unsubscribe) {
      console.warn('[RemarkListener] Ya está escuchando')
      return
    }

    try {
      // Suscribirse a eventos System.Remarked
      this.unsubscribe = await this.client.query.system.events(
        async (eventRecords: any[]) => {
          await this.handleEvents(eventRecords)
        }
      )
      
      console.log('[RemarkListener] ✅ Escucha iniciada')
    } catch (error) {
      console.error('[RemarkListener] ❌ Error al iniciar:', error)
      throw error
    }
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
      console.log('[RemarkListener] ✅ Escucha detenida')
    }
  }

  private async handleEvents(eventRecords: any[]) {
    // Filtrar eventos System.Remarked
    const remarkEvents = eventRecords.filter((record: any) => {
      const event = record?.event
      return event?.pallet === 'System' && event?.name === 'Remarked'
    })

    if (remarkEvents.length === 0) {
      return // No hay remarks
    }

    // Procesar cada remark
    for (const eventRecord of remarkEvents) {
      await this.processRemarkEvent(eventRecord)
    }
  }

  private async processRemarkEvent(eventRecord: any) {
    try {
      const event = eventRecord.event
      const [accountId, remarkHash] = event.data
      
      // Obtener bloque y extrinsic
      const blockHash = eventRecord.blockHash
      const extrinsicIndex = eventRecord.extrinsicIndex
      
      const block = await this.client.chain.getBlock(blockHash)
      const extrinsic = block.block.extrinsics[extrinsicIndex]
      
      // Verificar que es system.remark
      if (extrinsic?.method?.pallet !== 'System' || 
          extrinsic?.method?.method !== 'remark') {
        return // No es system.remark
      }
      
      // Extraer contenido del remark
      const remarkContent = extrinsic.method.args[0] as string
      
      // Parsear si es emergencia
      const emergencyData = parseEmergencyFromRemark(remarkContent)
      if (!emergencyData) {
        return // No es una emergencia
      }
      
      // Filtrar por cuenta activa
      if (emergencyData.reporterAccount !== this.activeAccount) {
        console.debug('[RemarkListener] Emergencia de otra cuenta ignorada:', 
          emergencyData.reporterAccount)
        return
      }
      
      // Procesar emergencia
      console.log('[RemarkListener] ✅ Emergencia recibida:', {
        emergencyId: emergencyData.emergencyId,
        type: emergencyData.type,
        severity: emergencyData.severity,
        reporterAccount: emergencyData.reporterAccount,
      })
      
      this.onEmergencyReceived?.(emergencyData)
    } catch (error) {
      console.error('[RemarkListener] Error al procesar remark:', error)
    }
  }
}
```

## 🎯 Resumen

### Formato del Remark

```
EMERGENCY:{"prefix":"EMERGENCY","version":"1.0","data":{...}}
```

### Constantes

```typescript
EMERGENCY_REMARK_PREFIX = 'EMERGENCY'
EMERGENCY_REMARK_VERSION = '1.0'
EMERGENCY_REMARK_SEPARATOR = ':'
```

### Funciones Clave

1. **Serialización**: `serializeEmergencyToRemark(data)` → string
2. **Parseo**: `parseEmergencyFromRemark(remark)` → EmergencyRemarkData | null
3. **Envío**: `client.tx.system.remark(remarkString)`
4. **Escucha**: `client.query.system.events()` → filtrar `System.Remarked`
5. **Extracción**: `extrinsic.method.args[0]` → contenido del remark

### Validaciones

1. ✅ Verificar prefijo `EMERGENCY:`
2. ✅ Parsear JSON válido
3. ✅ Validar estructura (prefix, version, data)
4. ✅ Filtrar por cuenta activa
5. ✅ Manejar errores de parseo

### Límites

- **Tamaño máximo**: ~30KB (dejar margen de seguridad)
- **Reducción automática**: Si excede, reduce metadata progresivamente
- **Prioridad de datos**: Ubicación > Descripción > Metadata

## 🔍 Detalles Técnicos: Extracción del Contenido

### ¿Por qué necesitamos obtener el bloque?

Los eventos `System.Remarked` solo contienen:
- `AccountId` - La cuenta que hizo el remark
- `H256` - El hash del remark (NO el contenido)

**El contenido del remark NO está en el evento**, está en la extrinsic del bloque.

### Cómo extraer el contenido

```typescript
// 1. Del evento System.Remarked obtenemos:
const [accountId, remarkHash] = event.data
const blockHash = eventRecord.blockHash
const extrinsicIndex = eventRecord.extrinsicIndex

// 2. Obtener el bloque completo
const block = await client.chain.getBlock(blockHash)

// 3. Obtener la extrinsic específica
const extrinsic = block.block.extrinsics[extrinsicIndex]

// 4. Verificar que es system.remark
if (extrinsic?.method?.pallet === 'System' && 
    extrinsic?.method?.method === 'remark') {
  
  // 5. Extraer el contenido (primer argumento)
  const remarkContent = extrinsic.method.args[0] as string
  
  // remarkContent ahora contiene: "EMERGENCY:{"prefix":"EMERGENCY",..."
}
```

### Tipos de Datos en Dedot

```typescript
// El contenido del remark puede venir en diferentes formatos según la cadena
// En Dedot, generalmente es un string, pero puede ser:
// - string (texto plano)
// - Uint8Array (bytes)
// - Hex string (0x...)

// Convertir a string si es necesario
let remarkContent: string

if (typeof extrinsic.method.args[0] === 'string') {
  remarkContent = extrinsic.method.args[0]
} else if (extrinsic.method.args[0] instanceof Uint8Array) {
  // Convertir bytes a string
  remarkContent = new TextDecoder().decode(extrinsic.method.args[0])
} else if (typeof extrinsic.method.args[0] === 'object' && 'toHex' in extrinsic.method.args[0]) {
  // Si es un objeto con método toHex, puede ser un tipo especial de Dedot
  const hex = extrinsic.method.args[0].toHex()
  // Convertir hex a string (remover 0x y convertir)
  remarkContent = Buffer.from(hex.slice(2), 'hex').toString('utf-8')
} else {
  // Fallback: convertir a string
  remarkContent = String(extrinsic.method.args[0])
}
```

### Manejo de Errores

```typescript
try {
  const block = await client.chain.getBlock(blockHash)
  const extrinsic = block.block.extrinsics[extrinsicIndex]
  
  if (!extrinsic) {
    console.warn('[RemarkListener] Extrinsic no encontrada en índice:', extrinsicIndex)
    return
  }
  
  if (extrinsic.method?.pallet !== 'System' || 
      extrinsic.method?.method !== 'remark') {
    console.debug('[RemarkListener] No es system.remark, ignorando')
    return
  }
  
  const remarkContent = extrinsic.method.args[0] as string
  
  if (!remarkContent || typeof remarkContent !== 'string') {
    console.warn('[RemarkListener] Contenido del remark inválido:', typeof remarkContent)
    return
  }
  
  // Continuar con parseo...
} catch (error) {
  console.error('[RemarkListener] Error al obtener bloque:', error)
  // No lanzar error, solo loggear y continuar con el siguiente
}
```

## 🧪 Testing del Parseo

### Test Unitario

```typescript
import { serializeEmergencyToRemark, parseEmergencyFromRemark } from '@/types/emergencies'

describe('Emergency Remark Parsing', () => {
  it('debería serializar y parsear correctamente', () => {
    const data: EmergencyRemarkData = {
      emergencyId: 'test-123',
      version: '1.0',
      type: 'medical',
      severity: 'high',
      description: 'Test emergency',
      location: {
        latitude: -33.4489,
        longitude: -70.6693,
        timestamp: Date.now()
      },
      reporterAccount: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      createdAt: Date.now(),
      reportedAt: Date.now()
    }
    
    // Serializar
    const remark = serializeEmergencyToRemark(data)
    expect(remark).toContain('EMERGENCY:')
    expect(remark).toContain('"prefix":"EMERGENCY"')
    
    // Parsear
    const parsed = parseEmergencyFromRemark(remark)
    expect(parsed).not.toBeNull()
    expect(parsed?.emergencyId).toBe(data.emergencyId)
    expect(parsed?.type).toBe(data.type)
  })
  
  it('debería rechazar remarks sin prefijo', () => {
    const invalid = 'NOT_EMERGENCY:{"data":{}}'
    const parsed = parseEmergencyFromRemark(invalid)
    expect(parsed).toBeNull()
  })
  
  it('debería rechazar JSON inválido', () => {
    const invalid = 'EMERGENCY:{invalid json}'
    const parsed = parseEmergencyFromRemark(invalid)
    expect(parsed).toBeNull()
  })
})
```
