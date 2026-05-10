# Plan: PWA Mínima de Emergencias

## 🎯 Objetivo

Crear una PWA (Progressive Web App) mínima enfocada exclusivamente en el sistema de emergencias. La aplicación debe:

1. **Función principal**: Escuchar eventos `System.Remarked` para la cuenta activa y procesar emergencias
2. **Reportes de emergencia**: Adaptar la lógica de bitácoras de montañismo a reportes de emergencias
3. **Funcionalidades básicas**: Redes, transacciones básicas, gestión de cuentas
4. **Offline-first**: Funciona offline y sincroniza cuando hay conexión
5. **100% Web3 inicialmente**: Sin dependencia de backend - blockchain como fuente de verdad
6. **Preparada para Lumo**: Estructura lista para conectar con backend de Lumo en el futuro

### 🏗️ Arquitectura: Web3 Puro con Preparación para Lumo

**Filosofía Actual (Web3 Puro)**:
- ✅ **Función principal**: Escuchar eventos `System.Remarked` para la cuenta activa
- ✅ **Blockchain como fuente de verdad**: Todas las emergencias se registran en blockchain
- ✅ **Sin backend requerido**: La PWA funciona completamente sin servidor central
- ✅ **IndexedDB como cache local**: Almacena emergencias localmente para acceso rápido
- ✅ **Escucha directa de blockchain**: Escucha eventos `System.Remarked` directamente desde la blockchain
- ✅ **Filtrado por cuenta activa**: Solo procesa emergencias donde `reporterAccount === activeAccount`

**Adaptación de Bitácoras a Reportes de Emergencia**:
- 🔄 **Bitácoras → Reportes**: La lógica de bitácoras de montañismo se adapta a reportes de emergencias
- 🔄 **Mantener estructura**: Se mantiene mucha lógica de Aura/Andino Wallet pero adaptada a servicios de emergencia
- 🔄 **Contexto de emergencia**: Los reportes incluyen contexto similar a bitácoras (ubicación, fecha, participantes, etc.)

**Futuro: Integración con Lumo Backend**:
- 🔄 **Conexión con Lumo**: La wallet se conectará con el backend de Lumo cuando esté disponible
- 🔄 **API compatible**: Estructura de API diseñada para ser compatible con schemas de Lumo
- 🔄 **Lógicas adicionales**: El backend aporta lógicas adicionales para la cuenta activa (reportes, estadísticas, etc.)
- 🔄 **Sincronización híbrida**: Cuando backend y blockchain corren, blockchain aporta información adicional sobre la cuenta
- 🔄 **Servicios externos**: Backend expone APIs para servicios de emergencia externos

**Ventajas de Web3 Puro**:
- ✅ Sin punto único de fallo
- ✅ Descentralizado y resistente a censura
- ✅ Funciona offline (con cache local)
- ✅ No requiere infraestructura de servidor
- ✅ Datos inmutables en blockchain

## 📋 Arquitectura Propuesta

### Estructura de Carpetas Mínima

