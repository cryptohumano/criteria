# Estructura de Base de Datos - Aura Wallet

## Visión General

Aura Wallet es una PWA que funciona como wallet criptográfica con capacidades avanzadas de gestión de documentos, credenciales y registros. Esta base de datos está diseñada para funcionar completamente offline, con sincronización opcional cuando hay conexión.

## Base de Datos Principal

### Nombre: `aura-wallet`
### Versión: 1
### Descripción: Base de datos principal de Aura Wallet

## Object Stores (Tablas)

### 1. `accounts` - Cuentas del Keyring

**Propósito**: Almacenar información pública de las cuentas (sin secretos)

**Key Path**: `address` (SS58 address)

**Estructura TypeScript**:
```typescript
interface Account {
  // Clave primaria
  address: string                    // SS58 address (ej: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY")
  
  // Información criptográfica
  publicKey: string                  // Public key en hex (0x...)
  type: 'sr25519' | 'ed25519' | 'ecdsa'  // Tipo de criptografía
  ethereumAddress?: string          // Dirección Ethereum derivada (si aplica)
  
  // Metadata del usuario
  meta: {
    name?: string                    // Nombre personalizado de la cuenta
    tags?: string[]                  // Etiquetas para organización (ej: ["main", "trading"])
    notes?: string                   // Notas del usuario
    icon?: string                    // Emoji o icono personalizado
    color?: string                   // Color personalizado (hex)
    [key: string]: any               // Metadata adicional flexible
  }
  
  // Estado de la cuenta
  isActive: boolean                 // Si la cuenta está activa
  isHardware?: boolean              // Si es una cuenta de hardware wallet
  hardwareType?: 'ledger' | 'trezor' | 'other'  // Tipo de hardware
  
  // Timestamps
  createdAt: number                 // Timestamp de creación
  updatedAt: number                 // Última actualización
  lastUsedAt?: number               // Última vez que se usó
}
```

**Índices**:
- `byType` → `type` (búsqueda por tipo de criptografía)
- `byCreatedAt` → `createdAt` (ordenar por fecha de creación)
- `byName` → `meta.name` (búsqueda por nombre)
- `byActive` → `isActive` (filtrar cuentas activas)
- `byLastUsed` → `lastUsedAt` (ordenar por último uso)

---

### 2. `encrypted_secrets` - Secretos Encriptados

**Propósito**: Almacenar seeds, mnemonics y claves privadas encriptadas

**Key Path**: `accountAddress` (relación con `accounts.address`)

**Estructura TypeScript**:
```typescript
interface EncryptedSecret {
  // Clave primaria (relación con accounts)
  accountAddress: string            // SS58 address de la cuenta relacionada
  
  // Datos encriptados
  encryptedData: string              // Seed/mnemonic encriptado (JSON stringificado)
  encryptionMethod: string          // Método usado: "AES-GCM-256", "WebAuthn", etc.
  encryptionVersion: number         // Versión del algoritmo de encriptación
  
  // Metadata de encriptación
  salt?: string                      // Salt usado para derivación de clave
  iv?: string                        // Initialization Vector (si aplica)
  iterations?: number                // Iteraciones PBKDF2 (si aplica)
  
  // Información de recuperación
  backupEncrypted?: string           // Backup encriptado con clave de recuperación
  recoveryQuestions?: {              // Preguntas de recuperación (hasheadas)
    question: string
    answerHash: string
  }[]
  
  // Timestamps
  createdAt: number
  updatedAt: number
  lastDecryptedAt?: number          // Última vez que se desencriptó (auditoría)
}
```

**Índices**:
- `byEncryptionMethod` → `encryptionMethod` (filtrar por método)
- `byCreatedAt` → `createdAt` (ordenar por fecha)

**Seguridad**:
- ⚠️ **NUNCA** almacenar secretos en texto plano
- Siempre usar encriptación fuerte (AES-GCM-256 mínimo)
- Considerar WebAuthn para protección adicional

---

### 3. `transactions` - Historial de Transacciones

**Propósito**: Almacenar historial completo de transacciones de todas las cuentas

**Key Path**: `id` (hash de transacción o UUID para pendientes)

