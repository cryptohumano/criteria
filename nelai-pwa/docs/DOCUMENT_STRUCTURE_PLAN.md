# Plan de Implementación: Estructura de Documentos

## Resumen Ejecutivo

Este documento planifica la implementación del sistema de gestión de documentos para Aura Wallet, incluyendo:
- Generación de PDFs con metadata GPS/EXIF
- Firmas digitales individuales y en batch
- Verificación individual y en batch
- Encriptación con AES-GCM-256
- Integración con APIs externas para recibir/enviar documentos
- Soporte para contratos y documentos genéricos
- Almacenamiento seguro en IndexedDB

## Scope y Requisitos

### Casos de Uso Principales

1. **Registro de Horas de Vuelo (Flight Logs)**
   - Generar PDF con metadata GPS
   - Incluir fotos con EXIF
   - Firmar digitalmente con keyring
   - Encriptar para almacenamiento seguro

2. **Expedientes Médicos (Medical Records)**
   - Generar PDFs de registros médicos
   - Encriptación obligatoria (HIPAA-like)
   - Control de acceso por direcciones
   - Firmas de proveedores médicos

3. **Atestaciones de Credenciales**
   - Credenciales verificables (W3C VC)
   - Pruebas criptográficas (Ed25519/sr25519)
   - Vinculación con documentos de respaldo

4. **Firmas de Contratos**
   - Documentos legales y contractuales
   - Firmas múltiples (múltiples firmantes)
   - Firmas en batch (múltiples documentos)
   - Verificación en batch
   - Historial de firmas y versiones
   - Notificaciones de cambios

5. **Documentos Genéricos/Misceláneos**
   - Cualquier tipo de documento PDF
   - Firmas opcionales
   - Encriptación opcional
   - Metadata personalizada
   - Categorización flexible

6. **Integración con API Externa**
   - Recibir PDFs desde API externa para firmar
   - Webhook para notificar firmas completadas
   - Cola de documentos pendientes de firma
   - Sincronización bidireccional
   - Autenticación con API externa

## Primitivos Criptográficos

### 1. Hashing
- **SHA-256**: Para integridad de documentos
  - Calcular hash del PDF antes y después de firmas
  - Verificar integridad al desencriptar
  - Usar para identificación única de documentos

### 2. Encriptación
- **AES-GCM-256**: Encriptación simétrica
  - Para documentos sensibles (medical records)
  - Derivación de clave con PBKDF2
  - IV aleatorio por documento
  - Autenticación integrada (GCM)

### 3. Firmas Digitales
- **Ed25519/sr25519**: Firmas con keyring
  - Firmar hash SHA-256 del documento
  - Incluir timestamp y metadata
  - Verificación offline
  - Firma criptográfica segura
- **X.509**: Certificados digitales
  - Firmas PDF estándar (compatible con Adobe Reader)
  - Certificados PKCS#12 (.p12) o PEM
  - Legalmente reconocida en muchos países
  - Verificación con cadena de confianza
- **Firma Autográfica**: Firma manuscrita
  - Captura con canvas (touch/mouse)
  - Incrustada como imagen en PDF
  - Visualmente reconocible
  - Puede combinarse con firma digital
- **Firma Híbrida**: Combinación de tipos
  - Autográfica (visual) + Digital (criptográfica)
  - Máxima seguridad y reconocimiento

### 4. Derivación de Claves
- **PBKDF2**: Para derivar claves de encriptación
  - Iteraciones: 100,000 (recomendado)
  - Salt único por documento
  - Derivar desde contraseña o clave maestra

## Estructura de Datos

### 1. Document (IndexedDB Object Store)

