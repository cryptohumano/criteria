# Flujo de Keyring y Encrypted Accounts

## Flujo Actual

### 1. Inicialización del Keyring

```
useEffect (useKeyring.ts:71)
  ↓
cryptoWaitReady()
  ↓
new Keyring({ ss58Format: 42 })
  ↓
setKeyring(keyring)
setIsReady(true)
```

### 2. Desbloqueo con Contraseña

```
unlock(password)
  ↓
getAllEncryptedAccounts() // Desde IndexedDB
  ↓
decrypt(encryptedData, password) // Para cada cuenta
  ↓
JSON.parse(decryptedData) // { uri, mnemonic, type }
  ↓
keyring.addFromUri(seed, meta, type) // Agregar al keyring
  ↓
setAccounts(loadedAccounts) // Actualizar estado React
setIsUnlocked(true)
```

### 3. Desbloqueo con WebAuthn

```
unlockWithWebAuthn(credentialId)
  ↓
getAllEncryptedAccounts() // Desde IndexedDB
  ↓
authenticateWithWebAuthn(credentialId) // Verificar identidad
  ↓
deriveKeyFromWebAuthn() // Derivar clave maestra
  ↓
decryptWithKey(encryptedData, masterKey) // Desencriptar
  ↓
keyring.addFromUri(seed, meta, type) // Agregar al keyring
  ↓
setAccounts(loadedAccounts)
setIsUnlocked(true)
```

### 4. Agregar Nueva Cuenta

```
addFromMnemonic(mnemonic, name, type, password)
  ↓
keyring.addFromUri(mnemonic, { name }, type) // Agregar al keyring
  ↓
setAccounts([...prev, account]) // Actualizar estado React
  ↓
if (password) {
  encrypt(JSON.stringify({ mnemonic, uri: null, type }), password)
  ↓
  saveEncryptedAccount({ address, encryptedData, ... }) // Guardar en IndexedDB
  ↓
  setHasStoredAccounts(true)
}
```

### 5. Bloquear Keyring

```
lock()
  ↓
accounts.forEach(acc => keyring.removePair(acc.address)) // Remover del keyring
  ↓
setAccounts([]) // Limpiar estado React
setIsUnlocked(false)
```

## Problemas Identificados

### Problema 1: Cuentas sin contraseña no se guardan

**Situación**: Si se agrega una cuenta sin proporcionar contraseña, la cuenta se agrega al keyring pero NO se guarda en IndexedDB.

**Consecuencia**: Al bloquear y desbloquear el keyring, esas cuentas se pierden.

**Solución**: Siempre guardar en IndexedDB, incluso sin contraseña (usar una clave derivada del usuario o WebAuthn).

### Problema 2: Sincronización entre Keyring y Estado React

**Situación**: El keyring de Polkadot mantiene su propio estado interno, pero también mantenemos un estado React (`accounts`).

**Consecuencia**: Puede haber desincronización si se modifica el keyring directamente.

**Solución**: Siempre usar las funciones del hook (`addFromMnemonic`, `addFromUri`, `removeAccount`) en lugar de modificar el keyring directamente.

### Problema 3: Verificación de cuentas al desbloquear

**Situación**: Al desbloquear, se cargan todas las cuentas desde IndexedDB, pero no se verifica que todas se hayan cargado correctamente.

**Consecuencia**: Si una cuenta falla al cargarse, se silencia el error y continúa con las demás.

**Solución**: Mostrar un resumen de cuentas cargadas vs. cuentas fallidas.

## Flujo Correcto Recomendado

### 1. Agregar Cuenta (Siempre guardar)