**Estructura TypeScript**:
```typescript
interface Transaction {
  // Identificación
  id: string                         // Hash de transacción o UUID para pendientes
  hash?: string                      // Hash de blockchain (cuando está confirmada)
  
  // Relaciones
  accountAddress: string             // Cuenta que originó la transacción
  chain: string                      // Nombre de la cadena (ej: "polkadot", "kusama")
  chainId?: string                   // ID específico de la cadena
  
  // Información de la transacción
  from: string                      // Dirección origen
  to?: string                        // Dirección destino
  amount?: string                    // Cantidad (en formato string para precisión)
  token?: string                     // Símbolo del token (ej: "DOT", "KSM")
  fee?: string                       // Fee pagado
  tip?: string                       // Tip opcional
  
  // Estado
  status: 'pending' | 'broadcast' | 'in_block' | 'finalized' | 'failed'
  error?: string                     // Mensaje de error si falló
  
  // Información de blockchain
  blockNumber?: number               // Número de bloque
  blockHash?: string                 // Hash del bloque
  extrinsicIndex?: number            // Índice del extrinsic en el bloque
  finalizedAt?: number               // Timestamp cuando se finalizó
  
  // Metadata
  pallet?: string                    // Pallet de Substrate (ej: "balances", "system")
  method?: string                    // Método llamado (ej: "transfer", "transfer_keep_alive")
  metadata?: {                       // Metadata adicional
    [key: string]: any
  }
  
  // Timestamps
  timestamp: number                  // Timestamp de creación/envió
  createdAt: number                 // Timestamp de registro en DB
  updatedAt: number                  // Última actualización
}
```

**Índices**:
- `byAccount` → `accountAddress` (transacciones por cuenta)
- `byChain` → `chain` (transacciones por cadena)
- `byStatus` → `status` (filtrar por estado)
- `byTimestamp` → `timestamp` (ordenar por fecha)
- `byBlockNumber` → `blockNumber` (ordenar por bloque, si aplica)
- `compound_account_chain` → `[accountAddress, chain]` (búsqueda compuesta)

---

### 4. `balances` - Balances de Cuentas

**Propósito**: Cache de balances de cuentas por cadena

**Key Path**: `id` (compuesto: `${accountAddress}_${chain}`)

**Estructura TypeScript**:
```typescript
interface Balance {
  // Clave primaria compuesta
  id: string                         // `${accountAddress}_${chain}`
  
  // Relaciones
  accountAddress: string             // Dirección de la cuenta
  chain: string                      // Nombre de la cadena
  
  // Balances
  free: string                      // Balance libre (disponible)
  reserved: string                  // Balance reservado
  frozen: string                     // Balance congelado
  miscFrozen?: string                // Balance misceláneo congelado
  
  // Tokens adicionales (para multi-asset)
  tokens?: {                         // Balances de otros tokens
    [tokenId: string]: {
      free: string
      reserved: string
      frozen: string
    }
  }
  
  // Metadata
  nonce?: number                     // Nonce de la cuenta
  lastUpdate?: number                 // Última actualización del balance
  
  // Timestamps
  updatedAt: number                  // Última actualización en DB
}
```

**Índices**:
- `byAccount` → `accountAddress` (balances por cuenta)
- `byChain` → `chain` (balances por cadena)
- `compound_account_chain` → `[accountAddress, chain]` (búsqueda rápida)
- `byUpdatedAt` → `updatedAt` (ordenar por última actualización)

---

### 5. `contacts` - Contactos y Direcciones

**Propósito**: Almacenar direcciones frecuentemente usadas

**Key Path**: `id` (UUID)

**Estructura TypeScript**:
```typescript
interface Contact {
  // Identificación
  id: string                         // UUID
  
  // Información del contacto
  name: string                       // Nombre del contacto
  address: string                    // SS58 o Ethereum address
  addressType: 'ss58' | 'ethereum' | 'other'  // Tipo de dirección
  
  // Metadata
  tags?: string[]                    // Etiquetas (ej: ["friend", "exchange"])
  notes?: string                     // Notas
  avatar?: string                    // URL o base64 de avatar
  
  // Información adicional
  chains?: string[]                  // Cadenas donde se usa esta dirección
  verified?: boolean                 // Si la dirección está verificada
  
  // Timestamps
  createdAt: number
  updatedAt: number
  lastUsedAt?: number                // Última vez que se usó
}
```

**Índices**:
- `byAddress` → `address` (búsqueda por dirección)
- `byName` → `name` (búsqueda por nombre)
- `byLastUsed` → `lastUsedAt` (ordenar por último uso)