```typescript
interface Document {
  // Identificación
  documentId: string                    // UUID (clave primaria)
  
  // Tipo y clasificación
  type: 'flight_log' | 'medical_record' | 'attestation' | 'contract' | 'generic' | 'other'
  category?: string                     // Categoría adicional
  subcategory?: string                  // Subcategoría (ej: "employment_contract", "nda", "invoice")
  
  // Contenido del PDF
  pdf?: string                          // PDF en base64 (opcional - puede estar solo en cache)
  pdfHash: string                       // Hash SHA-256 del PDF original
  pdfSize: number                       // Tamaño en bytes
  
  // Versiones del documento
  versions?: {                          // Historial de versiones
    version: number
    pdfHash: string
    pdf?: string
    createdAt: number
    changes?: string                    // Descripción de cambios
  }[]
  
  // Firmas Digitales
  signatures: DocumentSignature[]       // Array de firmas
  
  // Encriptación
  encrypted: boolean                    // Si está encriptado
  encryptionMethod?: 'AES-GCM-256' | 'AES-GCM-128'
  encryptionKeyId?: string               // ID de la clave (referencia a clave derivada)
  encryptionMetadata?: {
    iv: string                          // Initialization Vector (hex)
    salt: string                        // Salt usado (hex)
    iterations: number                  // Iteraciones PBKDF2
    keyDerivationMethod: 'PBKDF2' | 'HKDF'
  }
  
  // Metadata del Documento
  metadata: {
    title?: string
    description?: string
    author?: string                      // Dirección del creador
    subject?: string
    keywords?: string[]
    language?: string
    creator?: string                     // Aplicación que creó el documento
    producer?: string                    // Biblioteca PDF usada
    createdAt: string                   // ISO 8601
    modifiedAt?: string                 // ISO 8601
    [key: string]: any                  // Metadata adicional flexible
  }
  
  // Metadata GPS (si aplica)
  gpsMetadata?: {
    latitude: number
    longitude: number
    altitude?: number
    accuracy?: number
    timestamp: number
  }
  
  // Relaciones
  relatedAccount?: string               // Cuenta que creó el documento
  relatedFlightLogId?: string          // ID de flight log relacionado
  relatedMedicalRecordId?: string       // ID de medical record relacionado
  relatedAttestationId?: string        // ID de attestation relacionado
  relatedContractId?: string           // ID de contrato relacionado (si es parte de un contrato)
  
  // Integración Externa
  externalSource?: {                    // Si viene de API externa
    apiId: string                       // ID de la API externa
    externalId: string                  // ID del documento en el sistema externo
    receivedAt: number                  // Cuándo se recibió
    webhookUrl?: string                 // URL para notificar cuando se firme
    requiresSignature: boolean          // Si requiere firma
    signatureDeadline?: number          // Fecha límite para firmar
  }
  
  // Estado de Firma (para contratos y documentos que requieren firma)
  signatureStatus?: 'pending' | 'partially_signed' | 'fully_signed' | 'expired' | 'rejected'
  requiredSigners?: string[]            // Direcciones que deben firmar
  pendingSigners?: string[]            // Direcciones que aún no han firmado
  
  // Sincronización
  synced: boolean                       // Si está sincronizado con servidor
  serverId?: string                     // ID en el servidor (si existe)
  lastSyncAt?: number                   // Última sincronización
  
  // Batch Operations
  batchId?: string                      // ID del batch (si es parte de una operación en batch)
  batchOperation?: 'sign' | 'verify' | 'encrypt' | 'export'
  
  // Timestamps
  createdAt: number                     // Timestamp de creación
  updatedAt: number                     // Última actualización
}

interface DocumentSignature {
  signer: string                        // Dirección SS58 del firmante
  signature: string                     // Firma en hex
  timestamp: number                     // Timestamp de la firma
  hash: string                          // Hash del documento firmado
  certificate?: string                  // Certificado X.509 (base64, opcional)
  valid?: boolean                       // Si la firma es válida (verificado)
  verifiedAt?: number                    // Cuándo se verificó
  metadata?: {
    reason?: string                     // Razón de la firma
    location?: string                    // Ubicación
    contactInfo?: string                // Información de contacto
    [key: string]: any
  }
}
```

### 2. Índices de IndexedDB

```typescript
// Object Store: 'documents'
// Key Path: 'documentId'

// Índices:
- byType → type (filtrar por tipo)
- byHash → pdfHash (búsqueda por hash)
- byAccount → relatedAccount (documentos por cuenta)
- byCreatedAt → createdAt (ordenar por fecha)
- bySynced → synced (filtrar sincronizados/no sincronizados)
- bySignatureStatus → signatureStatus (filtrar por estado de firma)
- byBatchId → batchId (documentos en batch)
- byExternalSource → externalSource.apiId (documentos de API externa)
- byPendingSignature → signatureStatus + requiredSigners (documentos pendientes)
- compound_type_account → [type, relatedAccount] (búsqueda compuesta)
- byUpdatedAt → updatedAt (ordenar por última actualización)
```

### 3. External API Configs (IndexedDB Object Store)

