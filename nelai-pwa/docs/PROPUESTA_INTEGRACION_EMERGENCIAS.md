# Propuesta de Integración: Sistema de Emergencias de Lumo

## 📋 Resumen Ejecutivo

Esta propuesta detalla cómo integrar el sistema de emergencias desarrollado en el repositorio [Lumo (rama `emergency`)](https://github.com/cryptohumano/lumo/tree/emergency) en **AndinoWalletPWA**, aprovechando la infraestructura existente de Polkadot, GPS tracking, mapas offline y bitácoras de montañismo.

## 🎯 Objetivos

1. **Botón de Emergencia**: Permitir a los usuarios activar una emergencia desde la bitácora de montañismo
2. **Registro On-Chain**: Registrar emergencias en Polkadot blockchain para inmutabilidad y trazabilidad
3. **Listener de Eventos**: Escuchar y reaccionar a eventos de emergencia desde la blockchain
4. **Modo Offline**: Guardar emergencias localmente cuando no hay conexión y sincronizar después
5. **Integración con Bitácora**: Vincular emergencias con bitácoras activas para contexto completo

## 🏗️ Arquitectura Propuesta

### Componentes a Desarrollar

#### 1. **Tipos TypeScript** (`src/types/emergencies.ts`)
```typescript
export type EmergencyType = 
  | 'medical'           // Emergencia médica
  | 'rescue'            // Rescate
  | 'weather'           // Condiciones climáticas extremas
  | 'equipment'         // Fallo de equipo crítico
  | 'lost'              // Extraviado
  | 'other'             // Otra

export type EmergencyStatus = 
  | 'pending'           // Pendiente de envío (offline)
  | 'submitted'         // Enviada a blockchain
  | 'acknowledged'     // Acknowledged por servicios de emergencia
  | 'in_progress'       // En proceso de atención
  | 'resolved'          // Resuelta
  | 'cancelled'         // Cancelada

export interface Emergency {
  emergencyId: string              // UUID local
  blockchainTxHash?: string         // Hash de transacción blockchain
  blockchainBlockNumber?: number    // Número de bloque donde se registró
  
  // Tipo y descripción
  type: EmergencyType
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  
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
  relatedMilestoneId?: string      // ID del milestone donde ocurrió
  
  // Contactos
  reporterAccount: string           // Cuenta Substrate que reporta
  emergencyContacts?: string[]      // Contactos de emergencia del Aviso de Salida
  
  // Estado
  status: EmergencyStatus
  createdAt: number
  updatedAt: number
  submittedAt?: number              // Cuando se envió a blockchain
  resolvedAt?: number
  
  // Metadata adicional
  images?: string[]                 // IDs de imágenes relacionadas
  notes?: string
  metadata?: Record<string, any>
  
  // Sincronización
  synced: boolean
  lastSyncAttempt?: number
  syncError?: string
}
```

#### 2. **Servicio de Emergencias** (`src/services/emergencies/EmergencyService.ts`)

**Funcionalidades principales:**
- `createEmergency()`: Crear emergencia localmente
- `submitEmergencyToBlockchain()`: Enviar emergencia a Polkadot usando `remark` o pallet personalizado
- `getEmergencyStatus()`: Consultar estado de emergencia desde blockchain
- `listenToEmergencyEvents()`: Suscribirse a eventos de emergencia
- `updateEmergencyStatus()`: Actualizar estado local y on-chain

**Integración con Dedot:**
```typescript
// Usar el cliente Dedot existente para:
// 1. Enviar transacciones con remark o pallet de emergencias
// 2. Suscribirse a eventos del pallet de emergencias
// 3. Consultar estado de emergencias registradas
```

#### 3. **Almacenamiento Local** (`src/utils/emergencyStorage.ts`)

**IndexedDB Store:**
- Store: `emergencies`
- Índices:
  - `byStatus` (status)
  - `byType` (type)
  - `byCreatedAt` (createdAt)
  - `byRelatedLogId` (relatedLogId)
  - `byBlockchainTxHash` (blockchainTxHash)

**Funciones:**
- `saveEmergency()`: Guardar emergencia localmente
- `getEmergency()`: Obtener emergencia por ID
- `getEmergenciesByLogId()`: Obtener emergencias de una bitácora
- `getPendingEmergencies()`: Obtener emergencias pendientes de sincronización
- `updateEmergency()`: Actualizar emergencia

#### 4. **Hook de Emergencias** (`src/hooks/useEmergency.ts`)

**Funcionalidades:**
- Estado de emergencias activas
- Crear nueva emergencia
- Enviar a blockchain
- Escuchar eventos
- Sincronización offline/online

```typescript
export function useEmergency() {
  const { client } = useDedotClient()
  const { accounts, getAccount } = useKeyringContext()
  
  return {
    emergencies: Emergency[],
    activeEmergency: Emergency | null,
    createEmergency: (data: CreateEmergencyData) => Promise<Emergency>,
    submitEmergency: (emergencyId: string) => Promise<string>, // Retorna txHash
    cancelEmergency: (emergencyId: string) => Promise<void>,
    listenToEvents: () => Promise<() => void>, // Retorna unsubscribe
  }
}
```

#### 5. **Componente UI: Botón de Emergencia** (`src/components/emergencies/EmergencyButton.tsx`)

**Características:**
- Botón prominente y accesible en la bitácora
- Confirmación antes de activar (evitar falsas alarmas)
- Captura automática de GPS actual
- Formulario rápido para tipo y descripción
- Indicador visual de emergencia activa

#### 6. **Componente UI: Panel de Emergencia** (`src/components/emergencies/EmergencyPanel.tsx`)

**Muestra:**
- Estado actual de la emergencia
- Ubicación en mapa (offline si es necesario)
- Información de contacto
- Historial de actualizaciones
- Opción para cancelar si fue falsa alarma

#### 7. **Listener de Eventos Blockchain** (`src/services/emergencies/EmergencyEventListener.ts`)

**Funcionalidades:**
- Suscribirse a eventos del pallet de emergencias
- Actualizar estado local cuando hay cambios on-chain
- Notificar al usuario de actualizaciones
- Manejar reconexión automática

## 🔗 Integración con Componentes Existentes

### 1. **Integración con Bitácora** (`MountainLogDetail.tsx`)

```typescript
// Agregar botón de emergencia en la barra de acciones
<EmergencyButton 
  logId={log.logId}
  currentLocation={currentLocation}
  emergencyContacts={log.avisoSalida?.contactosEmergencia}
/>

// Mostrar panel de emergencia activa si existe
{activeEmergency && (
  <EmergencyPanel emergency={activeEmergency} />
)}
```

### 2. **Integración con GPS Tracking**

- Usar `currentLocation` del hook `useGPSTracking` existente
- Capturar ubicación al momento de activar emergencia
- Continuar tracking durante emergencia activa

### 3. **Integración con Mapas Offline**

- Mostrar ubicación de emergencia en mapa offline
- Mostrar ruta desde último milestone conocido
- Incluir mapa en reporte de emergencia

### 4. **Integración con Polkadot**

- Usar `useDedotClient` existente
- Extender para soportar pallet de emergencias o `remark`
- Reutilizar sistema de suscripción a eventos

## 📡 Comunicación con Blockchain

### Opción 1: Usar `remark` (Más simple, no requiere pallet)

```typescript
// Enviar emergencia como remark
const remark = `EMERGENCY:${JSON.stringify(emergencyData)}`
const tx = await client.tx.system.remark(remark)
await tx.signAndSend(account)
```

**Ventajas:**
- No requiere desarrollo de pallet
- Funciona en cualquier parachain
- Implementación rápida

**Desventajas:**
- Datos en texto plano (aunque pueden encriptarse)
- No hay validación on-chain
- Búsqueda menos eficiente

### Opción 2: Pallet Personalizado (Recomendado a largo plazo)

**Requisitos:**
- Desarrollar pallet en Substrate para emergencias
- Desplegar en parachain (Paseo, Polkadot, etc.)
- Definir eventos y storage

**Ventajas:**
- Validación on-chain
- Búsqueda eficiente
- Eventos estructurados
- Mejor integración con servicios de emergencia

**Estructura propuesta del pallet:**
```rust
#[pallet::storage]
pub type Emergencies<T: Config> = StorageMap<
    _,
    Blake2_128Concat,
    EmergencyId,
    Emergency<T>,
    OptionQuery
>;

#[pallet::event]
pub enum Event<T: Config> {
    EmergencyCreated { emergency_id: EmergencyId, reporter: T::AccountId },
    EmergencyAcknowledged { emergency_id: EmergencyId },
    EmergencyResolved { emergency_id: EmergencyId },
}
```

## 🔄 Flujo de Usuario

### 1. **Activación de Emergencia**

```
Usuario presiona "Botón de Emergencia"
  ↓
Confirmación (evitar falsas alarmas)
  ↓
Captura automática de GPS
  ↓
Formulario rápido (tipo, descripción, severidad)
  ↓
Crear emergencia localmente
  ↓
Intentar enviar a blockchain inmediatamente
  ↓
Si offline: Guardar para sincronización posterior
```

### 2. **Sincronización Offline**

```
Detectar conexión restaurada
  ↓
Obtener emergencias pendientes
  ↓
Enviar cada una a blockchain
  ↓
Actualizar estado local con txHash
  ↓
Notificar al usuario
```

### 3. **Escucha de Eventos**

```
Conectar a blockchain
  ↓
Suscribirse a eventos de emergencias
  ↓
Cuando hay evento:
  - Actualizar estado local
  - Notificar al usuario
  - Actualizar UI
```

## 🛠️ Plan de Implementación

### Fase 1: Infraestructura Base (1-2 semanas)
- [ ] Crear tipos TypeScript
- [ ] Implementar `emergencyStorage.ts` (IndexedDB)
- [ ] Crear estructura de servicios base
- [ ] Integrar con `useDedotClient` existente

### Fase 2: UI y UX (1 semana)
- [ ] Crear `EmergencyButton` component
- [ ] Crear `EmergencyPanel` component
- [ ] Integrar en `MountainLogDetail`
- [ ] Diseñar flujo de confirmación

### Fase 3: Integración Blockchain (2 semanas)
- [ ] Implementar envío con `remark` (Opción 1)
- [ ] Implementar listener de eventos
- [ ] Manejar sincronización offline/online
- [ ] Testing con Paseo testnet

### Fase 4: Funcionalidades Avanzadas (1-2 semanas)
- [ ] Notificaciones push (si aplica)
- [ ] Exportar reporte de emergencia a PDF
- [ ] Historial de emergencias
- [ ] Integración con servicios externos (opcional)

### Fase 5: Pallet Personalizado (Opcional, 3-4 semanas)
- [ ] Diseñar pallet en Substrate
- [ ] Implementar storage y eventos
- [ ] Testing y auditoría
- [ ] Despliegue en parachain
- [ ] Migrar de `remark` a pallet

## 🔐 Consideraciones de Seguridad

1. **Validación de Emergencias**
   - Rate limiting para evitar spam
   - Verificación de cuenta (requiere balance mínimo)
   - Validación de GPS (evitar coordenadas falsas)

2. **Privacidad**
   - Datos sensibles pueden encriptarse antes de enviar
   - Solo exponer información necesaria on-chain
   - Contactos de emergencia no deben estar on-chain

3. **Falsas Alarmas**
   - Confirmación obligatoria antes de enviar
   - Opción de cancelar rápidamente
   - Penalización por abuso (futuro)

## 📊 Métricas y Monitoreo

- Tiempo de respuesta (creación → blockchain)
- Tasa de éxito de sincronización offline
- Número de emergencias por tipo
- Tiempo promedio de resolución

## 🚀 Próximos Pasos

1. **Revisar documentación de Lumo**: Analizar `ARQUITECTURA_EMERGENCIAS_POLKADOT.md` y otros docs
2. **Decidir estrategia blockchain**: `remark` vs pallet personalizado
3. **Definir parachain objetivo**: Paseo (testnet) o Polkadot/Kusama (mainnet)
4. **Crear mockups UI**: Diseñar flujo de usuario
5. **Iniciar Fase 1**: Implementar infraestructura base

## 📚 Referencias

- [Repositorio Lumo - Rama Emergency](https://github.com/cryptohumano/lumo/tree/emergency)
- [Dedot Documentation](https://docs.dedot.dev/)
- [Substrate Pallet Development](https://docs.substrate.io/tutorials/)
- [Polkadot Remark Extrinsic](https://polkadot.js.org/docs/substrate/extrinsics/#remark)

---

**Nota**: Esta propuesta es un punto de partida. Debe ajustarse según:
- Análisis detallado de la documentación de Lumo
- Requisitos específicos del sistema de emergencias
- Capacidades de la parachain objetivo
- Recursos disponibles para desarrollo