```typescript
const addFromMnemonic = async (mnemonic, name, type, password) => {
  // 1. Agregar al keyring
  const pair = keyring.addFromUri(mnemonic, { name }, type)
  
  // 2. Actualizar estado React
  setAccounts([...prev, account])
  
  // 3. SIEMPRE guardar en IndexedDB
  if (password) {
    // Encriptar con contraseña
    const encryptedData = await encrypt(JSON.stringify({ mnemonic, uri: null, type }), password)
  } else {
    // Si no hay contraseña, usar clave maestra de WebAuthn o derivar una
    // O requerir que siempre haya contraseña
    throw new Error('Se requiere contraseña para guardar la cuenta')
  }
  
  // 4. Guardar en IndexedDB
  await saveEncryptedAccount({ address, encryptedData, ... })
  
  // 5. Actualizar estado
  setHasStoredAccounts(true)
}
```

### 2. Desbloquear (Verificar todas las cuentas)

```typescript
const unlock = async (password) => {
  const encryptedAccounts = await getAllEncryptedAccounts()
  
  const results = {
    loaded: [],
    failed: []
  }
  
  for (const encAccount of encryptedAccounts) {
    try {
      const decryptedData = await decrypt(encAccount.encryptedData, password)
      const { uri, mnemonic, type } = JSON.parse(decryptedData)
      const seed = uri || mnemonic
      
      const pair = keyring.addFromUri(seed, encAccount.meta, type)
      results.loaded.push({ address: pair.address, pair })
    } catch (error) {
      results.failed.push({ address: encAccount.address, error })
    }
  }
  
  // Mostrar resumen
  console.log(`✅ ${results.loaded.length} cargadas, ❌ ${results.failed.length} fallidas`)
  
  if (results.failed.length > 0) {
    // Notificar al usuario sobre cuentas que no se pudieron cargar
    console.warn('Cuentas que no se pudieron cargar:', results.failed)
  }
  
  setAccounts(results.loaded)
  setIsUnlocked(true)
}
```

### 3. Sincronización Keyring ↔ Estado React

```typescript
// Función para sincronizar estado React con keyring
const syncKeyringState = useCallback(() => {
  if (!keyring) return
  
  const keyringPairs = keyring.getPairs()
  const reactAccounts = accounts
  
  // Verificar que todas las cuentas de React estén en el keyring
  const missingInKeyring = reactAccounts.filter(
    acc => !keyringPairs.find(p => p.address === acc.address)
  )
  
  // Verificar que todas las cuentas del keyring estén en React
  const missingInReact = keyringPairs.filter(
    pair => !reactAccounts.find(acc => acc.address === pair.address)
  )
  
  if (missingInKeyring.length > 0 || missingInReact.length > 0) {
    console.warn('⚠️ Desincronización detectada:', { missingInKeyring, missingInReact })
    // Re-sincronizar
    const syncedAccounts = keyringPairs.map(pair => ({
      pair,
      address: pair.address,
      publicKey: pair.publicKey,
      meta: pair.meta
    }))
    setAccounts(syncedAccounts)
  }
}, [keyring, accounts])
```

## Checklist de Verificación

- [ ] ¿Las cuentas se guardan en IndexedDB al crearlas?
- [ ] ¿Las cuentas se cargan del keyring al desbloquear?
- [ ] ¿El estado React está sincronizado con el keyring?
- [ ] ¿Se manejan errores al cargar cuentas?
- [ ] ¿Se notifica al usuario sobre cuentas que no se pudieron cargar?
- [ ] ¿Las cuentas sin contraseña se manejan correctamente?

## Debugging

### Verificar estado del keyring

```typescript
console.log('Keyring pairs:', keyring.getPairs().map(p => ({
  address: p.address,
  type: p.type,
  meta: p.meta
})))

console.log('React accounts:', accounts.map(a => ({
  address: a.address,
  type: a.pair.type,
  meta: a.meta
})))

console.log('IndexedDB accounts:', await getAllEncryptedAccounts())
```

### Verificar sincronización

```typescript
const keyringAddresses = keyring.getPairs().map(p => p.address)
const reactAddresses = accounts.map(a => a.address)
const indexedDBAddresses = (await getAllEncryptedAccounts()).map(a => a.address)

console.log('Keyring:', keyringAddresses)
console.log('React:', reactAddresses)
console.log('IndexedDB:', indexedDBAddresses)

// Deben coincidir (excepto cuentas sin guardar)
```