```typescript
interface ExternalAPIConfig {
  apiId: string                         // UUID (clave primaria)
  name: string                          // Nombre descriptivo
  baseUrl: string                       // URL base
  webhookEndpoint?: string              // Endpoint para recibir documentos
  authentication: {
    type: 'api_key' | 'jwt' | 'signature' | 'oauth2'
    apiKey?: string                     // Encriptado
    secret?: string                     // Encriptado
    token?: string                      // Encriptado
  }
  features: {
    canReceiveDocuments: boolean
    canSendDocuments: boolean
    requiresWebhook: boolean
    supportsBatch: boolean
  }
  webhookConfig?: {
    url: string
    secret: string                      // Encriptado
    events: string[]
  }
  isActive: boolean
  createdAt: number
  updatedAt: number
}

// Índices:
- byName → name (búsqueda por nombre)
- byActive → isActive (filtrar activas)
- byCreatedAt → createdAt (ordenar por fecha)
```

### 4. Document Queue (IndexedDB Object Store)

```typescript
interface DocumentQueueItem {
  id: string                            // UUID (clave primaria)
  documentId: string                    // ID del documento
  operation: 'sign' | 'verify' | 'sync' | 'notify_external'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: 'low' | 'normal' | 'high'
  retries: number
  maxRetries: number
  lastError?: string
  externalApiId?: string                // Si es para API externa
  createdAt: number
  updatedAt: number
  processedAt?: number
}

// Índices:
- byStatus → status (filtrar por estado)
- byPriority → priority (ordenar por prioridad)
- byDocument → documentId (operaciones por documento)
- byExternalApi → externalApiId (operaciones por API)
- byCreatedAt → createdAt (ordenar por fecha)
```

## Operaciones Principales

### 1. Generación de PDF

**Flujo:**
```
1. Recopilar datos (flight log, medical record, etc.)
2. Generar PDF con jsPDF
3. Incluir metadata (GPS, EXIF, etc.)
4. Calcular hash SHA-256
5. Guardar en IndexedDB
6. Opcional: Firmar inmediatamente
7. Opcional: Encriptar
```

**Componentes necesarios:**
- `DocumentGenerator`: Clase para generar PDFs
- `PDFMetadataInjector`: Inyectar metadata GPS/EXIF
- `PDFHashCalculator`: Calcular hash SHA-256

### 2. Firma Digital

**Flujo:**
```
1. Obtener documento de IndexedDB
2. Calcular hash SHA-256 del PDF
3. Firmar hash con keyring (Ed25519/sr25519)
4. Agregar firma al array de signatures
5. Actualizar documento en IndexedDB
6. Opcional: Verificar firma inmediatamente
```

**Componentes necesarios:**
- `DocumentSigner`: Firmar documentos
- `SignatureVerifier`: Verificar firmas
- Integración con keyring existente

### 3. Encriptación

**Flujo:**
```
1. Obtener documento de IndexedDB
2. Derivar clave con PBKDF2 (desde contraseña o clave maestra)
3. Generar IV aleatorio
4. Encriptar PDF con AES-GCM-256
5. Guardar PDF encriptado (reemplazar o mantener original)
6. Guardar metadata de encriptación
7. Actualizar documento en IndexedDB
```

**Componentes necesarios:**
- `DocumentEncryptor`: Encriptar documentos
- `DocumentDecryptor`: Desencriptar documentos
- `KeyDerivation`: Derivar claves con PBKDF2
- Integración con sistema de encriptación existente

### 4. Verificación

**Flujo:**
```
1. Obtener documento de IndexedDB
2. Calcular hash SHA-256 del PDF actual
3. Comparar con pdfHash almacenado (integridad)
4. Para cada firma:
   - Verificar firma con public key del signer
   - Verificar timestamp
   - Verificar hash
5. Retornar resultado de verificación
```

**Componentes necesarios:**
- `DocumentVerifier`: Verificar integridad y firmas
- Integración con keyring para verificación

### 5. Firma en Batch

**Flujo:**
```
1. Seleccionar múltiples documentos
2. Crear batch operation
3. Para cada documento:
   - Calcular hash SHA-256
   - Firmar con keyring
   - Agregar firma
4. Actualizar todos los documentos
5. Notificar API externa (si aplica)
6. Retornar resumen de firmas
```

**Componentes necesarios:**
- `BatchSigner`: Firmar múltiples documentos
- `BatchOperation`: Gestionar operaciones en batch
- UI para selección múltiple

