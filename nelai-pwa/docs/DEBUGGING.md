# Guía de Debugging: Keyring e IndexedDB

## Dónde Ver los Logs

### 1. Consola del Navegador (F12)

**Pasos:**
1. Abre la aplicación en el navegador
2. Presiona `F12` (o clic derecho → "Inspeccionar")
3. Ve a la pestaña **"Console"**
4. Recarga la página (`Ctrl+R` o `F5`)

**Logs que verás:**
- `[Keyring]` - Logs del keyring
- `[IndexedDB]` - Logs de IndexedDB

### 2. Logs Esperados al Iniciar

**Inicialización exitosa:**
```
[Keyring] Iniciando inicialización...
[Keyring] Esperando cryptoWaitReady()...
[Keyring] cryptoWaitReady() completado
[Keyring] Keyring creado exitosamente
[Keyring] Verificando cuentas almacenadas en IndexedDB...
[IndexedDB] Abriendo base de datos: pwa-substrate-keyring (versión 1)
[IndexedDB] ✅ Base de datos abierta exitosamente
[IndexedDB] ✅ 0 cuenta(s) encontrada(s)
[Keyring] ✅ Inicialización completada
```

**Si hay errores:**
- `[Keyring] ❌` - Errores del keyring
- `[IndexedDB] ❌` - Errores de IndexedDB

### 3. Verificar IndexedDB Manualmente

**En Chrome/Edge:**
1. F12 → Pestaña "Application"
2. En el menú lateral: "Storage" → "IndexedDB"
3. Busca `pwa-substrate-keyring`
4. Dentro: `encrypted-accounts`

**En Firefox:**
1. F12 → Pestaña "Storage"
2. "IndexedDB" → `pwa-substrate-keyring`
3. Dentro: `encrypted-accounts`

### 4. Comandos Útiles en la Consola

Ejecuta estos comandos en la consola del navegador (F12 → Console):

```javascript
// Verificar si IndexedDB está disponible
console.log('IndexedDB disponible:', 'indexedDB' in window)

// Verificar si Web Crypto está disponible
console.log('Web Crypto disponible:', 'crypto' in window && 'subtle' in crypto)

// Abrir IndexedDB manualmente
const request = indexedDB.open('pwa-substrate-keyring', 1)
request.onsuccess = () => console.log('✅ IndexedDB funciona')
request.onerror = () => console.error('❌ IndexedDB error:', request.error)

// Ver todas las cuentas almacenadas
indexedDB.open('pwa-substrate-keyring', 1).onsuccess = (e) => {
  const db = e.target.result
  const tx = db.transaction('encrypted-accounts', 'readonly')
  const store = tx.objectStore('encrypted-accounts')
  store.getAll().onsuccess = (e) => {
    console.log('Cuentas almacenadas:', e.target.result)
  }
}
```

## Problemas Comunes

### Error: "IndexedDB no está disponible"

**Causas:**
- Navegador en modo incógnito (algunos navegadores bloquean IndexedDB)
- Navegador muy antiguo
- Configuración del navegador bloquea IndexedDB

**Solución:**
- Usa una ventana normal (no incógnito)
- Actualiza el navegador
- Verifica la configuración de privacidad del navegador

### Error: "ERR_EMPTY_RESPONSE"

**Causa:** El servidor no está respondiendo

**Solución:**
1. Verifica que el servidor esté corriendo:
   ```bash
   lsof -i :5173
   ```

2. Si no está corriendo, inícialo:
   ```bash
   yarn dev
   ```

3. Si está corriendo pero no responde, reinícialo:
   ```bash
   # Detener el proceso
   kill $(lsof -t -i:5173)
   # Reiniciar
   yarn dev
   ```

### Error: "Keyring no se inicia"

**Causas:**
- `cryptoWaitReady()` no completa
- Error en la inicialización de @polkadot/util-crypto

**Solución:**
1. Abre la consola del navegador (F12)
2. Busca errores con `[Keyring] ❌`
3. Verifica que Web Crypto API esté disponible
4. Recarga la página

### IndexedDB está bloqueado

**Causa:** Otra pestaña está usando la base de datos

**Solución:**
- Cierra otras pestañas que usen la aplicación
- O espera unos segundos y vuelve a intentar

## Verificar que Todo Funciona

### Test 1: IndexedDB
```javascript
// En la consola del navegador
const test = indexedDB.open('test-db', 1)
test.onsuccess = () => {
  console.log('✅ IndexedDB funciona')
  indexedDB.deleteDatabase('test-db')
}
test.onerror = () => console.error('❌ IndexedDB no funciona')
```

### Test 2: Web Crypto API
```javascript
// En la consola del navegador
if ('crypto' in window && 'subtle' in crypto) {
  console.log('✅ Web Crypto API disponible')
} else {
  console.error('❌ Web Crypto API no disponible')
}
```

### Test 3: Keyring
Revisa los logs en la consola. Deberías ver:
- `[Keyring] ✅ Inicialización completada`

## Recopilar Información para Debugging

Si el problema persiste, ejecuta esto en la consola del navegador y comparte el resultado:

```javascript
const info = {
  indexedDB: 'indexedDB' in window,
  webCrypto: 'crypto' in window && 'subtle' in crypto,
  userAgent: navigator.userAgent,
  protocol: window.location.protocol,
  host: window.location.host,
  errors: []
}

// Intentar abrir IndexedDB
try {
  const req = indexedDB.open('pwa-substrate-keyring', 1)
  req.onsuccess = () => info.indexedDBWorks = true
  req.onerror = () => {
    info.indexedDBWorks = false
    info.errors.push('IndexedDB error: ' + req.error)
  }
} catch (e) {
  info.errors.push('IndexedDB exception: ' + e.message)
}

console.log('Información del sistema:', info)
```