---

### 6. `networks` - Configuración de Redes

**Propósito**: Almacenar configuración de redes blockchain

**Key Path**: `id` (UUID o nombre único)

**Estructura TypeScript**:
```typescript
interface Network {
  // Identificación
  id: string                         // UUID o nombre único
  name: string                       // Nombre de la red (ej: "Polkadot", "Kusama")
  
  // Configuración de conexión
  endpoint: string                   // WebSocket endpoint (ej: "wss://rpc.polkadot.io")
  rpcUrl?: string                    // HTTP RPC URL (opcional)
  explorerUrl?: string               // URL del explorador de bloques
  
  // Información de la red
  chainId?: string                   // ID de la cadena
  genesisHash?: string               // Hash del bloque génesis
  ss58Format?: number                // Formato SS58 (ej: 0 para Polkadot, 2 para Kusama)
  
  // Metadata
  icon?: string                      // URL o emoji del icono
  color?: string                     // Color de la red (hex)
  isTestnet: boolean                // Si es una red de prueba
  isCustom: boolean                  // Si es una red personalizada
  
  // Configuración
  isEnabled: boolean                 // Si la red está habilitada
  isFavorite?: boolean                // Si está marcada como favorita
  
  // Timestamps
  createdAt: number
  updatedAt: number
  lastConnectedAt?: number           // Última vez que se conectó
}
```

**Índices**:
- `byName` → `name` (búsqueda por nombre)
- `byEnabled` → `isEnabled` (filtrar redes habilitadas)
- `byFavorite` → `isFavorite` (filtrar favoritas)

---

### 7. `documents` - Documentos PDF

**Propósito**: Almacenar documentos PDF generados (flight logs, medical records, etc.)

**Key Path**: `documentId` (UUID)

**Estructura TypeScript**:
```typescript
interface Document {
  // Identificación
  documentId: string                 // UUID
  
  // Tipo y clasificación
  type: 'flight_log' | 'medical_record' | 'attestation' | 'other'
  category?: string                  // Categoría adicional
  
  // Contenido
  pdf?: string                       // PDF en base64 (opcional, puede estar solo en cache)
  pdfHash: string                    // Hash SHA-256 del PDF
  pdfSize: number                    // Tamaño en bytes
  
  // Firmas
  signatures?: {                     // Firmas digitales
    signer: string                   // Dirección del firmante
    signature: string                 // Firma en hex
    timestamp: number                // Timestamp de la firma
    certificate?: string             // Certificado X.509 (base64)
    valid?: boolean                  // Si la firma es válida
  }[]
  
  // Encriptación
  encrypted: boolean                 // Si el documento está encriptado
  encryptionMethod?: string          // Método de encriptación
  encryptionKeyId?: string           // ID de la clave de encriptación
  
  // Metadata
  metadata: {
    title?: string
    description?: string
    author?: string
    subject?: string
    keywords?: string[]
    [key: string]: any
  }
  
  // Relaciones
  relatedAccount?: string            // Cuenta relacionada
  relatedFlightLogId?: string        // ID de flight log relacionado
  relatedMedicalRecordId?: string    // ID de medical record relacionado
  
  // Timestamps
  createdAt: number
  updatedAt: number
}
```

**Índices**:
- `byType` → `type` (filtrar por tipo)
- `byHash` → `pdfHash` (búsqueda por hash)
- `byAccount` → `relatedAccount` (documentos por cuenta)
- `byCreatedAt` → `createdAt` (ordenar por fecha)

---

### 8. `flight_logs` - Registros de Horas de Vuelo

**Propósito**: Almacenar registros de horas de vuelo de pilotos

**Key Path**: `flightLogId` (UUID)

