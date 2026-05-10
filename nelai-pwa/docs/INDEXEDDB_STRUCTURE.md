# Estructura de IndexedDB en PWA Substrate Explorer

## ¿Qué es IndexedDB?

**IndexedDB es una base de datos NoSQL (no relacional)** que funciona en el navegador. A diferencia de bases de datos relacionales como SQLite o PostgreSQL:

- **No relacional**: No usa tablas con relaciones (JOINs)
- **NoSQL**: Almacena objetos JavaScript directamente
- **Cliente-side**: Funciona completamente en el navegador
- **Asíncrona**: Todas las operaciones son asíncronas
- **Transaccional**: Soporta transacciones ACID
- **Indexada**: Permite crear índices para búsquedas rápidas

## Estructura Actual

### Base de Datos: `pwa-substrate-keyring`
- **Versión**: 1
- **Object Stores**: 1 (`encrypted-accounts`)

### Object Store: `encrypted-accounts`
- **Key Path**: `address` (clave primaria)
- **Estructura**:
```typescript
interface EncryptedAccount {
  address: string           // Clave primaria (SS58 address)
  encryptedData: string     // JSON encriptado con seed/mnemonic
  publicKey: string         // Public key en hex
  meta: {
    name?: string
    [key: string]: any      // Metadata adicional
  }
  createdAt: number         // Timestamp
}
```

## Propuesta de Estructura Mejorada

### Base de Datos: `pwa-substrate`
- **Versión**: 2 (incrementar para migración)
- **Object Stores**: Múltiples para mejor organización

### Object Stores Propuestos

#### 1. `accounts` - Cuentas del Keyring
```typescript
interface Account {
  address: string           // Clave primaria
  publicKey: string
  type: 'sr25519' | 'ed25519' | 'ecdsa'
  ethereumAddress?: string  // Dirección Ethereum derivada
  meta: {
    name?: string
    tags?: string[]
    notes?: string
    [key: string]: any
  }
  createdAt: number
  updatedAt: number
}
```
**Índices**:
- `byType` - Búsqueda por tipo de criptografía
- `byCreatedAt` - Ordenar por fecha de creación
- `byName` - Búsqueda por nombre

#### 2. `encrypted_secrets` - Secretos Encriptados
```typescript
interface EncryptedSecret {
  accountAddress: string   // Clave primaria (relación con accounts)
  encryptedData: string    // Seed/mnemonic encriptado
  encryptionMethod: string  // Método de encriptación usado
  createdAt: number
}
```

#### 3. `transactions` - Historial de Transacciones
```typescript
interface Transaction {
  id: string               // Clave primaria (hash de transacción)
  accountAddress: string   // Índice
  chain: string            // Índice
  hash: string
  blockNumber?: number
  status: 'pending' | 'finalized' | 'failed'
  from: string
  to?: string
  amount?: string
  fee?: string
  timestamp: number
  metadata?: {
    pallet?: string
    method?: string
    [key: string]: any
  }
}
```
**Índices**:
- `byAccount` - Transacciones por cuenta
- `byChain` - Transacciones por cadena
- `byTimestamp` - Ordenar por fecha
- `byStatus` - Filtrar por estado

#### 4. `settings` - Configuración de la Aplicación
```typescript
interface Setting {
  key: string              // Clave primaria
  value: any               // Valor (JSON serializable)
  updatedAt: number
}
```

#### 5. `cache` - Cache de Datos
```typescript
interface CacheEntry {
  key: string              // Clave primaria
  data: any                // Datos cacheados
  expiresAt: number        // Índice para limpieza automática
  createdAt: number
}
```
**Índices**:
- `byExpiresAt` - Para limpieza automática de cache expirado

## Ventajas de Esta Estructura

### 1. **Separación de Responsabilidades**
- Cuentas separadas de secretos encriptados
- Historial de transacciones independiente
- Configuración centralizada

### 2. **Búsquedas Eficientes**
- Índices permiten búsquedas rápidas
- Filtros por múltiples criterios
- Ordenamiento optimizado

### 3. **Escalabilidad**
- Fácil agregar nuevos object stores
- Migraciones controladas por versión
- Sin necesidad de backend

### 4. **Seguridad**
- Secretos encriptados en store separado
- Metadata pública en store diferente
- Control de acceso granular

## Migraciones de Schema

IndexedDB soporta migraciones mediante `onupgradeneeded`:

```typescript
request.onupgradeneeded = (event) => {
  const db = event.target.result
  const oldVersion = event.oldVersion
  const newVersion = event.newVersion

  // Migrar de versión 1 a 2
  if (oldVersion < 2) {
    // Crear nuevos object stores
    // Migrar datos existentes
    // Crear índices
  }
}
```

## Comparación: Relacional vs NoSQL

### Base de Datos Relacional (SQL)
```sql
CREATE TABLE accounts (
  address VARCHAR PRIMARY KEY,
  public_key VARCHAR,
  type VARCHAR,
  created_at TIMESTAMP
);

CREATE TABLE encrypted_secrets (
  account_address VARCHAR PRIMARY KEY,
  encrypted_data TEXT,
  FOREIGN KEY (account_address) REFERENCES accounts(address)
);
```

### IndexedDB (NoSQL)
```typescript
// Object Store: accounts
{ address: "5Grwva...", publicKey: "0x...", type: "sr25519" }

// Object Store: encrypted_secrets  
{ accountAddress: "5Grwva...", encryptedData: "..." }
```

**Diferencias clave**:
- **NoSQL**: Objetos anidados, sin JOINs explícitos
- **Relacional**: Tablas planas, JOINs para relaciones
- **NoSQL**: Más flexible, menos estructura
- **Relacional**: Más estructura, más validación

## Mejores Prácticas

### 1. **Usar Índices para Búsquedas Frecuentes**
```typescript
store.createIndex('byType', 'type', { unique: false })
```

### 2. **Validar Datos Antes de Guardar**
```typescript
function validateAccount(account: Account): boolean {
  return account.address && account.publicKey && account.type
}
```

### 3. **Manejar Errores de Transacciones**
```typescript
transaction.onerror = (event) => {
  console.error('Error en transacción:', event)
  // Rollback automático
}
```

### 4. **Limpiar Cache Expirado**
```typescript
async function cleanExpiredCache() {
  const index = store.index('byExpiresAt')
  const range = IDBKeyRange.upperBound(Date.now())
  // Eliminar entradas expiradas
}
```

## ¿Necesitamos un Backend?

**No necesariamente**. IndexedDB es suficiente para:

✅ Almacenamiento local de cuentas
✅ Cache de datos de blockchain
✅ Historial de transacciones
✅ Configuración de usuario
✅ Datos offline

**Un backend sería útil para**:

❌ Sincronización entre dispositivos
❌ Backup en la nube
❌ Análisis agregado de datos
❌ APIs compartidas entre usuarios
❌ Notificaciones push centralizadas

## Conclusión

IndexedDB es **NoSQL** y funciona perfectamente para una PWA. Podemos estructurar la información usando:

1. **Múltiples Object Stores** (como "tablas")
2. **Índices** (para búsquedas rápidas)
3. **Versiones de DB** (para migraciones de schema)
4. **Validación en código** (TypeScript interfaces)

No necesitamos un backend para la funcionalidad básica, pero podemos agregarlo más adelante para sincronización y features avanzadas.