```
emergency-wallet-pwa/
├── src/
│   ├── components/
│   │   ├── emergencies/          # Componentes de emergencias (REUTILIZAR)
│   │   │   ├── EmergencyButton.tsx
│   │   │   ├── EmergencyPanel.tsx
│   │   │   └── EmergencyList.tsx (NUEVO - lista principal)
│   │   ├── layout/
│   │   │   ├── Header.tsx        # Simplificado - solo emergencias
│   │   │   └── BottomNav.tsx     # Solo emergencias y cuenta
│   │   └── ui/                    # Componentes shadcn (REUTILIZAR)
│   ├── contexts/
│   │   ├── KeyringContext.tsx    # REUTILIZAR completo
│   │   ├── NetworkContext.tsx    # REUTILIZAR completo
│   │   └── ActiveAccountContext.tsx # REUTILIZAR completo
│   ├── hooks/
│   │   ├── useEmergency.ts        # REUTILIZAR completo
│   │   ├── useDedotClient.ts     # REUTILIZAR completo
│   │   └── useRemarkListener.ts  # NUEVO - escucha de remarks
│   ├── pages/
│   │   ├── Home.tsx              # NUEVO - Dashboard de emergencias
│   │   ├── Emergencies.tsx       # NUEVO - Lista de emergencias
│   │   ├── CreateEmergency.tsx   # NUEVO - Crear emergencia
│   │   ├── EmergencyDetail.tsx   # NUEVO - Detalle de emergencia
│   │   ├── Transactions.tsx     # Simplificado - solo emergencias
│   │   ├── Accounts.tsx          # Simplificado
│   │   └── Settings.tsx          # Mínimo
│   ├── services/
│   │   ├── emergencies/
│   │   │   └── EmergencyService.ts # REUTILIZAR completo
│   │   └── blockchain/
│   │       └── RemarkListener.ts    # NUEVO - servicio de escucha
│   ├── utils/
│   │   ├── indexedDB.ts          # REUTILIZAR (solo stores necesarios)
│   │   ├── emergencyStorage.ts   # REUTILIZAR completo
│   │   ├── transactionStorage.ts # REUTILIZAR (simplificado)
│   │   └── balance.ts            # REUTILIZAR
│   ├── types/
│   │   ├── emergencies.ts        # REUTILIZAR completo
│   │   └── dedot.ts              # REUTILIZAR
│   └── router.tsx                # NUEVO - rutas mínimas
├── public/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 🔧 Componentes a Reutilizar del Proyecto Actual

### 1. Contextos (100% Reutilizable)

**`src/contexts/KeyringContext.tsx`**
- ✅ Gestión completa de cuentas
- ✅ Encriptación y almacenamiento seguro
- ✅ WebAuthn support

**`src/contexts/NetworkContext.tsx`**
- ✅ Gestión de redes (Paseo, Polkadot, etc.)
- ✅ Conexión automática
- ✅ Cambio de red

**`src/contexts/ActiveAccountContext.tsx`**
- ✅ Cuenta activa en sesión
- ✅ Persistencia en localStorage

### 2. Hooks (100% Reutilizable)

**`src/hooks/useEmergency.ts`**
- ✅ Creación de emergencias
- ✅ Envío a blockchain
- ✅ Gestión de estado local

**`src/hooks/useDedotClient.ts`**
- ✅ Conexión a blockchain
- ✅ Gestión de cliente Dedot
- ✅ Reconexión automática

### 3. Servicios (100% Reutilizable)

**`src/services/emergencies/EmergencyService.ts`**
- ✅ `createEmergencyLocal()`
- ✅ `prepareEmergencyRemarkData()`
- ✅ `submitEmergencyToBlockchain()`
- ✅ Control de tamaño de remark (32KB)

### 4. Utilidades (Reutilizar con Adaptaciones)

**`src/utils/indexedDB.ts`**
- ✅ Reutilizar estructura base
- ⚠️ Mantener solo stores necesarios:
  - `encrypted-accounts` (cuentas)
  - `emergencies` (emergencias)
  - `transactions` (solo emergencias)

**`src/utils/emergencyStorage.ts`**
- ✅ Reutilizar 100%

**`src/utils/transactionStorage.ts`**
- ✅ Reutilizar estructura
- ⚠️ Simplificar: solo transacciones de emergencias

### 5. Componentes UI (100% Reutilizable)

**`src/components/ui/`** (todos los componentes shadcn)
- ✅ Card, Button, Badge, Dialog, etc.

**`src/components/emergencies/EmergencyButton.tsx`**
- ✅ Reutilizar con adaptaciones menores

**`src/components/emergencies/EmergencyPanel.tsx`**
- ✅ Reutilizar completo

## 🆕 Componentes Nuevos a Crear

### 1. Hook: `useRemarkListener.ts`

**Propósito**: Escuchar constantemente `system.remark` de transacciones y detectar emergencias.

```typescript
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

  const processEmergency = useCallback(async (remarkData: EmergencyRemarkData) => {
    try {
      // Crear Emergency desde los datos del remark
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

      // Actualizar con datos del blockchain
      emergency.status = 'submitted'
      emergency.submittedAt = remarkData.reportedAt
      emergency.synced = true

      // Guardar en IndexedDB
      await saveEmergency(emergency)
      setReceivedCount(prev => prev + 1)
      
      // Notificar al usuario (toast, notification, etc.)
      console.log('[RemarkListener] Emergencia recibida:', emergency.emergencyId)
    } catch (error) {
      console.error('[RemarkListener] Error al procesar emergencia:', error)
    }
  }, [])

  useEffect(() => {
    if (!client || !activeAccount) {
      setIsListening(false)
      return
    }

    let unsubscribe: (() => void) | null = null

  const startListening = async () => {
    try {
      // ESTRATEGIA EFICIENTE: Escuchar solo eventos System.Remarked
      // Esto es mucho más eficiente que escanear todos los bloques
      unsubscribe = await client.query.system.events(async (eventRecords: any[]) => {
        try {
          // Filtrar solo eventos System.Remarked (filtrado rápido en memoria)
          const remarkEvents = eventRecords.filter((record: any) => {
            const event = record?.event
            return event?.pallet === 'System' && event?.name === 'Remarked'
          })
          
          // Solo procesar si hay remarks (la mayoría de bloques no tienen)
          if (remarkEvents.length === 0) {
            return // No hacer nada, muy eficiente
          }
          
          // Para cada remark, obtener el contenido del bloque
          for (const eventRecord of remarkEvents) {
            const event = eventRecord.event
            const [accountId, remarkHash] = event.data
            
            // Obtener el bloque completo (solo cuando hay remark)
            const blockHash = eventRecord.blockHash
            const extrinsicIndex = eventRecord.extrinsicIndex
            
            try {
              const block = await client.chain.getBlock(blockHash)
              const extrinsic = block.block.extrinsics[extrinsicIndex]
              
              // Verificar que es system.remark
              if (extrinsic?.method?.pallet === 'System' && 
                  extrinsic?.method?.method === 'remark') {
                
                // Extraer contenido del remark
                const remarkContent = extrinsic.method.args[0] as string
                
                // Parsear si es emergencia
                const emergencyData = parseEmergencyFromRemark(remarkContent)
                if (emergencyData) {
                  // FILTRADO POR CUENTA ACTIVA: Solo procesar emergencias de la cuenta activa
                  if (emergencyData.reporterAccount === activeAccount) {
                    // Procesar emergencia
                    await processEmergency(emergencyData)
                  } else {
                    // Opcional: Log para debugging (emergencias de otras cuentas)
                    console.debug('[RemarkListener] Emergencia de otra cuenta ignorada:', emergencyData.reporterAccount)
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
  }, [client, activeAccount, processEmergency])

  return { isListening, receivedCount }
}
```

**Estrategia de Escucha**:

1. **Opción A: Escuchar eventos System.Remarked** (✅ RECOMENDADA - Más Eficiente)
   - Suscribirse a `query.system.events` (solo eventos, no bloques completos)
   - Filtrar eventos `System.Remarked` (filtrado en cliente, muy rápido)
   - Para cada evento relevante, obtener el bloque y la extrinsic (solo cuando hay remark)
   - Extraer contenido del remark desde la extrinsic
   - Parsear y procesar emergencia
   
   **Ventajas**:
   - ✅ Solo procesa cuando hay remarks (no todos los bloques)
   - ✅ Menor ancho de banda (solo eventos, no bloques completos)
   - ✅ Menor CPU (no procesa todas las extrinsics)
   - ✅ Más reactivo (detecta inmediatamente)

2. **Opción B: Escanear bloques recientes** (❌ NO Recomendada)
   - Cada X segundos, escanear últimos N bloques
   - Obtener bloques completos (costoso en ancho de banda)
   - Procesar TODAS las extrinsics de cada bloque (costoso en CPU)
   - Filtrar `system.remark` después
   
   **Desventajas**:
   - ❌ Procesa bloques sin remarks (desperdicio)
   - ❌ Mayor ancho de banda (bloques completos)
   - ❌ Mayor CPU (todas las extrinsics)
   - ❌ Menos eficiente en general

3. **Opción C: Escuchar transacciones de nuestra cuenta** (⚠️ Limitada)
   - En Substrate no hay suscripción directa a "transacciones de mi cuenta"
   - Requiere escuchar todos los eventos y filtrar
   - Similar a Opción A pero con filtro adicional

**Recomendación**: **Opción A** - Escuchar eventos `System.Remarked` es la más eficiente porque:
- Solo procesa cuando realmente hay un remark
- El filtrado de eventos es muy rápido (en memoria)
- Solo hace queries adicionales (obtener bloque) cuando hay un remark relevante
- Menor consumo de recursos (ancho de banda y CPU)

### 2. Servicio: `RemarkListener.ts`

```typescript
export class RemarkListener {
  private client: DedotClient | null = null
  private activeAccount: string | null = null
  private unsubscribe: (() => void) | null = null
  private onEmergencyReceived?: (emergency: Emergency) => void

  async start(client: DedotClient, accountAddress: string) {
    this.client = client
    this.activeAccount = accountAddress
    
    // Suscribirse a eventos
    this.unsubscribe = await client.query.system.events(
      this.handleEvents.bind(this)
    )
  }

  private async handleEvents(events: any[]) {
    for (const event of events) {
      if (this.isRemarkEvent(event)) {
        const remarkData = await this.extractRemarkData(event)
        if (remarkData && this.isEmergencyRemark(remarkData)) {
          const emergency = await this.parseEmergencyRemark(remarkData)
          if (emergency) {
            this.onEmergencyReceived?.(emergency)
          }
        }
      }
    }
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }
}
```

### 3. Página: `Home.tsx` (Dashboard de Emergencias)

```typescript
export default function Home() {
  const { activeAccount } = useActiveAccount()
  const { emergencies, getActiveEmergencies } = useEmergency()
  const { isListening } = useRemarkListener()
  const { balance } = useCurrentChainBalance(activeAccount)

  const activeEmergencies = getActiveEmergencies()

  return (
    <div className="space-y-6">
      {/* Estado de escucha */}
      <Card>
        <CardHeader>
          <CardTitle>Estado del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {isListening ? (
              <>
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                <span>Escuchando emergencias...</span>
              </>
            ) : (
              <>
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>No conectado</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emergencias Activas */}
      <Card>
        <CardHeader>
          <CardTitle>Emergencias Activas</CardTitle>
          <CardDescription>
            {activeEmergencies.length} emergencia(s) activa(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeEmergencies.length === 0 ? (
            <p className="text-muted-foreground">No hay emergencias activas</p>
          ) : (
            <EmergencyList emergencies={activeEmergencies} />
          )}
        </CardContent>
      </Card>

      {/* Botón de Emergencia */}
      <Button 
        size="lg" 
        variant="destructive" 
        className="w-full"
        asChild
      >
        <Link to="/emergencies/create">
          <AlertTriangle className="mr-2 h-5 w-5" />
          Crear Emergencia
        </Link>
      </Button>
    </div>
  )
}
```

### 4. Página: `Emergencies.tsx` (Lista Completa)

```typescript
export default function Emergencies() {
  const { emergencies, getAllEmergencies } = useEmergency()
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all')

  const filtered = useMemo(() => {
    if (filter === 'active') {
      return emergencies.filter(e => 
        e.status === 'pending' || 
        e.status === 'submitted' || 
        e.status === 'acknowledged'
      )
    }
    if (filter === 'resolved') {
      return emergencies.filter(e => 
        e.status === 'resolved' || 
        e.status === 'cancelled'
      )
    }
    return emergencies
  }, [emergencies, filter])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="active">Activas</TabsTrigger>
          <TabsTrigger value="resolved">Resueltas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.map(emergency => (
          <EmergencyCard 
            key={emergency.emergencyId} 
            emergency={emergency} 
          />
        ))}
      </div>
    </div>
  )
}
```

## 🔄 Flujo de Escucha de Remarks

### Arquitectura de Escucha

```
┌─────────────────────────────────────────────────┐
│  Blockchain (Paseo/Polkadot)                    │
│  ┌───────────────────────────────────────────┐ │
│  │  system.remark(emergencyData)              │ │
│  │  → Evento: System.Remarked                 │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  RemarkListener Service                         │
│  ┌───────────────────────────────────────────┐ │
│  │  1. Suscribirse a system.events           │ │
│  │  2. Filtrar System.Remarked               │ │
│  │  3. Extraer datos del remark              │ │
│  │  4. Verificar si es emergencia            │ │
│  │  5. Verificar si es para nuestra cuenta   │ │
│  │  6. Parsear datos de emergencia           │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  useEmergency Hook                              │
│  ┌───────────────────────────────────────────┐ │
│  │  1. Crear Emergency local                 │ │
│  │  2. Guardar en IndexedDB                  │ │
│  │  3. Actualizar estado React               │ │
│  │  4. Notificar al usuario                  │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  UI (Home/Emergencies)                          │
│  ┌───────────────────────────────────────────┐ │
│  │  Mostrar emergencia recibida              │ │
│  │  Actualizar lista                         │ │
│  │  Notificación push (si disponible)        │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Implementación de Escucha

**Estrategia Recomendada**: Escuchar eventos `System.Remarked` y verificar si el remark contiene datos de emergencia y está dirigido a nuestra cuenta.

```typescript
// En RemarkListener.ts
private async handleEvents(events: any[]) {
  for (const eventRecord of events) {
    const event = eventRecord?.event
    
    // Verificar si es evento System.Remarked
    if (event?.pallet === 'System' && event?.name === 'Remarked') {
      // Extraer datos del evento
      const [accountId, remarkHash] = event.data
      
      // Verificar si es para nuestra cuenta
      if (accountId === this.activeAccount) {
        // Obtener el contenido del remark desde el hash
        const remarkContent = await this.getRemarkContent(remarkHash)
        
        // Verificar si es emergencia
        if (this.isEmergencyRemark(remarkContent)) {
          // Parsear y procesar
          const emergency = await this.parseEmergencyRemark(remarkContent)
          this.onEmergencyReceived?.(emergency)
        }
      }
    }
  }
}
```

**Nota**: Obtener el contenido del remark desde el hash puede requerir una query adicional. Alternativamente, podemos escanear bloques recientes buscando transacciones `system.remark`.

## 📦 Dependencias Mínimas

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.11.0",
    "dedot": "^1.0.2",
    "@polkadot/keyring": "^14.0.0",
    "@polkadot/util": "^14.0.0",
    "@polkadot/util-crypto": "^14.0.0",
    "date-fns": "^4.1.0",
    "uuid": "^13.0.0",
    "sonner": "^2.0.7",
    "lucide-react": "^0.562.0"
  }
}
```

## 🚀 Pasos para el Nuevo Agente

### Fase 1: Setup Inicial (Día 1)

1. **Crear nuevo repositorio**
   ```bash
   mkdir emergency-wallet-pwa
   cd emergency-wallet-pwa
   git init
   ```

2. **Inicializar proyecto Vite + React + TypeScript**
   ```bash
   npm create vite@latest . -- --template react-ts
   ```

3. **Instalar dependencias base**
   ```bash
   npm install react-router-dom dedot @polkadot/keyring @polkadot/util @polkadot/util-crypto date-fns uuid sonner lucide-react
   ```

4. **Configurar Tailwind CSS y shadcn/ui**
   - Copiar configuración de `tailwind.config.ts`
   - Instalar componentes shadcn necesarios:
     - `npx shadcn@latest add button card badge dialog select input label`

### Fase 2: Copiar Utilidades del Proyecto Actual (Día 1-2)

1. **Copiar contextos completos**:
   - `src/contexts/KeyringContext.tsx`
   - `src/contexts/NetworkContext.tsx`
   - `src/contexts/ActiveAccountContext.tsx`

2. **Copiar hooks**:
   - `src/hooks/useEmergency.ts`
   - `src/hooks/useDedotClient.ts`

3. **Copiar servicios**:
   - `src/services/emergencies/EmergencyService.ts`

4. **Copiar utilidades**:
   - `src/utils/indexedDB.ts` (adaptar para stores mínimos)
   - `src/utils/emergencyStorage.ts`
   - `src/utils/transactionStorage.ts` (simplificar)

5. **Copiar tipos**:
   - `src/types/emergencies.ts`
   - `src/types/dedot.ts`

6. **Copiar componentes de emergencias**:
   - `src/components/emergencies/EmergencyButton.tsx`
   - `src/components/emergencies/EmergencyPanel.tsx`

### Fase 3: Crear Sistema de Escucha (Día 2-3)

1. **Crear `src/services/blockchain/RemarkListener.ts`**
   - Implementar escucha de eventos `System.Remarked`
   - Filtrar por cuenta activa
   - Parsear remarks de emergencia

2. **Crear `src/hooks/useRemarkListener.ts`**
   - Hook React que usa `RemarkListener`
   - Gestiona estado de escucha
   - Notifica cuando se recibe emergencia

3. **Integrar en `main.tsx`**
   - Inicializar listener cuando hay cuenta activa
   - Mantener escucha activa mientras la app está abierta

### Fase 4: Crear Páginas Principales (Día 3-4)

1. **`src/pages/Home.tsx`**
   - Dashboard con emergencias activas
   - Estado de escucha
   - Botón para crear emergencia

2. **`src/pages/Emergencies.tsx`**
   - Lista completa de emergencias
   - Filtros (activas, resueltas, todas)
   - Cards de emergencia

3. **`src/pages/CreateEmergency.tsx`**
   - Formulario simplificado
   - GPS automático
   - Envío a blockchain

4. **`src/pages/EmergencyDetail.tsx`**
   - Detalle completo de emergencia
   - Mapa con ubicación
   - Historial de actualizaciones

5. **`src/pages/Transactions.tsx`** (Simplificado)
   - Solo transacciones de emergencias
   - Filtro por cuenta activa

6. **`src/pages/Accounts.tsx`** (Simplificado)
   - Lista de cuentas
   - Cambiar cuenta activa

### Fase 5: Layout y Navegación (Día 4)

1. **`src/components/layout/Header.tsx`**
   - Título: "Emergencias"
   - Selector de cuenta activa
   - Estado de conexión

2. **`src/components/layout/BottomNav.tsx`**
   - Home (emergencias)
   - Crear emergencia
   - Cuenta activa

3. **`src/router.tsx`**
   - Rutas mínimas:
     - `/` → Home
     - `/emergencies` → Lista
     - `/emergencies/create` → Crear
     - `/emergencies/:id` → Detalle
     - `/transactions` → Transacciones
     - `/accounts` → Cuentas

### Fase 6: PWA y Offline (Día 5)

1. **Configurar PWA**
   - `vite.config.ts` con `vite-plugin-pwa`
   - `manifest.json`
   - Service Worker básico

2. **Offline Support**
   - Guardar emergencias localmente
   - Sincronizar cuando hay conexión
   - Indicador de estado offline

### Fase 7: Testing y Ajustes (Día 6-7)

1. **Probar escucha de remarks**
   - Crear emergencia de prueba
   - Verificar que se recibe en otra cuenta
   - Probar reconexión

2. **Optimizaciones**
   - Lazy loading de componentes
   - Optimización de queries
   - Manejo de errores

## 🎨 UI/UX Mínima

### Principios de Diseño

1. **Emergencias Primero**: La pantalla principal muestra emergencias activas
2. **Acceso Rápido**: Botón grande y visible para crear emergencia
3. **Estado Claro**: Indicador visual de escucha activa
4. **Offline Visible**: Indicador cuando no hay conexión

### Pantallas Principales

1. **Home/Dashboard**
   - Estado de escucha (verde/rojo)
   - Lista de emergencias activas (máximo 3-5)
   - Botón grande "CREAR EMERGENCIA"
   - Balance de cuenta activa (opcional)

2. **Lista de Emergencias**
   - Filtros: Todas / Activas / Resueltas
   - Cards con información esencial
   - Badge de severidad
   - Fecha/hora

3. **Crear Emergencia**
   - Formulario simple
   - Tipo, severidad, descripción
   - GPS automático
   - Botón de envío

4. **Detalle de Emergencia**
   - Información completa
   - Mapa con ubicación
   - Estado y actualizaciones
   - Historial de blockchain

## 🔐 Seguridad y Privacidad

1. **Datos Sensibles**: No exponer información personal en remarks
2. **Validación**: Verificar firma de remarks recibidos
3. **Rate Limiting**: Limitar creación de emergencias
4. **Permisos**: Solicitar permisos GPS solo cuando sea necesario

## 📱 Características PWA

1. **Instalable**: Manifest configurado
2. **Offline**: Service Worker para cache
3. **Notificaciones**: Push notifications para emergencias recibidas (futuro)
4. **Responsive**: Funciona en móvil y desktop

## 🧪 Testing

### Casos de Prueba

1. **Escucha de Remarks**
   - ✅ Crear emergencia desde cuenta A
   - ✅ Verificar que cuenta B la recibe
   - ✅ Verificar parsing correcto
   - ✅ Verificar guardado en IndexedDB

2. **Offline/Online**
   - ✅ Crear emergencia offline
   - ✅ Sincronizar cuando hay conexión
   - ✅ Recibir emergencias cuando se reconecta

3. **Reconexión**
   - ✅ Reconectar automáticamente
   - ✅ Reanudar escucha
   - ✅ Sincronizar datos pendientes

## 📚 Referencias del Proyecto Original

### Archivos Clave a Revisar

1. **Sistema de Emergencias**:
   - `src/services/emergencies/EmergencyService.ts`
   - `src/hooks/useEmergency.ts`
   - `src/types/emergencies.ts`
   - `src/utils/emergencyStorage.ts`

2. **Blockchain**:
   - `src/hooks/useDedotClient.ts`
   - `src/contexts/NetworkContext.tsx`
   - `src/components/StorageQueries.tsx` (ejemplo de suscripción)

3. **Keyring**:
   - `src/contexts/KeyringContext.tsx`
   - `src/hooks/useKeyring.ts`

4. **IndexedDB**:
   - `src/utils/indexedDB.ts`

### Proyecto de Referencia: Lumo

Revisar documentación en: https://github.com/cryptohumano/lumo/tree/emergency

Archivos relevantes:
- `ARQUITECTURA_EMERGENCIAS_POLKADOT.md`
- `COMO_ESCUCHAR_EMERGENCIAS_BLOCKCHAIN.md`
- `IMPLEMENTACION_EMERGENCIAS_ONCHAIN.md`

## ✅ Checklist de Implementación

### Setup
- [ ] Crear repositorio nuevo
- [ ] Inicializar Vite + React + TypeScript
- [ ] Instalar dependencias
- [ ] Configurar Tailwind y shadcn

### Copiar Utilidades
- [ ] Contextos (Keyring, Network, ActiveAccount)
- [ ] Hooks (useEmergency, useDedotClient)
- [ ] Servicios (EmergencyService)
- [ ] Utilidades (indexedDB, emergencyStorage, transactionStorage)
- [ ] Tipos (emergencies, dedot)
- [ ] Componentes UI base

### Sistema de Escucha
- [ ] Crear RemarkListener service
- [ ] Crear useRemarkListener hook
- [ ] Integrar en app principal
- [ ] Probar escucha de remarks

### Páginas
- [ ] Home (Dashboard)
- [ ] Emergencies (Lista)
- [ ] CreateEmergency
- [ ] EmergencyDetail
- [ ] Transactions (simplificado)
- [ ] Accounts (simplificado)

### Layout
- [ ] Header
- [ ] BottomNav
- [ ] Router

### PWA
- [ ] Manifest
- [ ] Service Worker
- [ ] Offline support

### Testing
- [ ] Escucha de remarks
- [ ] Offline/Online
- [ ] Reconexión

## 🎯 Resultado Final

Una PWA mínima que:

1. ✅ Muestra emergencias como prioridad
2. ✅ Escucha constantemente remarks dirigidos a la cuenta
3. ✅ Permite crear emergencias fácilmente
4. ✅ Funciona offline
5. ✅ Sincroniza automáticamente
6. ✅ Interfaz simple y enfocada

## 📝 Notas Adicionales

### Sobre la Escucha de Remarks

**Problema**: Los eventos `System.Remarked` no contienen el contenido del remark, solo el hash. Necesitamos obtener el contenido desde la transacción original.

**Solución Implementada**: El proyecto actual ya tiene funciones para parsear remarks:
- `parseEmergencyFromRemark(remark: string)` en `src/types/emergencies.ts`
- `serializeEmergencyToRemark(data)` para crear remarks
- Prefijo: `EMERGENCY:` para identificar remarks de emergencia

**Estrategia de Escucha**:

1. **Opción A: Escuchar Eventos System.Remarked** (✅ RECOMENDADA - Más Eficiente)
   - Suscribirse a `query.system.events` (solo eventos, ~1-2KB/bloque)
   - Filtrar eventos `System.Remarked` (filtrado rápido en memoria)
   - Para cada evento, obtener el bloque completo (solo cuando hay remark)
   - Extraer la extrinsic correspondiente
   - Parsear el remark con `parseEmergencyFromRemark`
   - Procesar emergencias encontradas
   
   **Ventajas**:
   - ✅ Solo procesa cuando hay remarks (no todos los bloques)
   - ✅ Menor ancho de banda (solo eventos, no bloques completos)
   - ✅ Menor CPU (filtrado rápido, no procesa todas las extrinsics)
   - ✅ Queries costosas solo cuando realmente hay algo que procesar

2. **Opción B: Escanear Bloques** (❌ NO Recomendada - Menos Eficiente)
   - Suscribirse a nuevos bloques (`chain.subscribeNewHeads`)
   - Obtener bloque completo en cada bloque (~50-200KB/bloque)
   - Escanear todas las extrinsics de cada bloque
   - Filtrar `system.remark` después
   - Parsear contenido con `parseEmergencyFromRemark`
   
   **Desventajas**:
   - ❌ Procesa bloques sin remarks (desperdicio)
   - ❌ Mayor ancho de banda (bloques completos siempre)
   - ❌ Mayor CPU (procesa todas las extrinsics siempre)
   - ❌ Menos eficiente en general

3. **Opción C: Backend Indexer** (Futuro - Más Eficiente pero Requiere Infraestructura)
   - Servicio que indexa todos los remarks
   - API para consultar remarks de emergencia
   - WebSocket para notificaciones en tiempo real
   - Más eficiente pero requiere infraestructura backend

**Recomendación**: **Opción A** - Escuchar eventos `System.Remarked` es la más eficiente porque solo procesa cuando realmente hay un remark, evitando procesar bloques sin remarks.

### Funciones Disponibles del Proyecto Actual

**Para Parsear Remarks**:
```typescript
import { parseEmergencyFromRemark } from '@/types/emergencies'

// El remark viene como string desde la extrinsic
const emergencyData = parseEmergencyFromRemark(remarkString)
if (emergencyData) {
  // Es una emergencia válida
}
```

**Para Crear Remarks**:
```typescript
import { serializeEmergencyToRemark } from '@/types/emergencies'
import { prepareEmergencyRemarkData } from '@/services/emergencies/EmergencyService'

const remarkData = prepareEmergencyRemarkData(emergency, logData)
const remarkString = serializeEmergencyToRemark(remarkData)
```

**Constantes**:
```typescript
const EMERGENCY_REMARK_PREFIX = 'EMERGENCY:'
const EMERGENCY_REMARK_SEPARATOR = '|'
const EMERGENCY_REMARK_VERSION = '1.0'
```

### Optimizaciones Futuras

1. **Backend Indexer**: Servicio que indexa todos los remarks y permite búsqueda eficiente
2. **Push Notifications**: Notificaciones cuando se recibe emergencia
3. **Mapa Offline**: Mapas descargables para áreas de montañismo
4. **Modo SOS**: Botón de emergencia rápida sin formulario

## 🔍 Detalles Técnicos: Obtención del Contenido del Remark

### Problema

Cuando escuchamos eventos `System.Remarked`, solo obtenemos:
- El hash del remark (`H256`)
- La cuenta que hizo el remark (`AccountId`)
- El índice de la extrinsic (`u32`)

**NO obtenemos el contenido del remark directamente** - solo el hash.

### Solución: Obtener desde la Extrinsic

Para obtener el contenido, necesitamos:

1. **Obtener el bloque completo** desde el `blockHash` del evento
2. **Extraer la extrinsic** usando el `extrinsicIndex`
3. **Leer el argumento** del método `system.remark`

```typescript
// Función helper para extraer contenido del remark
async function extractRemarkFromBlock(
  client: DedotClient,
  blockHash: string,
  extrinsicIndex: number
): Promise<string | null> {
  try {
    // Obtener el bloque completo (query costosa, pero solo cuando hay remark)
    const block = await client.chain.getBlock(blockHash)
    
    // Obtener la extrinsic específica
    const extrinsic = block.block.extrinsics[extrinsicIndex]
    
    // Verificar que es system.remark
    if (extrinsic?.method?.pallet === 'System' && 
        extrinsic?.method?.method === 'remark') {
      
      // El contenido del remark está en el primer argumento
      const remarkContent = extrinsic.method.args[0] as string
      return remarkContent
    }
    
    return null
  } catch (error) {
    console.error('Error al extraer remark:', error)
    return null
  }
}
```

### Estrategia Optimizada: Eventos + Query Solo Cuando Hay Remark

**✅ RECOMENDADA**: Escuchar eventos `System.Remarked` y solo obtener bloques cuando hay remarks.

**Ventajas**:
- Solo procesa cuando hay remarks (no todos los bloques)
- Menor ancho de banda (solo eventos, ~1-2KB/bloque)
- Menor CPU (filtrado rápido en memoria)
- Solo queries costosas cuando realmente hay algo que procesar

**Flujo**:
```
Bloque sin remarks:
  → Eventos: 1 query (ligera, ~1KB)
  → Filtro: No hay System.Remarked
  → Resultado: 0 queries adicionales ✅

Bloque con 1 remark:
  → Eventos: 1 query (ligera, ~1KB)
  → Filtro: 1 System.Remarked encontrado
  → Query bloque: 1 query (costosa, ~50KB)
  → Resultado: 1 query adicional (necesaria) ✅
```

**Comparación**:
- **Con eventos**: 1 query ligera + 1 query costosa solo cuando hay remark
- **Escaneando bloques**: 1 query costosa en CADA bloque (incluso sin remarks)
- **Ahorro**: ~98% de queries innecesarias evitadas

### Consideraciones de Rendimiento

**¿Por qué es "costoso" escanear bloques?**

1. **Ancho de Banda**:
   - Eventos: ~1-2KB por bloque (solo eventos)
   - Bloques completos: ~50-200KB por bloque (todas las extrinsics)
   - **Diferencia**: 25-100x más datos

2. **CPU/Procesamiento**:
   - Eventos: Filtrar en memoria (muy rápido, ~1ms)
   - Bloques: Procesar todas las extrinsics (puede ser 10-100+ extrinsics por bloque)
   - **Diferencia**: 10-100x más procesamiento

3. **Queries RPC**:
   - Eventos: 1 query por bloque (eventos)
   - Bloques: 1 query por bloque (bloque completo) + queries adicionales si hay remarks
   - **Diferencia**: Similar en queries, pero mucho más datos transferidos

4. **Frecuencia**:
   - Bloques en Paseo/Polkadot: ~6-12 segundos
   - Con eventos: Solo procesa cuando hay remarks (puede ser 1 cada 10-100 bloques)
   - Con escaneo: Procesa TODOS los bloques, incluso sin remarks

**Ejemplo Real**:
- 100 bloques procesados
- 2 bloques tienen remarks
- **Con eventos**: 2 queries de bloques (solo cuando hay remark)
- **Con escaneo**: 100 queries de bloques (todos los bloques)
- **Ahorro**: 98 queries innecesarias + ~98 bloques completos no transferidos

**Conclusión**: Escuchar eventos es **mucho más eficiente** porque solo procesa cuando realmente hay algo que procesar.

### Alternativa: Backend Indexer (Futuro)

Para producción, considerar un servicio backend que:
- Indexe todos los remarks
- Filtre solo emergencias
- Proporcione API REST/WebSocket
- Permita búsquedas eficientes

## 📖 Referencias del Proyecto Lumo

Revisar documentación en: https://github.com/cryptohumano/lumo/tree/emergency

Archivos clave:
- `COMO_ESCUCHAR_EMERGENCIAS_BLOCKCHAIN.md` - Cómo implementar el listener
- `ARQUITECTURA_EMERGENCIAS_POLKADOT.md` - Arquitectura general
- `IMPLEMENTACION_EMERGENCIAS_ONCHAIN.md` - Implementación on-chain
- `CONFIGURACION_REMARK_EMERGENCIAS.md` - Configuración de remarks
- `backend/prisma/schema.prisma` - Schema de base de datos ✅ **REVISADO**

### 🔍 Schema de Lumo - Modelo Emergency

**Modelo Emergency en Lumo** (del schema Prisma):
```prisma
model Emergency {
  id                String             @id @default(uuid())
  emergencyNumber   String             @unique
  reportedBy        String             // userId (relación con User)
  tripId            String?            // Relación opcional con Trip
  experienceId      String?            // Relación opcional con Experience
  emergencyType     EmergencyType
  severity          EmergencySeverity  @default(HIGH)
  latitude          Float
  longitude         Float
  address           String?
  city              String?
  country           String?
  placeId           String?            // Relación con Place
  title             String
  description       String
  numberOfPeople    Int                @default(1)
  status            EmergencyStatus    @default(REPORTED)
  servicesAlerted   EmergencyService[]
  servicesResponded Json?
  resolvedAt        DateTime?
  resolvedBy        String?            // userId del que resolvió
  resolution        String?
  metadata          Json?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  
  // Relaciones
  reporter   User             @relation("ReportedEmergencies")
  trip       Trip?            @relation
  experience Experience?      @relation
  resolver   User?            @relation("ResolvedEmergencies")
  place      Place?           @relation
  alerts     EmergencyAlert[]
}
```

**Modelo EmergencyAlert** (para alertas a servicios):
```prisma
model EmergencyAlert {
  id              String           @id @default(uuid())
  emergencyId     String
  service         EmergencyService
  method          String           // SMS, CALL, API, WEBHOOK
  target          String           // Número o endpoint
  status          String           // PENDING, SENT, FAILED, DELIVERED, RESPONDED
  responseDetails Json?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  emergency       Emergency        @relation
}
```

**Relación con User**:
- `User.polkadotAddress` → buscar usuario → obtener `User.id` → usar como `Emergency.reportedBy`
- `User.reportedEmergencies` → lista de emergencias reportadas por el usuario
- `User.resolvedEmergencies` → lista de emergencias resueltas por el usuario (si es autoridad)

**Nota**: Lumo tiene un backend que puede hacer filtrado adicional y agregación de datos. Sin embargo, esta PWA está diseñada para funcionar **100% web3 sin backend**.

**Filtrado en esta PWA (Cliente)**:
1. **Por cuenta activa**: Solo emergencias donde `reporterAccount === activeAccount`
2. **Por severidad**: Filtrar por `severity` (low/medium/high/critical)
3. **Por estado**: Filtrar por `status` (pending/submitted/acknowledged/in_progress/resolved)
4. **Por tipo**: Filtrar por `type` (medical/rescue/weather/etc.)

**Filtrado en Lumo Backend (Futuro/Opcional)**:
- Si se integra con el backend de Lumo, puede hacer:
  - Agregación de emergencias de múltiples cuentas
  - Filtrado por ubicación geográfica
  - Filtrado por clasificación de nivel (si existe)
  - Estadísticas y reportes agregados
  - Integración con servicios externos de emergencia

**Arquitectura Híbrida (Futuro con Lumo)**:
```
PWA Emergency Wallet (Cliente)
  ↓
  ├─→ Blockchain (Fuente de verdad principal)
  │   └─→ Escucha eventos System.Remarked
  │       └─→ Filtra por cuenta activa (reporterAccount === activeAccount)
  │       └─→ Procesa emergencias de la cuenta activa
  │
  └─→ Backend Lumo (Futuro - Cuando esté disponible)
      └─→ API REST/WebSocket
      └─→ Lógicas adicionales para cuenta activa:
          ├─→ Reportes y estadísticas
          ├─→ Agregación de datos
          ├─→ Servicios externos de emergencia
          └─→ Sincronización híbrida (blockchain + backend)
```

### 🔄 Adaptación de Bitácoras a Reportes de Emergencia

**Concepto**: Las bitácoras de montañismo se adaptan a reportes de emergencias, manteniendo la estructura pero enfocada en emergencias.

**Estructura de Reporte de Emergencia** (adaptada de bitácora):
```typescript
interface EmergencyReport {
  // Similar a MountainLog pero enfocado en emergencias
  reportId: string                    // Similar a logId
  reporterAccount: string             // Cuenta que reporta
  emergencyType: EmergencyType        // Tipo de emergencia
  severity: EmergencySeverity          // Severidad
  
  // Ubicación (similar a bitácora)
  location: GPSPoint                  // Ubicación de la emergencia
  startDate: number                   // Cuándo comenzó la emergencia
  
  // Contexto (similar a aviso de salida)
  participants?: number                // Número de personas afectadas
  guide?: string                      // Guía o líder del grupo
  activityType?: string               // Tipo de actividad
  
  // Milestones → Eventos de emergencia
  events: EmergencyEvent[]            // Eventos durante la emergencia
  
  // Estado
  status: EmergencyStatus
  createdAt: number
  updatedAt: number
}
```

**Componentes a Adaptar**:
- `MountainLogDetail` → `EmergencyReportDetail`
- `AvisoSalidaForm` → `EmergencyReportForm`
- `Milestone` → `EmergencyEvent`
- Mantener estructura similar pero enfocada en emergencias

**Ventajas de Web3 Puro**:
- ✅ Funciona sin backend
- ✅ Sin punto único de fallo
- ✅ Datos inmutables en blockchain
- ✅ Resistente a censura
- ✅ Funciona offline (con cache local)

### 📋 Sistema de Filtrado de Emergencias

**Función Principal: Escuchar System.Remark para Cuenta Activa**

La función principal de la wallet de emergencias es escuchar eventos `System.Remarked` y procesar solo aquellos que corresponden a la cuenta activa del usuario.

**Estrategia de Filtrado**:

1. **Filtrado por Cuenta Activa** (Principal - Función Core):
   - Escuchar todos los eventos `System.Remarked` desde blockchain
   - Parsear el contenido del remark
   - **Filtro principal**: Solo procesar emergencias donde `reporterAccount === activeAccount`
   - Guardar en IndexedDB solo emergencias de la cuenta activa
   - Mostrar solo emergencias de la cuenta activa en la UI

2. **Filtrado por Severidad** (Secundario):
   - Filtrar por `severity`: `'low' | 'medium' | 'high' | 'critical'`
   - Permitir al usuario filtrar por severidad en la UI
   - Priorizar emergencias `'critical'` y `'high'` en el dashboard

3. **Filtrado por Estado** (Secundario):
   - Filtrar por `status`: `'pending' | 'submitted' | 'acknowledged' | 'in_progress' | 'resolved' | 'cancelled'`
   - Mostrar emergencias activas (`'pending' | 'submitted' | 'acknowledged' | 'in_progress'`) por defecto
   - Permitir ver historial de emergencias resueltas

4. **Filtrado por Tipo** (Opcional):
   - Filtrar por `type`: `'medical' | 'rescue' | 'weather' | 'equipment' | 'lost' | etc.`
   - Permitir búsqueda por tipo en la UI

**Implementación del Filtrado**:

```typescript
// En useRemarkListener.ts
const filterEmergency = (emergencyData: EmergencyRemarkData, activeAccount: string): boolean => {
  // Filtro principal: solo emergencias de la cuenta activa
  if (emergencyData.reporterAccount !== activeAccount) {
    return false
  }
  
  // Filtros adicionales (opcionales, configurables)
  // - Por severidad
  // - Por estado
  // - Por tipo
  
  return true
}
```

**Nota sobre Lumo**:
- Lumo tiene un backend que puede hacer filtrado adicional
- En esta PWA web3 pura, el filtrado se hace completamente en el cliente
- Si en el futuro se integra con el backend de Lumo, el filtrado puede ser híbrido (backend + cliente)

## 🎯 Resumen Ejecutivo

### Para el Nuevo Agente

1. **Crear repositorio nuevo** para PWA mínima de emergencias
2. **Reutilizar máximo código** del proyecto actual (contextos, hooks, servicios, utilidades)
3. **Función principal**: Implementar escucha de `System.Remarked` para cuenta activa
4. **Filtrado por cuenta activa**: Solo procesar emergencias donde `reporterAccount === activeAccount`
5. **Adaptar bitácoras a reportes**: Convertir lógica de bitácoras de montañismo a reportes de emergencias
6. **Arquitectura 100% Web3 inicialmente**: Sin dependencia de backend - blockchain como fuente de verdad
7. **Preparar para Lumo**: Diseñar estructura de API compatible con backend de Lumo
8. **Crear UI mínima** enfocada en emergencias
9. **Priorizar funcionalidad** sobre características avanzadas

### 🏗️ Arquitectura: Web3 Puro con Preparación para Lumo

**Principios Actuales (Web3 Puro)**:
- ✅ **Función principal**: Escuchar `System.Remarked` para cuenta activa
- ✅ **Blockchain como fuente de verdad**: Todas las emergencias se registran en blockchain
- ✅ **Sin backend requerido**: La PWA funciona completamente sin servidor central
- ✅ **Filtrado en cliente**: Filtrar por cuenta activa (`reporterAccount === activeAccount`)
- ✅ **IndexedDB como cache**: Almacena emergencias localmente para acceso rápido
- ✅ **Escucha directa**: Escucha eventos `System.Remarked` directamente desde la blockchain

**Adaptación de Bitácoras**:
- 🔄 **Bitácoras → Reportes**: Adaptar lógica de bitácoras de montañismo a reportes de emergencias
- 🔄 **Mantener estructura**: Conservar mucha lógica de Aura/Andino Wallet pero adaptada
- 🔄 **Componentes adaptados**: `MountainLogDetail` → `EmergencyReportDetail`, etc.

**Futuro: Integración con Lumo Backend**:
- 🔄 **Conexión con Lumo**: Cuando el backend de Lumo esté disponible, la wallet se conectará
- 🔄 **API compatible**: Estructura de API diseñada para ser compatible con schemas de Lumo
- 🔄 **Lógicas adicionales**: Backend aporta lógicas para cuenta activa (reportes, estadísticas, etc.)
- 🔄 **Sincronización híbrida**: Cuando backend y blockchain corren, blockchain aporta información adicional
- 🔄 **API para servicios externos**: Backend expone APIs para servicios de emergencia externos

### 📡 Diseño de API Compatible con Lumo

**Estructura de API (Preparada para Lumo)**:

```typescript
// Servicio de API para conexión futura con Lumo
interface LumoAPIService {
  // Endpoints de emergencias
  getEmergenciesByAccount(account: string): Promise<Emergency[]>
  getEmergencyById(emergencyId: string): Promise<Emergency | null>
  createEmergency(emergency: CreateEmergencyData): Promise<Emergency>
  updateEmergencyStatus(emergencyId: string, status: EmergencyStatus): Promise<Emergency>
  
  // Reportes para cuenta activa
  getReportsByAccount(account: string): Promise<EmergencyReport[]>
  getReportById(reportId: string): Promise<EmergencyReport | null>
  createReport(report: CreateReportData): Promise<EmergencyReport>
  
  // Estadísticas para cuenta activa
  getAccountStatistics(account: string): Promise<AccountStatistics>
  getEmergencyHistory(account: string, filters?: EmergencyFilters): Promise<Emergency[]>
}

// Estructura compatible con schema de Lumo
interface LumoEmergency {
  id: string
  emergencyNumber: string
  reportedBy: string // userId (obtenido de User.polkadotAddress)
  tripId?: string
  experienceId?: string
  emergencyType: 'ACCIDENT' | 'MEDICAL' | 'FIRE' | 'CRIME' | 'SECURITY_THREAT' | 'MOUNTAIN_RESCUE' | 'WATER_RESCUE' | 'OTHER'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  latitude: number
  longitude: number
  address?: string
  city?: string
  country?: string
  placeId?: string
  title: string
  description: string
  numberOfPeople: number
  status: 'REPORTED' | 'ALERTING' | 'ALERTED' | 'RESPONDING' | 'RESOLVED' | 'CANCELLED' | 'FALSE_ALARM'
  servicesAlerted: Array<'POLICE' | 'FIRE_DEPARTMENT' | 'AMBULANCE' | 'MOUNTAIN_RESCUE' | 'WATER_RESCUE' | 'COAST_GUARD' | 'CIVIL_DEFENSE' | 'OTHER'>
  servicesResponded?: any
  resolvedAt?: Date
  resolvedBy?: string
  resolution?: string
  metadata?: any
  createdAt: Date
  updatedAt: Date
}

// Función de mapeo: Emergency (AndinoWallet) → LumoEmergency
function mapEmergencyToLumo(emergency: Emergency, userId: string): LumoEmergency {
  // Mapear tipos
  const typeMap: Record<string, string> = {
    'medical': 'MEDICAL',
    'rescue': 'MOUNTAIN_RESCUE',
    'weather': 'OTHER',
    'equipment': 'OTHER',
    'lost': 'OTHER',
    'injury': 'MEDICAL',
    'illness': 'MEDICAL',
    'avalanche': 'MOUNTAIN_RESCUE',
    'rockfall': 'MOUNTAIN_RESCUE',
    'other': 'OTHER'
  }
  
  // Mapear estados
  const statusMap: Record<string, string> = {
    'pending': 'REPORTED',
    'submitted': 'REPORTED',
    'acknowledged': 'ALERTED',
    'in_progress': 'RESPONDING',
    'resolved': 'RESOLVED',
    'cancelled': 'CANCELLED'
  }
  
  return {
    id: emergency.emergencyId,
    emergencyNumber: `EMG-${emergency.emergencyId.slice(0, 8).toUpperCase()}`,
    reportedBy: userId,
    tripId: emergency.relatedLogId, // Mapear relatedLogId a tripId si aplica
    emergencyType: typeMap[emergency.type] || 'OTHER',
    severity: emergency.severity.toUpperCase() as any,
    latitude: emergency.location.latitude,
    longitude: emergency.location.longitude,
    address: emergency.metadata?.logLocation,
    city: emergency.metadata?.logLocation?.split(',')[0],
    title: `${emergency.type} - ${emergency.description.slice(0, 50)}`,
    description: emergency.description,
    numberOfPeople: emergency.metadata?.avisoSalida?.numeroParticipantes || 1,
    status: statusMap[emergency.status] || 'REPORTED',
    servicesAlerted: [], // Determinar según tipo y severidad
    metadata: emergency.metadata,
    createdAt: new Date(emergency.createdAt),
    updatedAt: new Date(emergency.updatedAt)
  }
}
```

**Nota**: El schema de Lumo ya está revisado. Ver sección "Estructura Confirmada en Lumo" arriba.

### 📚 Cómo Revisar la Estructura de Lumo

**Pasos para entender la estructura de Lumo**:

1. **Revisar Backend de Lumo**:
   ```bash
   # Clonar repositorio de Lumo
   git clone https://github.com/cryptohumano/lumo.git
   cd lumo
   git checkout emergency
   
   # Revisar estructura del backend
   cd backend
   ls -la
   ```

2. **Revisar Schema de Prisma**:
   ```bash
   # Ver schema de emergencias
   cat prisma/schema.prisma | grep -A 50 "model Emergency"
   ```

3. **Revisar API Endpoints**:
   ```bash
   # Buscar endpoints de emergencias
   find . -name "*.ts" -o -name "*.js" | xargs grep -l "emergency" | head -10
   ```

4. **Revisar Documentación**:
   - `ARQUITECTURA_EMERGENCIAS_POLKADOT.md`
   - `IMPLEMENTACION_EMERGENCIAS_ONCHAIN.md`
   - `CONFIGURACION_REMARK_EMERGENCIAS.md`

**Estructura Confirmada en Lumo** (del schema Prisma):

**Modelo Emergency en Lumo**:
```prisma
model Emergency {
  id                String             @id @default(uuid())
  emergencyNumber   String             @unique
  reportedBy        String             // userId
  tripId            String?
  experienceId      String?
  emergencyType     EmergencyType      // ACCIDENT, MEDICAL, FIRE, CRIME, etc.
  severity          EmergencySeverity  // LOW, MEDIUM, HIGH, CRITICAL
  latitude          Float
  longitude         Float
  address           String?
  city              String?
  country           String?
  placeId           String?
  title             String
  description       String
  numberOfPeople    Int                @default(1)
  status            EmergencyStatus    // REPORTED, ALERTING, ALERTED, etc.
  servicesAlerted   EmergencyService[] // POLICE, FIRE_DEPARTMENT, etc.
  servicesResponded Json?
  resolvedAt        DateTime?
  resolvedBy        String?
  resolution        String?
  metadata          Json?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
}
```

**Enums en Lumo**:
- `EmergencyType`: ACCIDENT, MEDICAL, FIRE, CRIME, SECURITY_THREAT, MOUNTAIN_RESCUE, WATER_RESCUE, OTHER
- `EmergencySeverity`: LOW, MEDIUM, HIGH, CRITICAL
- `EmergencyStatus`: REPORTED, ALERTING, ALERTED, RESPONDING, RESOLVED, CANCELLED, FALSE_ALARM
- `EmergencyService`: POLICE, FIRE_DEPARTMENT, AMBULANCE, MOUNTAIN_RESCUE, WATER_RESCUE, COAST_GUARD, CIVIL_DEFENSE, OTHER

**Diferencias con AndinoWalletPWA**:
- Lumo usa `reportedBy` (userId), nosotros usamos `reporterAccount` (polkadotAddress)
- Lumo tiene `emergencyNumber` único, nosotros usamos `emergencyId` (UUID)
- Lumo tiene `servicesAlerted` y `servicesResponded`, nosotros no
- Lumo tiene `tripId` y `experienceId`, nosotros tenemos `relatedLogId`
- Estados diferentes: Lumo tiene ALERTING, ALERTED, RESPONDING; nosotros tenemos submitted, acknowledged, in_progress

**Estrategia de Mapeo**:
- Mapear `reporterAccount` (polkadotAddress) → buscar `User` por `polkadotAddress` → obtener `userId` → usar como `reportedBy`
- Mapear `emergencyId` → `emergencyNumber` (generar número único)
- Mapear `relatedLogId` → `tripId` o `experienceId` (según contexto)
- Mapear estados: `submitted` → `REPORTED`, `acknowledged` → `ALERTED`, `in_progress` → `RESPONDING`, `resolved` → `RESOLVED`

**Preparación para Integración**:
- ✅ Diseñar interfaces TypeScript compatibles con schema de Lumo (ver arriba)
- ✅ Crear función de mapeo `mapEmergencyToLumo` para convertir estructura
- ✅ Crear servicio `LumoAPIService` que se active cuando el backend esté disponible
- ✅ Implementar sincronización bidireccional (blockchain ↔ backend)
- ✅ Manejar casos donde backend no esté disponible (fallback a blockchain)
- ✅ Mapear `reporterAccount` (polkadotAddress) → `reportedBy` (userId) usando API de Lumo

**Endpoints Esperados en Lumo** (a confirmar en código del backend):
- `GET /api/emergencies?reportedBy={userId}` - Obtener emergencias por usuario
- `GET /api/emergencies/{id}` - Obtener emergencia por ID
- `POST /api/emergencies` - Crear emergencia
- `PATCH /api/emergencies/{id}` - Actualizar estado de emergencia
- `GET /api/users/by-polkadot-address/{address}` - Obtener userId por polkadotAddress
- `GET /api/emergencies/{id}/alerts` - Obtener alertas de una emergencia
- `POST /api/emergencies/{id}/alerts` - Crear alerta para servicios

**Nota Importante sobre Mapeo**:
- La wallet usa `reporterAccount` (polkadotAddress) directamente
- Lumo requiere `reportedBy` (userId) que se obtiene buscando `User` por `polkadotAddress`
- Necesitar endpoint o lógica para obtener `userId` desde `polkadotAddress` antes de sincronizar

### Archivos Críticos a Copiar

**100% Reutilizable**:
- `src/contexts/*` (todos)
- `src/hooks/useEmergency.ts`
- `src/hooks/useDedotClient.ts`
- `src/services/emergencies/EmergencyService.ts`
- `src/utils/emergencyStorage.ts`
- `src/types/emergencies.ts`
- `src/components/emergencies/*`

**Adaptar**:
- `src/utils/indexedDB.ts` (solo stores necesarios)
- `src/utils/transactionStorage.ts` (simplificar)

**Crear Nuevo**:
- `src/hooks/useRemarkListener.ts`
- `src/pages/Home.tsx` (dashboard emergencias)
- `src/pages/Emergencies.tsx`
- `src/pages/CreateEmergency.tsx`
- `src/pages/EmergencyDetail.tsx`
- `src/router.tsx` (rutas mínimas)

---

**Este documento debe ser usado por el nuevo agente para construir la PWA mínima de emergencias, reutilizando al máximo las utilidades del proyecto actual.**