**Estructura TypeScript**:
```typescript
interface FlightLog {
  // Identificación
  flightLogId: string                // UUID
  
  // Relaciones
  pilotAddress: string               // Dirección del piloto
  documentId?: string                // ID del documento PDF relacionado
  
  // Información del vuelo
  flight: {
    date: string                     // ISO 8601 date
    duration: number                 // Duración en horas (decimal)
    aircraft: {
      registration: string           // Matrícula (ej: "N12345")
      type: string                    // Tipo (ej: "Cessna 172")
      model?: string                  // Modelo específico
    }
    route: {
      origin: {
        icao: string                 // Código ICAO (ej: "MMMX")
        name: string                  // Nombre del aeropuerto
        gps: {
          latitude: number
          longitude: number
          altitude: number
          accuracy?: number
        }
      }
      destination: {
        icao: string
        name: string
        gps: {
          latitude: number
          longitude: number
          altitude: number
          accuracy?: number
        }
      }
    }
    conditions?: {
      weather: string                 // Condiciones meteorológicas
      visibility: string
      clouds: string
    }
    notes?: string                   // Notas adicionales
  }
  
  // Fotos
  photos?: {                         // Fotos con metadata
    data: string                     // Base64 de la foto
    metadata: {
      exif: {
        DateTime?: string
        GPSLatitude?: string
        GPSLongitude?: string
        [key: string]: any
      }
    }
    timestamp: number
  }[]
  
  // Estadísticas calculadas
  totalHours?: number                // Total de horas acumuladas
  
  // Timestamps
  createdAt: number
  updatedAt: number
}
```

**Índices**:
- `byPilot` → `pilotAddress` (logs por piloto)
- `byDate` → `flight.date` (ordenar por fecha)
- `byAircraft` → `flight.aircraft.registration` (logs por aeronave)
- `compound_pilot_date` → `[pilotAddress, flight.date]` (búsqueda compuesta)

---

### 9. `medical_records` - Expedientes Médicos

**Propósito**: Almacenar expedientes médicos encriptados

**Key Path**: `recordId` (UUID)

**Estructura TypeScript**:
```typescript
interface MedicalRecord {
  // Identificación
  recordId: string                   // UUID
  
  // Relaciones
  patientAddress: string             // Dirección del paciente
  providerAddress?: string           // Dirección del proveedor médico
  documentId?: string                // ID del documento PDF relacionado
  
  // Información del registro
  record: {
    type: 'examination' | 'lab_result' | 'prescription' | 'vaccination' | 'other'
    date: string                     // ISO 8601 date
    provider: {
      name: string
      license?: string
      address?: string
    }
    data: {                          // Datos del registro (estructura flexible)
      [key: string]: any
    }
    attachments?: {                  // Archivos adjuntos
      type: string
      data: string                   // Base64
      hash: string
    }[]
  }
  
  // Seguridad
  encrypted: boolean                 // Si está encriptado
  encryptionKeyId?: string           // ID de la clave de encriptación
  accessControl?: {                   // Control de acceso
    allowedAddresses: string[]       // Direcciones con acceso
  }
  
  // Timestamps
  createdAt: number
  updatedAt: number
}
```

**Índices**:
- `byPatient` → `patientAddress` (registros por paciente)
- `byProvider` → `providerAddress` (registros por proveedor)
- `byType` → `record.type` (filtrar por tipo)
- `byDate` → `record.date` (ordenar por fecha)

---

### 10. `attestations` - Atestaciones de Credenciales

**Propósito**: Almacenar credenciales verificables y atestaciones

**Key Path**: `attestationId` (UUID)

**Estructura TypeScript**:
```typescript
interface Attestation {
  // Identificación
  attestationId: string              // UUID
  
  // Relaciones
  subject: string                    // Dirección del sujeto (quien recibe la credencial)
  issuer: string                     // Dirección del emisor
  
  // Credencial
  credential: {
    id: string                       // ID único de la credencial
    type: string                     // Tipo (ej: "pilot_license", "medical_certificate")
    claims: {                        // Reclamaciones/atributos
      [key: string]: any
    }
    evidence?: {                     // Evidencia (documentos relacionados)
      type: string
      documentId?: string
      flightLogId?: string
      medicalRecordId?: string
    }[]
  }
  
  // Prueba criptográfica
  proof: {
    type: string                     // Tipo de prueba (ej: "Ed25519Signature2020")
    created: string                  // ISO 8601 timestamp
    verificationMethod: string      // Método de verificación
    proofValue: string              // Valor de la prueba (firma)
    challenge?: string               // Challenge usado
    domain?: string                  // Dominio de verificación
  }
  
  // Formato
  format: 'W3C_VC' | 'ISO_18013' | 'custom'  // Formato de la credencial
  
  // Estado
  valid: boolean                     // Si la credencial es válida
  expired: boolean                   // Si está expirada
  expirationDate?: string            // Fecha de expiración (ISO 8601)
  
  // Timestamps
  createdAt: number
  updatedAt: number
  verifiedAt?: number               // Cuándo se verificó
}
```

