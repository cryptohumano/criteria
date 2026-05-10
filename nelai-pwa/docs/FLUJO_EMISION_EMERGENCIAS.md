# Flujo de Emisión de Emergencias

## 📋 Resumen

Este documento explica paso a paso cómo funciona el sistema de emisión de emergencias en Andino Wallet, desde que el usuario presiona el botón hasta que la emergencia se registra en la blockchain.

## 🔄 Flujo Completo

### 1. **Inicio: Usuario Presiona Botón de Emergencia**

**Ubicación**: `src/components/emergencies/EmergencyButton.tsx`

```
Usuario presiona "Botón de Emergencia" en la bitácora
  ↓
Se abre diálogo de confirmación
  ↓
Usuario selecciona:
  - Tipo de emergencia (accidente, lesión, pérdida, etc.)
  - Severidad (baja, media, alta, crítica)
  - Descripción (opcional pero recomendado)
  ↓
Usuario confirma
```

### 2. **Captura de Datos GPS**

**Función**: `handleCreateEmergency()` en `EmergencyButton.tsx`

```typescript
// Prioridad de ubicación:
1. Ubicación GPS actual (si está disponible)
   - Intenta obtener con addManualPoint()
   - Si falla, intenta con navigator.geolocation.getCurrentPosition()
   - Timeout: 10 segundos

2. Última ubicación conocida de la bitácora
   - log.startLocation (ubicación inicial)
   - O último milestone con GPS

3. Si no hay ubicación → Error (no se puede crear emergencia sin GPS)
```

**Protección**: No se puede crear una emergencia sin ubicación GPS.

### 3. **Preparación de Datos**

**Función**: `handleCreateEmergency()` continúa

```typescript
// Datos recopilados:
- Tipo y severidad (del formulario)
- Descripción (del formulario)
- Ubicación GPS (capturada)
- Contactos de emergencia (del Aviso de Salida)
- Milestone actual (último milestone de la bitácora)
- Datos de la bitácora (para incluir en el remark):
  * Título, montaña, ubicación, fecha inicio
  * Aviso de salida (guía, actividad)
  * Rutas y milestones
```

### 4. **Llamada al Hook useEmergency**

**Función**: `createAndSubmitEmergency()` en `useEmergency.ts`

```typescript
// Verificaciones iniciales:
1. ¿Cliente blockchain disponible? → Si no, error
2. ¿Wallet desbloqueada? → Si no, error
3. ¿Cuenta activa seleccionada? → Si no, error
```

### 5. **Protección contra Duplicados**

**Ubicación**: `useEmergency.ts` línea 122-142

```typescript
// PROTECCIÓN: Verificar si ya existe emergencia activa
if (data.relatedLogId) {
  const existingEmergencies = await getEmergenciesByLogIdStorage(data.relatedLogId)
  const activeEmergency = existingEmergencies.find(e => 
    (e.status === 'pending' || e.status === 'submitted' || ...) &&
    e.blockchainTxHash // Solo considerar si ya fue enviada
  )
  
  if (activeEmergency && activeEmergency.blockchainTxHash) {
    // ⚠️ Ya existe una emergencia activa
    // Retornar la existente (no crear nueva)
    return activeEmergency
  }
}
```

**Resultado**: Si ya existe una emergencia activa enviada para esta bitácora, se retorna la existente y se muestra un warning.

### 6. **Creación Local de Emergencia**

**Función**: `createEmergencyLocal()` en `EmergencyService.ts`

```typescript
// Crea objeto Emergency con:
- emergencyId: UUID único
- type, severity, description
- location (GPS)
- relatedLogId, relatedMilestoneId
- reporterAccount (cuenta activa)
- emergencyContacts
- status: 'pending'
- createdAt, updatedAt
- synced: false
```

**Guardado**: Se guarda inmediatamente en IndexedDB (`saveEmergency()`)

### 7. **Preparación para Blockchain**

**Función**: `submitEmergencyToBlockchain()` en `EmergencyService.ts`

#### 7.1. **Protecciones Adicionales**

```typescript
// Verificar que no haya sido enviada ya:
if (emergency.blockchainTxHash) {
  // Ya tiene txHash → Retornar sin enviar
  return { success: true, txHash: emergency.blockchainTxHash, ... }
}

if (emergency.status === 'submitted' && emergency.submittedAt) {
  // Ya está en estado submitted → Retornar sin enviar
  return { success: true, ... }
}
```

#### 7.2. **Preparar Datos del Remark**

**Función**: `prepareEmergencyRemarkData()`

