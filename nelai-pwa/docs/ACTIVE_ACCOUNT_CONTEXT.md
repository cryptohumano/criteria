# Contexto de Cuenta Activa

## Visión General

El sistema de **Cuenta Activa** permite aislar la lógica y datos por cuenta en la sesión. Cada cuenta puede tener sus propias propiedades y datos asociados.

## ¿Por qué es necesario?

Cuando una wallet maneja múltiples cuentas, cada una debería tener:
- Su propia lógica de propiedades
- Datos aislados (transacciones, documentos, bitácoras)
- Preferencias y configuraciones específicas
- Una sesión activa clara

## Arquitectura

### 1. ActiveAccountContext

El contexto `ActiveAccountContext` mantiene:
- **`activeAccount`**: Dirección de la cuenta activa (string | null)
- **`activeAccountData`**: Datos completos de la cuenta activa
- **`setActiveAccount`**: Función para cambiar la cuenta activa
- **`switchAccount`**: Alias para cambiar cuenta
- **`clearActiveAccount`**: Limpiar cuenta activa

### 2. Persistencia

La cuenta activa se guarda en `localStorage` con la clave `aura-wallet-active-account`, por lo que:
- Se mantiene entre recargas de página
- Se restaura automáticamente al iniciar la aplicación
- Se valida que la cuenta aún exista al cargar

### 3. Integración

El `ActiveAccountProvider` está integrado en `main.tsx` y envuelve toda la aplicación:

```tsx
<KeyringProvider>
  <ActiveAccountProvider>
    <NetworkProvider>
      {/* App */}
    </NetworkProvider>
  </ActiveAccountProvider>
</KeyringProvider>
```

## Uso en Componentes

### Hook básico

```tsx
import { useActiveAccount } from '@/contexts/ActiveAccountContext'

function MyComponent() {
  const { activeAccount, activeAccountData, switchAccount } = useActiveAccount()
  
  // activeAccount es la dirección (string | null)
  // activeAccountData contiene todos los datos de la cuenta
  // switchAccount permite cambiar la cuenta activa
}
```

### Ejemplo: Filtrar datos por cuenta activa

```tsx
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { getTransactionsByAccount } from '@/utils/transactionStorage'

function TransactionsList() {
  const { activeAccount } = useActiveAccount()
  const [transactions, setTransactions] = useState([])
  
  useEffect(() => {
    if (activeAccount) {
      // Cargar solo transacciones de la cuenta activa
      getTransactionsByAccount(activeAccount).then(setTransactions)
    }
  }, [activeAccount])
  
  return (
    <div>
      {transactions.map(tx => (
        <TransactionItem key={tx.id} transaction={tx} />
      ))}
    </div>
  )
}
```

### Ejemplo: Usar cuenta activa como default

```tsx
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { useKeyringContext } from '@/contexts/KeyringContext'

function DocumentEditor() {
  const { activeAccount } = useActiveAccount()
  const { accounts } = useKeyringContext()
  const [selectedAccount, setSelectedAccount] = useState('')
  
  // Usar cuenta activa como default
  useEffect(() => {
    if (activeAccount) {
      setSelectedAccount(activeAccount)
    } else if (accounts.length > 0) {
      setSelectedAccount(accounts[0].address)
    }
  }, [activeAccount, accounts])
  
  // ...
}
```

### Ejemplo: Crear documento con cuenta activa

```tsx
import { useActiveAccount } from '@/contexts/ActiveAccountContext'

function CreateDocument() {
  const { activeAccount, activeAccountData } = useActiveAccount()
  
  const handleCreate = async () => {
    if (!activeAccount) {
      toast.error('No hay cuenta activa')
      return
    }
    
    const document = await createDocument({
      // ... otros datos
      relatedAccount: activeAccount, // Usar cuenta activa
      author: activeAccountData?.meta.name || 'Sin nombre',
    })
  }
}
```

## Componente ActiveAccountSwitcher

El componente `ActiveAccountSwitcher` se muestra en el header y permite:
- Ver la cuenta activa actual
- Cambiar entre cuentas disponibles
- Ver todas las cuentas con sus nombres e identificadores

### Ubicación

El switcher está integrado en `Header.tsx` y se muestra:
- En desktop: En el header principal
- En mobile: Puede agregarse al BottomNav si es necesario

## Aislamiento de Datos

### Datos ya aislados por cuenta

Los siguientes datos ya están aislados por cuenta en IndexedDB:

