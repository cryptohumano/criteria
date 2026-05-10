# Capacidades Offline de una PWA

## ¿Puede una PWA ser completamente offline?

**Sí, absolutamente.** Una PWA puede funcionar como un cliente completamente offline y manejar todas las lógicas sin servidor. Esto es especialmente útil para aplicaciones como wallets, registros de vuelo, expedientes médicos, y sistemas de atestación de credenciales.

## Capacidades Técnicas de una PWA Offline

### 1. **Almacenamiento Local**

#### IndexedDB
- **Base de datos NoSQL** en el navegador
- **Capacidad**: Hasta varios GB (depende del navegador)
- **Uso**: Almacenar datos estructurados, cuentas encriptadas, credenciales, documentos
- **Ventajas**:
  - Transacciones ACID
  - Índices para búsquedas rápidas
  - Migraciones de schema
  - Persistencia entre sesiones

#### LocalStorage / SessionStorage
- **Capacidad**: ~5-10 MB
- **Uso**: Configuración, preferencias, tokens temporales
- **Limitación**: Solo strings (JSON.stringify/parse)

#### Cache API (Service Worker)
- **Capacidad**: Varios GB
- **Uso**: Almacenar assets estáticos, documentos PDF, imágenes
- **Estrategias**: NetworkFirst, CacheFirst, StaleWhileRevalidate

### 2. **Criptografía Completa en el Cliente**

#### Web Crypto API
- **Algoritmos disponibles**:
  - AES-GCM (encriptación simétrica)
  - RSA-OAEP (encriptación asimétrica)
  - ECDSA, Ed25519 (firmas digitales)
  - SHA-256, SHA-384, SHA-512 (hashing)
  - PBKDF2, HKDF (derivación de claves)
  - HMAC (autenticación de mensajes)

#### Polkadot.js Keyring
- **Tipos soportados**: sr25519, ed25519, ecdsa
- **Funciones**:
  - Generación de mnemonics
  - Creación de pares de claves
  - Firmas y verificación
  - Encriptación/desencriptación
  - Derivación de direcciones (SS58, Ethereum)

### 3. **Generación de Documentos**

#### PDF.js / jsPDF
- **Generación de PDFs** completamente en el cliente
- **Incluir**:
  - Texto formateado
  - Imágenes con metadata EXIF
  - Coordenadas GPS
  - Firmas digitales
  - Certificados X.509 (con bibliotecas adicionales)

#### Ejemplo de flujo:
```typescript
// 1. Capturar datos (GPS, timestamp, fotos)
const flightData = {
  pilot: account.address,
  timestamp: Date.now(),
  gps: await getGPS(),
  photos: await capturePhotos()
}

// 2. Generar PDF
const pdf = await generatePDF(flightData)

// 3. Calcular hash SHA-256
const hash = await crypto.subtle.digest('SHA-256', pdf)

// 4. Firmar con keyring
const signature = account.pair.sign(hash)

// 5. Agregar firma al PDF
const signedPDF = await addSignatureToPDF(pdf, signature)

// 6. Guardar en IndexedDB
await saveDocument(signedPDF, metadata)
```

### 4. **Firmas Digitales y Certificados**

#### X.509 Certificates
- **Bibliotecas**: `@peculiar/x509`, `node-forge` (polyfill)
- **Capacidades**:
  - Generar certificados autofirmados
  - Firmar documentos con certificados
  - Validar certificados
  - Crear cadenas de confianza

#### Ejemplo:
```typescript
import { X509Certificate } from '@peculiar/x509'

// Generar certificado desde keyring
const cert = await generateCertificate({
  subject: 'CN=Piloto Juan Pérez',
  issuer: account.address,
  publicKey: account.pair.publicKey,
  validity: { notBefore: new Date(), notAfter: new Date(Date.now() + 365*24*60*60*1000) }
})

// Firmar documento
const signedDoc = await signDocument(pdf, cert, account.pair)
```

### 5. **APIs y Sincronización**

#### Service Worker como Proxy
- **Interceptar requests** y responder desde cache
- **Sincronización en background** cuando hay conexión
- **Cola de operaciones** para enviar cuando vuelva la conexión

#### Ejemplo de sincronización:
```typescript
// Guardar operación localmente
await saveOperation({
  type: 'upload_document',
  document: signedPDF,
  timestamp: Date.now(),
  status: 'pending'
})

// Intentar enviar
try {
  await fetch('/api/documents', {
    method: 'POST',
    body: signedPDF
  })
  await markOperationAsSent(operationId)
} catch {
  // Guardar para sincronizar después
  await queueForSync(operationId)
}
```

### 6. **Casos de Uso Específicos**

#### A. Wallet de Criptomonedas
- ✅ **Completamente offline**
- ✅ Generación de cuentas
- ✅ Firmas de transacciones
- ✅ Gestión de claves privadas
- ⚠️ **Requiere conexión** solo para:
  - Consultar balances (RPC)
  - Enviar transacciones (RPC)