```typescript
// Estructura del remark:
{
  prefix: "EMERGENCY:",
  version: "1.0",
  emergencyId: "...",
  type: "...",
  severity: "...",
  description: "...",
  location: {
    latitude, longitude, altitude, accuracy, timestamp
  },
  reporterAccount: "...",
  reportedAt: timestamp,
  relatedLogId: "...",
  relatedMilestoneId: "...",
  metadata: {
    logTitle: "...",
    mountainName: "...",
    location: "...",
    startDate: timestamp,
    avisoSalida: { ... },
    trail: { ... },
    milestone: { ... }
  }
}
```

#### 7.3. **Serialización a String**

**Función**: `serializeEmergencyToRemark()`

```typescript
// Convierte el objeto a JSON string:
const remarkString = JSON.stringify({
  prefix: "EMERGENCY:",
  version: "1.0",
  data: { ... }
})
```

#### 7.4. **Verificación de Tamaño**

```typescript
// Límite: 30KB (margen de seguridad para límite de 32KB)
if (remarkString.length > MAX_REMARK_SIZE) {
  // Reducir metadata progresivamente:
  1. Eliminar trail y milestone
  2. Reducir avisoSalida (solo datos esenciales)
  3. Eliminar avisoSalida completamente
  4. Si aún es muy largo → Error
}
```

### 8. **Envío a Blockchain**

**Función**: `submitEmergencyToBlockchain()` continúa

```typescript
// Crear transacción system.remarkWithEvent
const tx = client.tx.system.remarkWithEvent(remarkString)

// Firmar y enviar
const result = await tx.signAndSend(
  pair, // KeyringPair de la cuenta
  {}, // Opciones del signer
  async (result) => {
    // Callback para actualizaciones de estado
    txHash = result.txHash
    if (status.type === 'Finalized') {
      blockNumber = status.value.blockNumber
      extrinsicIndex = status.value.extrinsicIndex
    }
  }
).untilFinalized() // Esperar hasta que se finalice
```

**Resultado**:
- `txHash`: Hash de la transacción
- `blockNumber`: Número del bloque donde se incluyó
- `extrinsicIndex`: Índice del extrinsic en el bloque

### 9. **Actualización de Emergencia**

**Función**: `updateEmergencyWithBlockchainResult()`

```typescript
// Actualizar emergencia con datos de blockchain:
emergency.status = 'submitted'
emergency.submittedAt = Date.now()
emergency.blockchainTxHash = result.txHash
emergency.blockchainBlockNumber = result.blockNumber
emergency.blockchainExtrinsicIndex = result.extrinsicIndex
emergency.synced = true
```

**Guardado**: Se guarda la actualización en IndexedDB.

### 10. **Guardar como Transacción**

**Función**: `useEmergency.ts` línea 182-240

```typescript
// Crear StoredTransaction:
const storedTx: StoredTransaction = {
  id: result.txHash,
  accountAddress: selectedAccount.address,
  toAddress: '', // Las emergencias no tienen destinatario
  amount: '0', // No es transferencia de fondos
  chain: selectedChain.name,
  type: 'other', // Tipo especial para emergencias
  status: 'finalized',
  txHash: result.txHash,
  blockNumber: result.blockNumber,
  extrinsicIndex: result.extrinsicIndex,
  metadata: {
    emergencyId: emergency.emergencyId,
    emergencyType: emergency.type,
    emergencySeverity: emergency.severity,
    relatedLogId: emergency.relatedLogId,
  },
  createdAt: emergency.createdAt,
  finalizedAt: Date.now(),
}

// Guardar en transactionStorage
await saveTransaction(storedTx)

// Disparar evento para actualizar UI
window.dispatchEvent(new CustomEvent('transaction-saved', {
  detail: { transaction: storedTx }
}))
```

### 11. **Actualización de UI**

**Evento**: `transaction-saved`

```typescript
// En Transactions.tsx:
window.addEventListener('transaction-saved', () => {
  loadTransactions() // Recargar lista automáticamente
})
```

**Resultado**: La página de transacciones se actualiza automáticamente mostrando la nueva emergencia.

## 🛡️ Protecciones Implementadas

### 1. **Protección contra Duplicados por Bitácora**

- Verifica si ya existe una emergencia activa enviada para la misma bitácora
- Solo considera emergencias que ya tienen `blockchainTxHash` (ya enviadas)
- Si existe, retorna la existente sin crear nueva

### 2. **Protección contra Reenvíos**

- Verifica si la emergencia ya tiene `blockchainTxHash`
- Verifica si la emergencia ya está en estado `submitted`
- Si ya fue enviada, retorna el resultado existente sin enviar de nuevo

### 3. **Protección de Tamaño**

- Verifica que el remark no exceda 30KB
- Reduce metadata progresivamente si es necesario
- Lanza error si no se puede reducir lo suficiente

