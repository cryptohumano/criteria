# Actualizaciones de PWA y Persistencia de Datos

## ¿Cómo Reciben Actualizaciones los Usuarios?

### Configuración Actual

Tu PWA está configurada con **actualización automática**:

```typescript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',  // ✅ Actualización automática
  // ...
})
```

### Flujo de Actualización

1. **Detección Automática**
   - El Service Worker verifica actualizaciones cada vez que se carga la app
   - Si hay una nueva versión, la descarga automáticamente

2. **Instalación en Segundo Plano**
   - El nuevo Service Worker se instala en segundo plano
   - **Los datos NO se pierden** porque están en IndexedDB (persistente)

3. **Activación Inmediata**
   - Con `skipWaiting()` y `clientsClaim()`, el nuevo SW se activa inmediatamente
   - La próxima vez que el usuario recargue, verá la nueva versión

## Persistencia de Datos

### ✅ Los Datos NO Se Pierden

**IndexedDB es persistente** y sobrevive a:
- Actualizaciones del Service Worker
- Actualizaciones de la aplicación
- Cierre del navegador
- Reinicio del dispositivo

### Datos Almacenados en IndexedDB

```typescript
// src/utils/indexedDB.ts
const requiredStores = [
  'encrypted-accounts',      // ✅ Cuentas cifradas
  'webauthn-credentials',    // ✅ Credenciales WebAuthn
  'transactions',            // ✅ Transacciones
  'documents',               // ✅ Documentos
  'mountain-logs',           // ✅ Bitácoras de montañismo
  'autographic-signatures', // ✅ Firmas autográficas
  // ...
]
```

**Todos estos datos persisten entre actualizaciones.**

## Migraciones de Esquema

### Sistema de Migraciones Automáticas

Cuando cambias el esquema de IndexedDB, las migraciones se ejecutan automáticamente:

```typescript
// src/utils/indexedDB.ts
const DB_VERSION = 8  // Incrementado cuando hay cambios

req.onupgradeneeded = (event) => {
  const oldVersion = event.oldVersion || 0
  const newVersion = event.newVersion || DB_VERSION
  
  // Migración automática según versión
  if (oldVersion < 8) {
    // Agregar nuevo store de firmas autográficas
    // Los datos existentes se preservan
  }
}
```

**Los datos existentes se preservan durante las migraciones.**

## Estrategias de Actualización

### Opción 1: Auto-Update (Actual - Recomendada)

**Ventajas:**
- ✅ Actualización automática sin intervención del usuario
- ✅ Los usuarios siempre tienen la última versión
- ✅ Datos preservados automáticamente

**Desventajas:**
- ⚠️ El usuario no tiene control sobre cuándo actualizar
- ⚠️ Puede haber cambios que requieran acción del usuario

### Opción 2: Prompt Update (Notificar al Usuario)

Si quieres notificar al usuario antes de actualizar:

```typescript
// src/main.tsx o componente de actualización
import { useRegisterSW } from 'virtual:pwa-register/react'

function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ', r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <>
      {(offlineReady || needRefresh) && (
        <div className="update-prompt">
          {offlineReady && (
            <span>App lista para trabajar offline</span>
          )}
          {needRefresh && (
            <span>
              Nueva versión disponible.
              <button onClick={() => updateServiceWorker(true)}>
                Actualizar
              </button>
            </span>
          )}
          <button onClick={() => close()}>Cerrar</button>
        </div>
      )}
    </>
  )
}
```

**Ventajas:**
- ✅ El usuario controla cuándo actualizar
- ✅ Puedes mostrar changelog o notas de versión

**Desventajas:**
- ⚠️ Requiere acción del usuario
- ⚠️ Algunos usuarios pueden no actualizar

## Mejores Prácticas

### 1. Versionado de Esquema

Siempre incrementa `DB_VERSION` cuando cambies el esquema:

```typescript
const DB_VERSION = 8  // Incrementar cuando agregues/modifiques stores
```

### 2. Migraciones Incrementales

Las migraciones deben ser incrementales y preservar datos:

```typescript
if (oldVersion < 8) {
  // Migrar de 7 a 8
  // Preservar todos los datos existentes
}
```

### 3. Backward Compatibility

Mantén compatibilidad hacia atrás cuando sea posible:

```typescript
// Si agregas un campo opcional, no rompe datos existentes
interface MountainLog {
  newField?: string  // ✅ Opcional, no rompe datos antiguos
}
```

### 4. Notificaciones de Cambios Importantes

Para cambios que requieren acción del usuario:

```typescript
// Verificar versión de la app
const currentVersion = localStorage.getItem('app-version')
const latestVersion = '1.2.0'

if (currentVersion !== latestVersion) {
  // Mostrar modal con cambios importantes
  showUpdateModal({
    version: latestVersion,
    changes: ['Nueva característica X', 'Mejora en Y'],
  })
  localStorage.setItem('app-version', latestVersion)
}
```

## Verificación de Actualización

### Verificar Manualmente

Los usuarios pueden verificar actualizaciones:

1. **Recargar la página** (Ctrl+R / Cmd+R)
2. **Cerrar y reabrir la app** (fuerza verificación de SW)
3. **Limpiar caché** (si hay problemas)

### Debugging de Actualizaciones

En DevTools:

1. **Application** → **Service Workers**
   - Ver estado del SW
   - Forzar actualización
   - Desregistrar SW

2. **Application** → **Storage** → **IndexedDB**
   - Verificar que los datos persisten
   - Verificar esquema actualizado

## Casos Especiales

### Actualización con Cambios Breaking

Si necesitas hacer cambios que rompen compatibilidad:

1. **Migración de Datos**
   ```typescript
   async function migrateData(oldData: OldFormat): Promise<NewFormat> {
     // Convertir datos antiguos a nuevo formato
     return {
       ...oldData,
       newField: calculateNewField(oldData),
     }
   }
   ```

2. **Notificación al Usuario**
   - Mostrar modal explicando cambios
   - Ofrecer opción de exportar datos antes de migrar

### Actualización Offline

Si el usuario está offline:
- El SW descarga la actualización cuando vuelva online
- Los datos se preservan mientras tanto

## Resumen

### ✅ Lo que SÍ se Preserva

- ✅ Todas las cuentas cifradas
- ✅ Todas las transacciones
- ✅ Todos los documentos
- ✅ Todas las bitácoras de montañismo
- ✅ Todas las firmas autográficas
- ✅ Configuraciones del usuario

### ⚠️ Lo que NO se Preserva

- ❌ Caché del Service Worker (se actualiza)
- ❌ Archivos estáticos en caché (se actualizan)
- ❌ Estado de la sesión en memoria (se reinicia)

### 🔄 Flujo de Actualización

1. Usuario abre la app
2. SW detecta nueva versión
3. SW descarga nueva versión en segundo plano
4. **Datos en IndexedDB se preservan**
5. SW se activa con `skipWaiting()`
6. Usuario recarga y ve nueva versión
7. **Todos los datos siguen ahí**

## Recomendación

**Mantén `autoUpdate`** para la mayoría de casos. Es la mejor experiencia de usuario y los datos siempre se preservan.

Solo cambia a `prompt` si necesitas:
- Mostrar changelog antes de actualizar
- Notificar cambios importantes que requieren acción
- Dar control explícito al usuario