### 6. Verificación en Batch

**Flujo:**
```
1. Seleccionar múltiples documentos
2. Para cada documento:
   - Verificar integridad (hash)
   - Verificar todas las firmas
   - Verificar timestamps
3. Generar reporte de verificación
4. Retornar resultados agregados
```

**Componentes necesarios:**
- `BatchVerifier`: Verificar múltiples documentos
- `VerificationReport`: Generar reportes

### 7. Integración con API Externa

**Flujo de Recepción:**
```
1. API externa envía PDF (vía polling o push notification)
2. Validar autenticación (API key, firma, etc.)
3. Crear documento en estado "pending_signature"
4. Agregar a cola de documentos pendientes
5. Notificar al usuario
6. Usuario revisa y firma
7. Notificar a API externa vía webhook/API call
```

**Flujo de Envío:**
```
1. Usuario firma documento
2. Si tiene externalSource:
   - Enviar a webhookUrl/API endpoint con firma
   - Actualizar estado en API externa
   - Marcar como sincronizado
```

**Componentes necesarios:**
- `ExternalAPIClient`: Cliente para APIs externas
- `WebhookHandler`: Manejar notificaciones entrantes (polling/push)
- `DocumentQueue`: Cola de documentos pendientes
- `APIConfigManager`: Gestionar configuraciones de APIs

## Estructura de Archivos Propuesta

```
src/
├── services/
│   ├── documents/
│   │   ├── DocumentService.ts          // Servicio principal
│   │   ├── DocumentGenerator.ts        // Generación de PDFs
│   │   ├── DocumentSigner.ts           // Firmas digitales (individual)
│   │   ├── BatchSigner.ts              // Firmas en batch
│   │   ├── DocumentEncryptor.ts        // Encriptación
│   │   ├── DocumentVerifier.ts         // Verificación (individual)
│   │   ├── BatchVerifier.ts            // Verificación en batch
│   │   ├── DocumentStorage.ts          // Almacenamiento IndexedDB
│   │   └── DocumentQueue.ts            // Cola de documentos pendientes
│   │
│   ├── external-api/
│   │   ├── ExternalAPIClient.ts       // Cliente para APIs externas
│   │   ├── WebhookHandler.ts          // Manejar webhooks entrantes
│   │   ├── APIConfigManager.ts        // Gestionar configuraciones
│   │   └── DocumentSync.ts             // Sincronización bidireccional
│   │
│   ├── pdf/
│   │   ├── PDFGenerator.ts            // Wrapper de jsPDF
│   │   ├── PDFMetadata.ts             // Metadata GPS/EXIF
│   │   └── PDFHash.ts                  // Cálculo de hash
│   │
│   └── crypto/
│       ├── DocumentCrypto.ts           // Operaciones criptográficas
│       └── KeyDerivation.ts            // Derivación de claves
│
├── utils/
│   ├── documentStorage.ts              // Utilidades IndexedDB para documentos
│   ├── exifExtractor.ts                // Extracción de metadata EXIF
│   └── batchOperations.ts             // Utilidades para operaciones batch
│
└── pages/
    ├── Documents.tsx                   // Lista de documentos
    ├── DocumentDetail.tsx              // Detalle de documento
    ├── DocumentViewer.tsx              // Visor de PDF
    ├── DocumentBatchSign.tsx           // Firma en batch
    ├── DocumentBatchVerify.tsx         // Verificación en batch
    ├── PendingSignatures.tsx           // Documentos pendientes de firma
    └── ExternalAPIs.tsx                 // Configuración de APIs externas
```

## Integración con Flight Logs y Medical Records

### Flight Logs → Document

```typescript
// Al crear un flight log con generatePdf: true
1. Crear FlightLog en IndexedDB
2. Generar PDF con datos del vuelo
3. Incluir fotos con metadata EXIF
4. Incluir coordenadas GPS
5. Crear Document relacionado
6. Vincular: FlightLog.documentId = Document.documentId
7. Opcional: Firmar automáticamente
```

### Medical Records → Document

```typescript
// Al crear un medical record
1. Crear MedicalRecord en IndexedDB
2. Generar PDF con datos médicos
3. ENCRIPTAR obligatoriamente (AES-GCM-256)
4. Crear Document relacionado
5. Vincular: MedicalRecord.documentId = Document.documentId
6. Configurar control de acceso
```