1. **Transacciones** (`transactions`)
   - Índice: `byAccount`
   - Función: `getTransactionsByAccount(accountAddress)`

2. **Documentos** (`documents`)
   - Índice: `byAccount`
   - Función: `getDocumentsByAccount(accountAddress)`

3. **Bitácoras** (`mountain-logs`)
   - Índice: `byAccount`
   - Función: `getMountainLogsByAccount(accountAddress)`

4. **Emergencias** (`emergencies`)
   - Campo: `reporterAccount`
   - Función: `getEmergenciesByAccount(accountAddress)`

### Usar cuenta activa para filtrar

```tsx
// En lugar de cargar todos los datos
const allDocs = await getAllDocuments()

// Cargar solo datos de la cuenta activa
const { activeAccount } = useActiveAccount()
if (activeAccount) {
  const accountDocs = await getDocumentsByAccount(activeAccount)
}
```

## Propiedades por Cuenta

Cada cuenta puede tener sus propias propiedades. Ejemplos:

### 1. Preferencias de UI

```tsx
interface AccountPreferences {
  accountAddress: string
  theme?: 'light' | 'dark'
  language?: string
  defaultChain?: string
  // ...
}
```

### 2. Configuración de Notificaciones

```tsx
interface AccountNotifications {
  accountAddress: string
  emailNotifications?: boolean
  pushNotifications?: boolean
  // ...
}
```

### 3. Metadata Personalizada

Ya existe en `KeyringAccount.meta`, pero puede extenderse:

```tsx
const account = activeAccountData
if (account) {
  // Metadata personalizada
  const customSettings = account.meta.customSettings || {}
  const preferences = account.meta.preferences || {}
}
```

## Mejores Prácticas

### 1. Siempre verificar cuenta activa

```tsx
const { activeAccount } = useActiveAccount()

if (!activeAccount) {
  return <div>Selecciona una cuenta</div>
}
```

### 2. Usar cuenta activa como default

```tsx
// ✅ Correcto: Usar cuenta activa como default
const defaultAccount = activeAccount || accounts[0]?.address

// ❌ Incorrecto: Siempre usar primera cuenta
const defaultAccount = accounts[0]?.address
```

### 3. Filtrar datos por cuenta activa

```tsx
// ✅ Correcto: Filtrar por cuenta activa
useEffect(() => {
  if (activeAccount) {
    loadAccountData(activeAccount)
  }
}, [activeAccount])

// ❌ Incorrecto: Cargar todos los datos
useEffect(() => {
  loadAllData()
}, [])
```

### 4. Actualizar cuenta activa al cambiar

```tsx
// Cuando el usuario cambia de cuenta en un selector local
const handleAccountChange = (newAccount: string) => {
  setLocalAccount(newAccount)
  switchAccount(newAccount) // Actualizar cuenta activa global
}
```

## Migración de Componentes Existentes

Para migrar componentes que usan `selectedAccount` local:

### Antes

```tsx
const [selectedAccount, setSelectedAccount] = useState('')

useEffect(() => {
  if (accounts.length > 0) {
    setSelectedAccount(accounts[0].address)
  }
}, [accounts])
```

### Después

```tsx
const { activeAccount, switchAccount } = useActiveAccount()

// Usar activeAccount directamente
// O sincronizar con cuenta activa:
useEffect(() => {
  if (activeAccount) {
    setLocalAccount(activeAccount)
  }
}, [activeAccount])
```

## Preguntas Frecuentes

### ¿Qué pasa si elimino la cuenta activa?

El sistema automáticamente:
1. Detecta que la cuenta ya no existe
2. Selecciona la primera cuenta disponible
3. Actualiza localStorage

### ¿Puedo tener múltiples cuentas activas?

No, solo hay una cuenta activa por sesión. Esto permite un aislamiento claro de datos y propiedades.

### ¿Cómo cambio la cuenta activa programáticamente?

```tsx
const { switchAccount } = useActiveAccount()
switchAccount('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY')
```

### ¿La cuenta activa persiste entre sesiones?

Sí, se guarda en `localStorage` y se restaura automáticamente al iniciar la aplicación.

## Conclusión

El sistema de cuenta activa proporciona:
- ✅ Aislamiento claro de datos por cuenta
- ✅ Sesión activa persistente
- ✅ Propiedades específicas por cuenta
- ✅ Mejor UX al trabajar con múltiples cuentas