**Índices**:
- `bySubject` → `subject` (atestaciones por sujeto)
- `byIssuer` → `issuer` (atestaciones por emisor)
- `byType` → `credential.type` (filtrar por tipo)
- `byValid` → `valid` (filtrar válidas/inválidas)
- `byExpired` → `expired` (filtrar expiradas)

---

### 11. `sync_queue` - Cola de Sincronización

**Propósito**: Almacenar operaciones pendientes de sincronización

**Key Path**: `id` (UUID)

**Estructura TypeScript**:
```typescript
interface SyncOperation {
  // Identificación
  id: string                         // UUID
  
  // Tipo de operación
  type: 'upload_document' | 'create_flight_log' | 'create_medical_record' | 
        'create_attestation' | 'update_balance' | 'sync_transaction'
  
  // Datos
  data: any                          // Datos de la operación
  
  // Estado
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: 'low' | 'normal' | 'high'
  
  // Reintentos
  retries: number                    // Número de intentos
  maxRetries: number                 // Máximo de reintentos
  lastError?: string                 // Último error
  
  // Timestamps
  createdAt: number
  updatedAt: number
  processedAt?: number               // Cuándo se procesó
}
```

**Índices**:
- `byStatus` → `status` (filtrar por estado)
- `byPriority` → `priority` (ordenar por prioridad)
- `byCreatedAt` → `createdAt` (ordenar por fecha)

---

### 12. `settings` - Configuración de la Aplicación

**Propósito**: Almacenar configuración y preferencias del usuario

**Key Path**: `key` (string)

**Estructura TypeScript**:
```typescript
interface Setting {
  // Clave primaria
  key: string                        // Clave de configuración (ej: "theme", "language")
  
  // Valor
  value: any                         // Valor (JSON serializable)
  
  // Metadata
  category?: string                  // Categoría (ej: "ui", "security", "network")
  description?: string               // Descripción de la configuración
  
  // Timestamps
  updatedAt: number
}
```

**Configuraciones comunes**:
- `theme`: "light" | "dark" | "auto"
- `language`: código de idioma (ej: "es", "en")
- `currency`: moneda preferida
- `defaultChain`: cadena por defecto
- `autoLock`: tiempo de auto-bloqueo (minutos)
- `biometricEnabled`: si está habilitada autenticación biométrica
- `notificationsEnabled`: si están habilitadas las notificaciones

---

### 13. `cache` - Cache de Datos

**Propósito**: Cache temporal de datos de blockchain y APIs

**Key Path**: `key` (string compuesto)

**Estructura TypeScript**:
```typescript
interface CacheEntry {
  // Clave primaria
  key: string                        // Clave compuesta (ej: "chain_info_polkadot")
  
  // Datos
  data: any                          // Datos cacheados
  
  // Expiración
  expiresAt: number                 // Timestamp de expiración
  ttl: number                        // Time to live en segundos
  
  // Metadata
  category?: string                  // Categoría del cache
  
  // Timestamps
  createdAt: number
}
```

**Índices**:
- `byExpiresAt` → `expiresAt` (limpieza automática)
- `byCategory` → `category` (filtrar por categoría)

**Categorías comunes**:
- `chain_info`: Información de cadenas
- `metadata`: Metadata de runtime
- `balance`: Balances
- `transaction`: Información de transacciones

---

### 14. `webauthn_credentials` - Credenciales WebAuthn

**Propósito**: Almacenar credenciales WebAuthn para autenticación

**Key Path**: `id` (string)

**Estructura TypeScript**:
```typescript
interface WebAuthnCredential {
  // Identificación
  id: string                         // Credential ID (base64url)
  
  // Información
  name: string                       // Nombre de la credencial
  publicKey: ArrayBuffer             // Public key
  counter: number                    // Contador de uso
  
  // Metadata
  masterKeySalt?: string              // Salt para derivación de clave maestra
  createdAt: number
  lastUsedAt?: number
}
```

**Índices**:
- `byCreatedAt` → `createdAt` (ordenar por fecha)

---

## Diagrama de Relaciones