## 📊 Datos Incluidos en el Remark

### Datos Básicos (Siempre Incluidos)
- `emergencyId`: UUID único
- `type`: Tipo de emergencia
- `severity`: Severidad
- `description`: Descripción
- `location`: GPS completo (lat, lon, alt, accuracy, timestamp)
- `reporterAccount`: Cuenta que reporta
- `reportedAt`: Timestamp

### Datos de Bitácora (Si Disponibles)
- `relatedLogId`: ID de la bitácora
- `relatedMilestoneId`: ID del milestone actual
- `metadata.logTitle`: Título de la bitácora
- `metadata.mountainName`: Nombre de la montaña
- `metadata.location`: Ubicación de la bitácora
- `metadata.startDate`: Fecha de inicio
- `metadata.avisoSalida`: Datos del aviso de salida
- `metadata.trail`: Datos de rutas
- `metadata.milestone`: Datos del milestone

## 🔍 Logs y Debugging

### Logs Importantes

1. **EmergencyButton.tsx**:
   - `[EmergencyButton] Iniciando creación de emergencia...`
   - `[EmergencyButton] Error al obtener ubicación...`

2. **useEmergency.ts**:
   - `[useEmergency] ✅ Cliente disponible, procediendo con emergencia`
   - `[useEmergency] ⚠️ Ya existe una emergencia activa...`
   - `[useEmergency] Guardando transacción de emergencia...`

3. **EmergencyService.ts**:
   - `[EmergencyService] Enviando emergencia a blockchain:`
   - `[EmergencyService] ⚠️ Remark demasiado largo, reduciendo metadata...`
   - `[EmergencyService] ✅ Emergencia enviada exitosamente:`

4. **transactionStorage.ts**:
   - `[Transaction Storage] Guardando transacción:`
   - `[Transaction Storage] 📢 Evento transaction-saved disparado`

## ✅ Confirmación de Éxito

### Indicadores de Éxito

1. **Toast de éxito**: "Emergencia creada y enviada"
2. **Estado actualizado**: `emergency.status === 'submitted'`
3. **TxHash disponible**: `emergency.blockchainTxHash` tiene valor
4. **Transacción visible**: Aparece en la lista de transacciones
5. **Evento disparado**: `transaction-saved` se dispara

### Verificación

```typescript
// Verificar en consola:
console.log('[useEmergency] ✅ Verificación: Transacción encontrada en storage:', saved)
```

## ⚠️ Casos de Error

### 1. **Ya Existe Emergencia Activa**
- **Mensaje**: "Ya existe una emergencia activa para esta bitácora"
- **Acción**: Retorna la emergencia existente

### 2. **Sin Ubicación GPS**
- **Mensaje**: "No se pudo obtener la ubicación"
- **Acción**: No se crea la emergencia

### 3. **Sin Conexión a Blockchain**
- **Mensaje**: "Sin conexión a la blockchain"
- **Acción**: La emergencia se guarda localmente pero no se envía

### 4. **Remark Demasiado Largo**
- **Mensaje**: "El remark es demasiado largo"
- **Acción**: Se intenta reducir metadata, si falla se lanza error

### 5. **Wallet Bloqueada**
- **Mensaje**: "No se pudo obtener el par de claves"
- **Acción**: No se puede firmar la transacción

## 🎯 Resumen del Flujo

```
Usuario presiona botón
  ↓
Captura GPS
  ↓
Prepara datos
  ↓
Verifica duplicados (bitácora)
  ↓
Crea emergencia local (status: 'pending')
  ↓
Guarda en IndexedDB
  ↓
Verifica duplicados (txHash/status)
  ↓
Prepara remark (serializa datos)
  ↓
Verifica tamaño (reduce si necesario)
  ↓
Envía a blockchain (system.remarkWithEvent)
  ↓
Espera finalización
  ↓
Actualiza emergencia (status: 'submitted', txHash, etc.)
  ↓
Guarda actualización en IndexedDB
  ↓
Guarda como transacción
  ↓
Dispara evento 'transaction-saved'
  ↓
UI se actualiza automáticamente
  ↓
✅ Emergencia registrada en blockchain
```

## 📝 Notas Importantes

1. **Una emergencia = Una transacción**: Cada emergencia se envía una sola vez a la blockchain
2. **Protección contra duplicados**: Múltiples capas de protección evitan envíos duplicados
3. **Datos completos**: Se incluyen todos los datos disponibles de la bitácora en el remark
4. **Actualización automática**: La UI se actualiza automáticamente cuando se guarda una transacción
5. **Persistencia local**: La emergencia se guarda localmente incluso si falla el envío a blockchain