## Almacenamiento

### Estrategia de Almacenamiento

1. **PDF en IndexedDB** (pequeños/medianos)
   - Hasta ~10MB por documento
   - Acceso rápido
   - Sincronización completa

2. **PDF en Cache API** (grandes)
   - Para documentos >10MB
   - Referencia en IndexedDB
   - Cache con Service Worker

3. **PDF en servidor** (opcional)
   - Sincronización con servidor
   - Descarga bajo demanda
   - Almacenamiento local como cache

### Optimizaciones

- **Compresión**: Comprimir PDFs antes de almacenar
- **Lazy Loading**: Cargar PDF solo cuando se necesita visualizar
- **Thumbnails**: Generar miniaturas para listas
- **Versionado**: Mantener solo última versión en memoria

## Seguridad

### Encriptación

- **Medical Records**: Siempre encriptados
- **Flight Logs**: Opcional (configurable)
- **Attestations**: Opcional
- **Otros**: Opcional

### Control de Acceso

- **Por cuenta**: Solo el creador puede acceder por defecto
- **Compartir**: Permitir compartir con otras direcciones
- **Permisos**: Lectura, escritura, firma

### Auditoría

- **Log de accesos**: Quién accedió y cuándo
- **Historial de cambios**: Versiones del documento
- **Firmas**: Registro de todas las firmas

## Sincronización

### Cola de Sincronización

```typescript
interface SyncOperation {
  id: string
  type: 'upload_document' | 'download_document' | 'update_document'
  documentId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: 'low' | 'normal' | 'high'
  retries: number
  lastError?: string
  createdAt: number
  updatedAt: number
}
```

### Estrategia

1. **Offline First**: Crear documentos offline
2. **Background Sync**: Sincronizar cuando hay conexión
3. **Conflict Resolution**: Última escritura gana (o merge manual)
4. **Compresión**: Comprimir antes de subir

## UI/UX

### Páginas Necesarias

1. **Lista de Documentos** (`/documents`)
   - Filtros: tipo, fecha, cuenta
   - Búsqueda: por hash, título, metadata
   - Vista: lista o grid
   - Acciones: ver, descargar, firmar, encriptar, eliminar

2. **Detalle de Documento** (`/documents/:id`)
   - Vista previa del PDF
   - Metadata completa
   - Lista de firmas
   - Estado de encriptación
   - Historial de versiones
   - Acciones: firmar, verificar, encriptar/desencriptar

3. **Visor de PDF** (`/documents/:id/view`)
   - Visor completo de PDF
   - Zoom, navegación
   - Descarga

4. **Firma en Batch** (`/documents/batch/sign`)
   - Selección de documentos
   - Vista previa de documentos seleccionados
   - Selección de cuenta para firmar
   - Proceso de firma con progreso
   - Resumen de resultados
   - Manejo de errores parciales

5. **Verificación en Batch** (`/documents/batch/verify`)
   - Selección de documentos
   - Proceso de verificación
   - Reporte de resultados
   - Exportar reporte (PDF/CSV)

6. **Documentos Pendientes** (`/documents/pending`)
   - Lista de documentos que requieren firma
   - Filtros: deadline, API externa, tipo
   - Notificaciones de deadlines próximos
   - Acciones rápidas: firmar, rechazar, posponer

7. **Configuración de APIs Externas** (`/settings/external-apis`)
   - Lista de APIs configuradas
   - Agregar nueva API
   - Editar configuración
   - Probar conexión
   - Ver documentos recibidos
   - Configurar webhooks

8. **Generador de Documentos** (integrado en Flight Logs/Medical Records)
   - Formulario de datos
   - Preview del PDF
   - Opciones: firmar, encriptar, enviar a API externa

### Componentes Adicionales

- **DocumentCard**: Tarjeta de documento con preview
- **SignatureBadge**: Badge de estado de firma
- **BatchSelector**: Selector múltiple para batch operations
- **DocumentQueue**: Cola de documentos pendientes
- **APIConfigForm**: Formulario de configuración de API
- **WebhookTester**: Herramienta para probar webhooks

## Dependencias Necesarias