```
accounts (1) ──┐
               │
               ├──> encrypted_secrets (1:1)
               │
               ├──> transactions (1:N)
               │
               ├──> balances (1:N)
               │
               ├──> flight_logs (1:N) ──> documents (N:1)
               │
               ├──> medical_records (1:N) ──> documents (N:1)
               │
               └──> attestations (1:N como subject o issuer)
                     │
                     └──> documents (N:1)
```

## Migraciones de Schema

### Versión 1 (Inicial)

```typescript
// src/utils/auraWalletDB.ts
const DB_NAME = 'aura-wallet'
const DB_VERSION = 1

export async function openAuraWalletDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion || 0

      // Crear todos los object stores
      createObjectStores(db, oldVersion)
    }
  })
}

function createObjectStores(db: IDBDatabase, oldVersion: number) {
  // 1. accounts
  if (!db.objectStoreNames.contains('accounts')) {
    const store = db.createObjectStore('accounts', { keyPath: 'address' })
    store.createIndex('byType', 'type', { unique: false })
    store.createIndex('byCreatedAt', 'createdAt', { unique: false })
    store.createIndex('byName', 'meta.name', { unique: false })
    store.createIndex('byActive', 'isActive', { unique: false })
    store.createIndex('byLastUsed', 'lastUsedAt', { unique: false })
  }

  // 2. encrypted_secrets
  if (!db.objectStoreNames.contains('encrypted_secrets')) {
    const store = db.createObjectStore('encrypted_secrets', { keyPath: 'accountAddress' })
    store.createIndex('byEncryptionMethod', 'encryptionMethod', { unique: false })
    store.createIndex('byCreatedAt', 'createdAt', { unique: false })
  }

  // 3. transactions
  if (!db.objectStoreNames.contains('transactions')) {
    const store = db.createObjectStore('transactions', { keyPath: 'id' })
    store.createIndex('byAccount', 'accountAddress', { unique: false })
    store.createIndex('byChain', 'chain', { unique: false })
    store.createIndex('byStatus', 'status', { unique: false })
    store.createIndex('byTimestamp', 'timestamp', { unique: false })
    store.createIndex('byBlockNumber', 'blockNumber', { unique: false })
    store.createIndex('compound_account_chain', ['accountAddress', 'chain'], { unique: false })
  }

  // 4. balances
  if (!db.objectStoreNames.contains('balances')) {
    const store = db.createObjectStore('balances', { keyPath: 'id' })
    store.createIndex('byAccount', 'accountAddress', { unique: false })
    store.createIndex('byChain', 'chain', { unique: false })
    store.createIndex('compound_account_chain', ['accountAddress', 'chain'], { unique: false })
    store.createIndex('byUpdatedAt', 'updatedAt', { unique: false })
  }

  // 5. contacts
  if (!db.objectStoreNames.contains('contacts')) {
    const store = db.createObjectStore('contacts', { keyPath: 'id' })
    store.createIndex('byAddress', 'address', { unique: false })
    store.createIndex('byName', 'name', { unique: false })
    store.createIndex('byLastUsed', 'lastUsedAt', { unique: false })
  }

  // 6. networks
  if (!db.objectStoreNames.contains('networks')) {
    const store = db.createObjectStore('networks', { keyPath: 'id' })
    store.createIndex('byName', 'name', { unique: false })
    store.createIndex('byEnabled', 'isEnabled', { unique: false })
    store.createIndex('byFavorite', 'isFavorite', { unique: false })
  }

  // 7. documents
  if (!db.objectStoreNames.contains('documents')) {
    const store = db.createObjectStore('documents', { keyPath: 'documentId' })
    store.createIndex('byType', 'type', { unique: false })
    store.createIndex('byHash', 'pdfHash', { unique: false })
    store.createIndex('byAccount', 'relatedAccount', { unique: false })
    store.createIndex('byCreatedAt', 'createdAt', { unique: false })
  }

  // 8. flight_logs
  if (!db.objectStoreNames.contains('flight_logs')) {
    const store = db.createObjectStore('flight_logs', { keyPath: 'flightLogId' })
    store.createIndex('byPilot', 'pilotAddress', { unique: false })
    store.createIndex('byDate', 'flight.date', { unique: false })
    store.createIndex('byAircraft', 'flight.aircraft.registration', { unique: false })
    store.createIndex('compound_pilot_date', ['pilotAddress', 'flight.date'], { unique: false })
  }

  // 9. medical_records
  if (!db.objectStoreNames.contains('medical_records')) {
    const store = db.createObjectStore('medical_records', { keyPath: 'recordId' })
    store.createIndex('byPatient', 'patientAddress', { unique: false })
    store.createIndex('byProvider', 'providerAddress', { unique: false })
    store.createIndex('byType', 'record.type', { unique: false })
    store.createIndex('byDate', 'record.date', { unique: false })
  }

  // 10. attestations
  if (!db.objectStoreNames.contains('attestations')) {
    const store = db.createObjectStore('attestations', { keyPath: 'attestationId' })
    store.createIndex('bySubject', 'subject', { unique: false })
    store.createIndex('byIssuer', 'issuer', { unique: false })
    store.createIndex('byType', 'credential.type', { unique: false })
    store.createIndex('byValid', 'valid', { unique: false })
    store.createIndex('byExpired', 'expired', { unique: false })
  }

  // 11. sync_queue
  if (!db.objectStoreNames.contains('sync_queue')) {
    const store = db.createObjectStore('sync_queue', { keyPath: 'id' })
    store.createIndex('byStatus', 'status', { unique: false })
    store.createIndex('byPriority', 'priority', { unique: false })
    store.createIndex('byCreatedAt', 'createdAt', { unique: false })
  }

  // 12. settings
  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' })
  }

  // 13. cache
  if (!db.objectStoreNames.contains('cache')) {
    const store = db.createObjectStore('cache', { keyPath: 'key' })
    store.createIndex('byExpiresAt', 'expiresAt', { unique: false })
    store.createIndex('byCategory', 'category', { unique: false })
  }

  // 14. webauthn_credentials
  if (!db.objectStoreNames.contains('webauthn_credentials')) {
    const store = db.createObjectStore('webauthn_credentials', { keyPath: 'id' })
    store.createIndex('byCreatedAt', 'createdAt', { unique: false })
  }
}
```