#### B. Registro de Horas de Vuelo
- ✅ Captura de datos offline
- ✅ GPS y metadata
- ✅ Generación de PDFs
- ✅ Firmas digitales
- ✅ Almacenamiento local
- ⚠️ **Sincronización** cuando hay conexión

#### C. Expedientes Médicos
- ✅ Creación y edición offline
- ✅ Encriptación de datos sensibles
- ✅ Firmas de documentos
- ✅ Almacenamiento seguro local
- ⚠️ **Sincronización** con servidor cuando hay conexión

#### D. Atestación de Credenciales
- ✅ Generación de credenciales verificables
- ✅ Firmas criptográficas
- ✅ Almacenamiento local
- ✅ Validación offline
- ⚠️ **Publicación** en blockchain cuando hay conexión

## Arquitectura Recomendada

### Patrón: "Offline-First"

```
┌─────────────────────────────────────┐
│         PWA (Cliente)                │
│  ┌───────────────────────────────┐   │
│  │   Service Worker              │   │
│  │   - Cache API                 │   │
│  │   - Background Sync          │   │
│  └───────────────────────────────┘   │
│  ┌───────────────────────────────┐   │
│  │   IndexedDB                    │   │
│  │   - Cuentas encriptadas        │   │
│  │   - Documentos firmados        │   │
│  │   - Cola de sincronización     │   │
│  └───────────────────────────────┘   │
│  ┌───────────────────────────────┐   │
│  │   Web Crypto API               │   │
│  │   - Encriptación               │   │
│  │   - Firmas                     │   │
│  │   - Hashing                    │   │
│  └───────────────────────────────┘   │
│  ┌───────────────────────────────┐   │
│  │   Keyring                     │   │
│  │   - Gestión de claves         │   │
│  │   - Firmas de transacciones   │   │
│  └───────────────────────────────┘   │
└─────────────────────────────────────┘
           ↕ (cuando hay conexión)
┌─────────────────────────────────────┐
│         Servidor/API                 │
│   - Validación                       │
│   - Almacenamiento centralizado      │
│   - Sincronización                   │
└─────────────────────────────────────┘
```

## Limitaciones y Consideraciones

### Limitaciones Técnicas

1. **Tamaño de almacenamiento**:
   - IndexedDB: ~50% del espacio en disco (navegador dependiente)
   - Chrome: ~60% del disco disponible
   - Firefox: ~50% del disco disponible
   - Safari: Límites más restrictivos

2. **Procesamiento**:
   - JavaScript es single-threaded
   - Operaciones pesadas pueden bloquear la UI
   - **Solución**: Web Workers para procesamiento pesado

3. **Seguridad**:
   - Las claves privadas están en el navegador
   - Vulnerable a XSS si no se maneja correctamente
   - **Solución**: Content Security Policy (CSP), sanitización

### Mejores Prácticas

1. **Encriptación**:
   - Siempre encriptar datos sensibles antes de guardar
   - Usar claves derivadas de contraseña o WebAuthn
   - Nunca almacenar claves privadas en texto plano

2. **Sincronización**:
   - Implementar cola de operaciones
   - Usar timestamps para resolución de conflictos
   - Validar datos antes de sincronizar

3. **Respaldo**:
   - Permitir exportar datos encriptados
   - Generar backups automáticos
   - Opción de restaurar desde backup

## Ejemplo: Sistema de Registro de Vuelo

```typescript
// 1. Capturar datos offline
const flightLog = {
  pilot: account.address,
  date: new Date(),
  duration: 2.5, // horas
  gps: {
    start: { lat: 19.4326, lon: -99.1332 },
    end: { lat: 20.6597, lon: -103.3496 }
  },
  photos: [
    { data: photo1, metadata: exif1 },
    { data: photo2, metadata: exif2 }
  ]
}

// 2. Generar PDF con metadata
const pdf = await generateFlightLogPDF(flightLog)

// 3. Calcular hash
const hash = await crypto.subtle.digest('SHA-256', pdf)

// 4. Firmar con keyring
const signature = account.pair.sign(new Uint8Array(hash))

// 5. Crear documento firmado
const signedDocument = {
  pdf: arrayBufferToBase64(pdf),
  signature: u8aToHex(signature),
  signer: account.address,
  timestamp: Date.now(),
  hash: u8aToHex(new Uint8Array(hash))
}

// 6. Guardar localmente
await saveToIndexedDB('flight-logs', signedDocument)

// 7. Sincronizar cuando haya conexión
await queueForSync('flight-logs', signedDocument.id)
```

## Conclusión

**Sí, una PWA puede ser completamente offline** y manejar:
- ✅ Gestión de claves y criptografía
- ✅ Generación y firma de documentos
- ✅ Almacenamiento seguro de datos
- ✅ Procesamiento de datos complejos
- ✅ Sincronización cuando hay conexión

**Requiere conexión solo para**:
- Consultar datos externos (blockchain, APIs)
- Sincronizar con servidor
- Publicar transacciones

La arquitectura "Offline-First" es perfecta para aplicaciones que necesitan funcionar en áreas sin conexión constante, como aviación, medicina, o cualquier aplicación que requiera privacidad y control de datos.