```json
{
  "jspdf": "^2.5.1",                    // Generación de PDFs
  "jspdf-autotable": "^3.8.2",          // Tablas en PDFs
  "exif-js": "^2.3.0",                  // Metadata EXIF
  "pdf-lib": "^1.17.1",                 // Manipulación de PDFs (para firmas)
  "@pdf-lib/fontkit": "^1.1.1",         // Fuentes para PDFs
  "react-pdf": "^7.6.0",                // Visor de PDFs en React
  "pdfjs-dist": "^3.11.174"             // PDF.js para renderizado
}
```

## Consideraciones de Webhooks en PWA

### Desafíos

1. **PWA no tiene servidor**: No podemos recibir webhooks directamente
2. **Service Worker**: Puede interceptar requests pero no crear endpoints HTTP
3. **Polling**: Alternativa a webhooks

### Soluciones Propuestas

**Opción 1: Polling**
- La PWA hace polling periódico a la API externa
- Verificar si hay nuevos documentos
- Más simple pero menos eficiente

**Opción 2: Service Worker + Push Notifications**
- API externa envía push notification
- Service Worker recibe y procesa
- Requiere soporte de push notifications

**Opción 3: Webhook Proxy (Servicio Intermedio)**
- Servicio intermedio recibe webhooks
- Envía push notifications a la PWA
- Más complejo pero más robusto

**Opción 4: WebSocket (si la API lo soporta)**
- Conexión WebSocket persistente
- Notificaciones en tiempo real
- Requiere que la API soporte WebSocket

### Recomendación

Implementar **Opción 1 (Polling) + Opción 2 (Push)** como híbrido:
- Polling como fallback
- Push notifications cuando esté disponible
- Service Worker para procesamiento en background

## Fases de Implementación

### Fase 1: Estructura Base
- [ ] Crear object store `documents` en IndexedDB
- [ ] Crear object store `external-api-configs` en IndexedDB
- [ ] Implementar `DocumentStorage` (CRUD básico)
- [ ] Crear interfaces TypeScript
- [ ] Página de lista de documentos
- [ ] Soporte para tipos: contract, generic

### Fase 2: Generación de PDFs
- [ ] Instalar jsPDF
- [ ] Implementar `PDFGenerator`
- [ ] Generar PDFs básicos
- [ ] Incluir metadata GPS
- [ ] Integrar con Flight Logs

### Fase 3: Firmas Digitales (Individual)
- [ ] Implementar `DocumentSigner`
- [ ] Integrar con keyring
- [ ] Implementar `SignatureVerifier`
- [ ] UI para firmar documentos
- [ ] Verificación automática
- [ ] Soporte para múltiples firmantes

### Fase 4: Firmas en Batch
- [ ] Implementar `BatchSigner`
- [ ] UI para selección múltiple de documentos
- [ ] Proceso de firma batch
- [ ] Reporte de resultados
- [ ] Manejo de errores parciales

### Fase 5: Verificación en Batch
- [ ] Implementar `BatchVerifier`
- [ ] UI para verificación batch
- [ ] Generación de reportes
- [ ] Exportar resultados

### Fase 6: Integración con API Externa
- [ ] Implementar `APIConfigManager`
- [ ] Crear object store para configuraciones de API
- [ ] Implementar `WebhookHandler`
- [ ] Implementar `ExternalAPIClient`
- [ ] UI para configurar APIs externas
- [ ] Cola de documentos pendientes de firma
- [ ] Notificaciones de documentos recibidos
- [ ] Webhook para notificar firmas completadas

### Fase 7: Encriptación
- [ ] Implementar `DocumentEncryptor`
- [ ] Implementar `DocumentDecryptor`
- [ ] Derivación de claves (PBKDF2)
- [ ] UI para encriptar/desencriptar
- [ ] Integrar con Medical Records

### Fase 8: Metadata y EXIF
- [ ] Extracción de EXIF de fotos
- [ ] Inyección de metadata GPS en PDFs
- [ ] Metadata personalizada

### Fase 9: Sincronización
- [ ] Cola de sincronización
- [ ] Upload/download de documentos
- [ ] Resolución de conflictos
- [ ] Service Worker para background sync
- [ ] Sincronización con APIs externas

### Fase 10: Optimizaciones
- [ ] Compresión de PDFs
- [ ] Thumbnails
- [ ] Lazy loading
- [ ] Cache API para documentos grandes
- [ ] Optimización de operaciones batch

## Consideraciones Técnicas

### Limitaciones del Navegador

- **IndexedDB**: ~50% del espacio disponible (varía por navegador)
- **PDFs grandes**: Considerar Cache API o servidor
- **Memoria**: PDFs grandes pueden causar problemas de memoria

