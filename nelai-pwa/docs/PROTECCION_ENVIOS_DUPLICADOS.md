# Protección contra Envíos Duplicados de Emergencias

## 🛡️ Mecanismos de Protección Implementados

### 1. Verificación en `submitEmergencyToBlockchain`

**Ubicación**: `src/services/emergencies/EmergencyService.ts`

**Protección**:
- ✅ Verifica si la emergencia ya tiene `blockchainTxHash`
- ✅ Verifica si la emergencia ya está en estado `submitted`
- ✅ Si ya fue enviada, retorna el resultado existente sin enviar de nuevo

```typescript
// PROTECCIÓN: Verificar que la emergencia no haya sido enviada ya
if (emergency.blockchainTxHash) {
  console.warn('[EmergencyService] ⚠️ Emergencia ya enviada anteriormente')
  return {
    success: true,
    txHash: emergency.blockchainTxHash,
    blockNumber: emergency.blockchainBlockNumber,
    extrinsicIndex: emergency.blockchainExtrinsicIndex,
  }
}

// PROTECCIÓN: Verificar que no esté en estado submitted
if (emergency.status === 'submitted' && emergency.submittedAt) {
  console.warn('[EmergencyService] ⚠️ Emergencia ya está en estado submitted')
  return { /* resultado existente */ }
}
```

### 2. Verificación en `useEmergency` (Hook)

**Ubicación**: `src/hooks/useEmergency.ts`

**Protección**:
- ✅ Verifica si ya existe una emergencia activa enviada para la misma bitácora
- ✅ Solo considera emergencias que ya tienen `blockchainTxHash` (ya enviadas)
- ✅ Previene crear múltiples emergencias activas para la misma bitácora

```typescript
// PROTECCIÓN: Verificar si ya existe una emergencia activa para esta bitácora
if (data.relatedLogId) {
  const existingEmergencies = await getEmergenciesByLogIdStorage(data.relatedLogId)
  const activeEmergency = existingEmergencies.find(e => 
    (e.status === 'pending' || e.status === 'submitted' || ...) &&
    e.blockchainTxHash // Solo considerar si ya fue enviada
  )
  
  if (activeEmergency && activeEmergency.blockchainTxHash) {
    // Ya existe, no crear nueva
    return activeEmergency
  }
}
```

### 3. Verificación en Listener (Recepción)

**Ubicación**: `src/hooks/useRemarkListener.ts` o `src/services/blockchain/RemarkListener.ts`

**Protección** (a implementar):
- ✅ Verificar si ya existe una emergencia con el mismo `emergencyId`
- ✅ Verificar si ya existe una emergencia con el mismo `blockchainTxHash`
- ✅ Evitar procesar el mismo evento dos veces

## 📊 Flujo de Protección

### Envío (Tu Wallet)

```
Usuario crea emergencia
  ↓
1. Verificar si ya existe emergencia activa enviada para esta bitácora
  ↓ (Si existe → Retornar existente)
2. Crear emergencia local (status: 'pending')
  ↓
3. Guardar en IndexedDB
  ↓
4. submitEmergencyToBlockchain()
  ↓
5. Verificar si emergency.blockchainTxHash existe
  ↓ (Si existe → Retornar sin enviar)
6. Verificar si emergency.status === 'submitted'
  ↓ (Si es submitted → Retornar sin enviar)
7. Enviar a blockchain
  ↓
8. Actualizar con txHash y status: 'submitted'
  ↓
9. Guardar actualización en IndexedDB
```

### Recepción (Listener)

```
Evento System.Remarked recibido
  ↓
1. Extraer contenido del remark
  ↓
2. Parsear emergencyId del remark
  ↓
3. Verificar si ya existe emergencia con ese emergencyId
  ↓ (Si existe → No procesar)
4. Verificar si ya existe emergencia con ese txHash
  ↓ (Si existe → No procesar)
5. Crear/guardar emergencia
```

## 🔍 Verificaciones Actuales

### ✅ Implementadas

1. **En `submitEmergencyToBlockchain`**:
   - ✅ Verifica `blockchainTxHash`
   - ✅ Verifica `status === 'submitted'`

2. **En `useEmergency`**:
   - ✅ Verifica emergencias activas existentes para la misma bitácora

### ⚠️ Pendientes de Implementar (Cuando se agregue el Listener)

1. **En Listener** (cuando se implemente):
   - ⚠️ Verificar duplicados por `emergencyId` antes de procesar
   - ⚠️ Verificar duplicados por `blockchainTxHash` antes de procesar
   - ⚠️ Verificar duplicados por `blockNumber + extrinsicIndex` antes de procesar

## 🎯 Garantías

### Garantía 1: Una emergencia = Una transacción

- Cada emergencia tiene un `emergencyId` único (UUID)
- Si una emergencia ya tiene `blockchainTxHash`, no se envía de nuevo
- El `emergencyId` se incluye en el remark, permitiendo deduplicación

### Garantía 2: Un evento = Una emergencia procesada

- El listener debe verificar si ya existe una emergencia con el mismo `emergencyId`
- El listener debe verificar si ya existe una emergencia con el mismo `txHash`
- Esto previene procesar el mismo evento múltiples veces

### Garantía 3: Una bitácora = Una emergencia activa a la vez

- Antes de crear una nueva emergencia, se verifica si ya existe una activa
- Solo se considera "activa" si ya tiene `blockchainTxHash` (ya fue enviada)
- Esto previene múltiples emergencias simultáneas para la misma bitácora

## 📝 Recomendaciones Adicionales

### 1. Verificación por `emergencyId` en Listener

```typescript
// En processEmergency del listener
const existing = await getEmergency(remarkData.emergencyId)
if (existing && existing.blockchainTxHash) {
  console.log('[RemarkListener] ⚠️ Emergencia ya procesada:', remarkData.emergencyId)
  return // No procesar duplicado
}
```

### 2. Verificación por `txHash` en Listener

```typescript
// Verificar si ya existe una emergencia con este txHash
const emergencies = await getAllEmergencies()
const duplicate = emergencies.find(e => e.blockchainTxHash === blockHash)
if (duplicate) {
  console.log('[RemarkListener] ⚠️ Transacción ya procesada:', blockHash)
  return // No procesar duplicado
}
```

### 3. Índice en IndexedDB

Agregar índices para búsquedas rápidas:
- `byBlockchainTxHash` - Para verificar duplicados por txHash
- `byEmergencyId` - Ya existe (clave primaria)
- `byRelatedLogId` - Ya existe

## ✅ Confirmación

**Sí, las emergencias solo se envían una vez por evento** gracias a:

1. ✅ Verificación de `blockchainTxHash` antes de enviar
2. ✅ Verificación de estado `submitted` antes de enviar
3. ✅ Verificación de emergencias activas antes de crear nueva
4. ⚠️ Verificación de duplicados en listener (pendiente de implementar completamente)

El sistema está protegido contra envíos duplicados en el lado del envío. Falta completar la protección en el lado del listener para evitar procesar el mismo evento múltiples veces.