## Mejores Prácticas

### 1. **Separación de Datos Sensibles**
- ⚠️ **NUNCA** almacenar secretos en `accounts`
- Siempre usar `encrypted_secrets` para datos sensibles
- Validar encriptación antes de guardar

### 2. **Índices Compuestos**
- Usar índices compuestos para búsquedas frecuentes
- Ejemplo: `[accountAddress, chain]` para balances

### 3. **Limpieza de Cache**
- Implementar limpieza automática de cache expirado
- Usar el índice `byExpiresAt` para encontrar entradas expiradas

### 4. **Transacciones Atómicas**
- Agrupar operaciones relacionadas en una transacción
- Ejemplo: crear cuenta + guardar secreto encriptado

### 5. **Validación de Datos**
- Validar estructura antes de guardar
- Usar TypeScript interfaces para type safety

### 6. **Migraciones Incrementales**
- Siempre verificar `oldVersion` antes de migrar
- Migrar datos existentes cuando sea necesario
- No eliminar datos sin confirmación del usuario

## Capacidades Offline

Todos los object stores están diseñados para funcionar completamente offline:

✅ **Cuentas y Keyring**: Funcionan 100% offline
✅ **Transacciones**: Se guardan localmente, se sincronizan después
✅ **Documentos**: Se generan y almacenan localmente
✅ **Flight Logs**: Se crean offline, se sincronizan cuando hay conexión
✅ **Medical Records**: Se almacenan encriptados localmente
✅ **Attestations**: Se crean y verifican localmente

## Sincronización

La cola de sincronización (`sync_queue`) permite:
- Operaciones pendientes cuando no hay conexión
- Reintentos automáticos
- Priorización de operaciones
- Sincronización en background

## Seguridad

### Encriptación
- Secretos siempre encriptados (AES-GCM-256 mínimo)
- Claves derivadas con PBKDF2
- WebAuthn para protección adicional

### Validación
- Verificación de firmas en documentos
- Validación de hashes SHA-256
- Control de acceso en medical records

### Auditoría
- Timestamps en todas las operaciones
- Registro de última desencriptación
- Historial de cambios

## Conclusión

Esta estructura de base de datos proporciona:
- ✅ Funcionalidad completa de wallet
- ✅ Gestión de documentos y credenciales
- ✅ Funcionamiento 100% offline
- ✅ Sincronización opcional
- ✅ Seguridad robusta
- ✅ Escalabilidad para futuras features