### Mejores Prácticas

- **Validación**: Validar todos los datos antes de generar PDF
- **Error Handling**: Manejar errores de generación/encriptación
- **Progreso**: Mostrar progreso para operaciones largas
- **Offline**: Funcionar completamente offline

### Testing

- **Unit Tests**: Generación, firmas, encriptación
- **Integration Tests**: Flujo completo
- **E2E Tests**: UI completa
- **Performance Tests**: PDFs grandes, múltiples documentos

## Integración con API Externa

### Configuración de API Externa

```typescript
interface ExternalAPIConfig {
  apiId: string                         // ID único de la API
  name: string                          // Nombre descriptivo
  baseUrl: string                       // URL base de la API
  webhookEndpoint?: string              // Endpoint para recibir documentos
  authentication: {
    type: 'api_key' | 'jwt' | 'signature' | 'oauth2'
    apiKey?: string                     // API key (si aplica)
    secret?: string                     // Secret para firmas
    token?: string                      // JWT token
  }
  features: {
    canReceiveDocuments: boolean        // Puede recibir documentos para firmar
    canSendDocuments: boolean           // Puede enviar documentos firmados
    requiresWebhook: boolean            // Requiere webhook para notificaciones
    supportsBatch: boolean              // Soporta operaciones batch
  }
  webhookConfig?: {
    url: string                         // URL del webhook en nuestra app
    secret: string                      // Secret para validar webhooks
    events: string[]                    // Eventos a escuchar
  }
  createdAt: number
  updatedAt: number
}
```

### Flujo de Documentos desde API Externa

**1. Recepción de Documento:**
```
API Externa → Webhook/Polling → Validar → Crear Documento → Notificar Usuario
```

**2. Firma de Documento:**
```
Usuario → Revisar → Firmar → Notificar API Externa → Actualizar Estado
```

**3. Sincronización:**
```
Polling o WebSocket → Verificar Estado → Sincronizar Cambios
```

### Endpoint Webhook (en nuestra PWA)

**Nota**: Como PWA no puede recibir webhooks directamente, usamos polling o push notifications.

**Estructura de datos recibidos (simulada):**
```typescript
// Datos que recibiríamos de la API externa
{
  "apiId": "external_api_123",
  "event": "document_received",
  "document": {
    "externalId": "doc_ext_456",
    "pdf": "data:application/pdf;base64,...",
    "metadata": {
      "title": "Contrato de Trabajo",
      "type": "contract",
      "requiresSignature": true,
      "deadline": "2024-12-31T23:59:59Z"
    },
    "requiredSigners": [
      "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
    ]
  },
  "signature": "0x..." // Firma de la API para validar
}
```

### Notificación a API Externa

```typescript
// POST {webhookUrl} o PUT {baseUrl}/documents/{externalId}/status
{
  "event": "document_signed",
  "documentId": "doc_abc123",
  "externalId": "doc_ext_456",
  "signatures": [
    {
      "signer": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "signature": "0x...",
      "timestamp": 1234567890,
      "hash": "0x..."
    }
  ],
  "signedPdf": "data:application/pdf;base64,...", // PDF firmado
  "status": "fully_signed"
}
```

## Preguntas Abiertas

1. **Tamaño máximo de PDF**: ¿Cuál es el límite práctico?
2. **Versionado**: ¿Cuántas versiones mantener?
3. **Compresión**: ¿Qué algoritmo usar?
4. **Thumbnails**: ¿Generar automáticamente o bajo demanda?
5. **Sincronización**: ¿Estrategia de resolución de conflictos?
6. **X.509**: ¿Implementar soporte completo o solo básico?
7. **Batch Operations**: ¿Límite de documentos por batch?
8. **Webhooks**: ¿Cómo manejar webhooks en PWA (Service Worker/Polling)?
9. **API Externa**: ¿Autenticación estándar o personalizada por API?
10. **Notificaciones**: ¿Push notifications para documentos pendientes?
11. **Firmas Múltiples**: ¿Orden de firmas o todas simultáneas?
12. **Deadlines**: ¿Qué hacer con documentos expirados?

## Próximos Pasos

1. Revisar y aprobar este plan
2. Crear issues/tasks para cada fase
3. Comenzar con Fase 1 (Estructura Base)
4. Iterar y refinar según feedback

