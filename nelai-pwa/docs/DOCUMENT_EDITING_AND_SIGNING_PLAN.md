# Plan de Implementación: Edición de Documentos y Firmas

## Resumen Ejecutivo

Este documento planifica la implementación de:
1. **Editor de documentos** antes de generar PDF
2. **Múltiples tipos de firmas**: Substrate keys, X.509, y autográfica
3. **Encriptación** de documentos
4. **Verificación** de firmas e integridad

## 1. Editor de Documentos

### Opciones de Editores

#### Opción 1: Editor de Texto Enriquecido (WYSIWYG)
**Librerías disponibles:**
- **TinyMCE**: Editor completo, muchas características, pero pesado (~500KB)
- **Quill**: Ligero (~50KB), modular, fácil de personalizar
- **Draft.js**: De Facebook, más control pero más complejo
- **TipTap**: Basado en ProseMirror, moderno y extensible

**Recomendación: Quill o TipTap**
- Quill: Más simple, suficiente para la mayoría de casos
- TipTap: Más moderno, mejor para casos complejos

#### Opción 2: Editor de Formularios Estructurados
**Para documentos con estructura fija:**
- Formularios con campos específicos según tipo de documento
- Templates predefinidos
- Validación de campos
- Preview en tiempo real

**Recomendación: Combinar ambos**
- Editor WYSIWYG para documentos genéricos
- Formularios estructurados para contratos, flight logs, etc.

### Estructura Propuesta

```typescript
interface DocumentTemplate {
  id: string
  name: string
  type: DocumentType
  structure: {
    sections: Array<{
      id: string
      title: string
      type: 'text' | 'form' | 'table' | 'image' | 'signature'
      fields?: FormField[]
      required?: boolean
    }>
  }
}

interface FormField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox'
  required?: boolean
  validation?: ValidationRule[]
}
```

### Flujo de Edición

```
1. Usuario selecciona tipo de documento
2. Se carga template o editor en blanco
3. Usuario edita contenido:
   - Editor WYSIWYG para texto libre
   - Formularios para datos estructurados
4. Preview en tiempo real
5. Generar PDF cuando esté listo
```

## 2. Tipos de Firmas

### 2.1 Firma con Llaves Substrate (Ed25519/sr25519)

**Ya implementado en el plan:**
- Firmar hash SHA-256 del documento
- Almacenar firma en metadata del documento
- Verificación offline con public key

**Ventajas:**
- ✅ Ya tenemos la infraestructura (keyring)
- ✅ Firma criptográficamente segura
- ✅ Verificación offline
- ✅ Compatible con blockchain

**Limitaciones:**
- No es una firma PDF estándar (no visible en el PDF)
- No compatible con lectores PDF estándar

### 2.2 Firma X.509 (Certificado Digital)

**Implementación:**
- Usar `pdf-lib` para firmar PDFs con certificados X.509
- Certificado debe estar en formato PKCS#12 (.p12) o PEM
- La firma se incrusta en el PDF como campo de firma digital
- Compatible con Adobe Reader y otros lectores PDF

**Librerías necesarias:**
```bash
yarn add pdf-lib @pdf-lib/fontkit
# Para manejar certificados X.509:
yarn add node-forge # o usar Web Crypto API
```

**Flujo:**
```
1. Usuario carga certificado X.509 (.p12 o .pem)
2. Solicitar contraseña del certificado
3. Usar pdf-lib para crear campo de firma en PDF
4. Firmar con certificado usando Web Crypto API o node-forge
5. Incrustar firma en PDF
6. Guardar PDF firmado
```

**Ventajas:**
- ✅ Firma PDF estándar (visible en lectores PDF)
- ✅ Legalmente reconocida en muchos países
- ✅ Compatible con sistemas gubernamentales
- ✅ Verificación con certificados públicos

**Limitaciones:**
- Requiere certificado X.509 (obtenido de autoridad certificadora)
- Más complejo de implementar
- Certificado debe estar instalado/importado

### 2.3 Firma Autográfica (Manuscrita)

**Implementación:**
- Capturar firma usando canvas (touch/mouse)
- Guardar como imagen (PNG/SVG)
- Incrustar imagen en PDF usando jsPDF o pdf-lib
- Opcional: Agregar metadata de captura (timestamp, GPS)

**Librerías necesarias:**
```bash
yarn add react-signature-canvas
# o implementar canvas personalizado
```

**Flujo:**
```
1. Usuario hace clic en "Agregar Firma Autográfica"
2. Se abre canvas para dibujar firma
3. Usuario dibuja firma (touch o mouse)
4. Opciones: Limpiar, Aceptar, Cancelar
5. Guardar firma como imagen base64
6. Incrustar en PDF en posición especificada
7. Guardar metadata (timestamp, ubicación si disponible)
```

**Ventajas:**
- ✅ Firma visual reconocible
- ✅ Fácil de usar (no requiere certificados)
- ✅ Familiar para usuarios
- ✅ Puede combinarse con firma digital

**Limitaciones:**
- No es criptográficamente segura por sí sola
- Puede ser falsificada fácilmente
- Recomendado combinarla con firma digital

### 2.4 Firma Híbrida (Recomendada)

**Combinar múltiples tipos:**
1. Firma autográfica (visual) en el PDF
2. Firma digital con Substrate keys (criptográfica)
3. Opcional: Firma X.509 (si hay certificado)

**Ventajas:**
- Visual + Criptográfica = Máxima seguridad y reconocimiento
- Cumple requisitos legales y técnicos
- Flexible según necesidades del usuario

## 3. Estructura de Implementación

### 3.1 Editor de Documentos

```
src/
├── components/
│   ├── documents/
│   │   ├── DocumentEditor.tsx          // Editor principal
│   │   ├── RichTextEditor.tsx          // Editor WYSIWYG (Quill/TipTap)
│   │   ├── FormEditor.tsx              // Editor de formularios
│   │   ├── TemplateSelector.tsx        // Selector de templates
│   │   └── DocumentPreview.tsx          // Preview en tiempo real
│   │
│   └── signatures/
│       ├── SignatureCanvas.tsx         // Canvas para firma autográfica
│       ├── SignatureSelector.tsx       // Selector de tipo de firma
│       ├── X509CertificateUpload.tsx   // Carga de certificado X.509
│       └── SignaturePreview.tsx        // Preview de firma
│
├── services/
│   ├── documents/
│   │   ├── DocumentEditorService.ts    // Lógica de edición
│   │   └── TemplateService.ts          // Gestión de templates
│   │
│   └── signatures/
│       ├── SubstrateSigner.ts          // Firma con Substrate keys
│       ├── X509Signer.ts               // Firma con X.509
│       ├── AutographicSigner.ts        // Firma autográfica
│       └── SignatureVerifier.ts       // Verificación de firmas
│
└── utils/
    ├── pdfSigning.ts                   // Utilidades para firmar PDFs
    └── certificateUtils.ts            // Utilidades para certificados
```

### 3.2 Tipos de Datos

```typescript
interface DocumentSignature {
  // Identificación
  id: string
  type: 'substrate' | 'x509' | 'autographic' | 'hybrid'
  
  // Firma Substrate
  substrate?: {
    signer: string                    // Dirección SS58
    signature: string                  // Firma en hex
    keyType: 'sr25519' | 'ed25519' | 'ecdsa'
  }
  
  // Firma X.509
  x509?: {
    certificate: string                // Certificado en base64
    signature: string                  // Firma del PDF
    timestamp: number
    reason?: string
    location?: string
  }
  
  // Firma Autográfica
  autographic?: {
    image: string                      // Imagen de la firma (base64)
    position: {                        // Posición en el PDF
      page: number
      x: number                        // mm
      y: number                        // mm
      width?: number
      height?: number
    }
    capturedAt: number
    gpsMetadata?: GPSMetadata
  }
  
  // Metadata común
  timestamp: number
  hash: string                         // Hash del documento firmado
  valid?: boolean
  verifiedAt?: number
}
```

## 4. Implementación de Firmas

### 4.1 Firma con Substrate Keys

**Ya planificado:**
- Firmar hash SHA-256 del PDF
- Almacenar en `Document.signatures[]`
- Verificar con public key del signer

### 4.2 Firma X.509

**Pasos:**
1. Cargar certificado X.509 (.p12 o .pem)
2. Extraer clave privada (con contraseña)
3. Usar `pdf-lib` para crear campo de firma
4. Firmar PDF con certificado
5. Incrustar firma en PDF
6. Guardar metadata del certificado

**Código de ejemplo:**
```typescript
import { PDFDocument } from 'pdf-lib'
import * as forge from 'node-forge'

async function signPDFWithX509(
  pdfBytes: Uint8Array,
  certificate: string,  // Base64 del certificado
  privateKey: string,   // Clave privada
  password: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  
  // Crear campo de firma
  const signatureField = pdfDoc.getForm().createSignature('signature1')
  
  // Firmar con certificado X.509
  // (Implementación específica con node-forge o Web Crypto API)
  
  return await pdfDoc.save()
}
```

### 4.3 Firma Autográfica

**Pasos:**
1. Capturar firma en canvas
2. Convertir a imagen (PNG)
3. Usar jsPDF o pdf-lib para incrustar imagen
4. Guardar metadata de captura

**Código de ejemplo:**
```typescript
import SignatureCanvas from 'react-signature-canvas'

// Capturar firma
const canvas = signatureRef.current.getCanvas()
const signatureImage = canvas.toDataURL('image/png')

// Incrustar en PDF
pdf.addImage(signatureImage, 'PNG', x, y, width, height)
```

## 5. Encriptación

### 5.1 Encriptación con AES-GCM-256

**Ya planificado:**
- Derivación de clave con PBKDF2
- Encriptación del PDF
- Almacenamiento de metadata de encriptación

**Implementación:**
```typescript
async function encryptPDF(
  pdfBase64: string,
  password: string
): Promise<{
  encryptedPDF: string
  iv: string
  salt: string
  iterations: number
}> {
  // Derivar clave
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    await deriveKey(password, salt),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  // Encriptar
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const pdfBytes = base64ToUint8Array(pdfBase64)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    pdfBytes
  )
  
  return {
    encryptedPDF: uint8ArrayToBase64(new Uint8Array(encrypted)),
    iv: uint8ArrayToHex(iv),
    salt: uint8ArrayToHex(salt),
    iterations: 100000,
  }
}
```

## 6. Verificación

### 6.1 Verificación de Integridad

- Comparar hash SHA-256 actual con hash almacenado
- Detectar modificaciones

### 6.2 Verificación de Firmas

**Substrate:**
- Verificar firma con public key
- Verificar hash del documento

**X.509:**
- Verificar certificado (cadena de confianza)
- Verificar firma del PDF
- Verificar que el certificado no esté revocado

**Autográfica:**
- Verificar timestamp
- Verificar metadata de captura
- (No hay verificación criptográfica)

## 7. Dependencias Necesarias

```json
{
  "quill": "^2.0.2",                    // Editor WYSIWYG
  "react-quill": "^2.0.0",              // React wrapper para Quill
  "pdf-lib": "^1.17.1",                 // Manipulación avanzada de PDFs
  "@pdf-lib/fontkit": "^1.1.1",         // Fuentes para PDFs
  "react-signature-canvas": "^1.0.6",   // Canvas para firma autográfica
  "node-forge": "^1.3.1"                // Manejo de certificados X.509
}
```

## 8. UI/UX

### 8.1 Editor de Documentos

**Página: `/documents/edit` o `/documents/new`**

**Componentes:**
- Selector de tipo de documento
- Selector de template (si aplica)
- Editor WYSIWYG o formulario estructurado
- Preview en tiempo real
- Opciones:
  - Guardar borrador
  - Generar PDF
  - Firmar inmediatamente
  - Encriptar

### 8.2 Firma de Documentos

**Modal/Drawer para firmar:**

**Opciones de firma:**
1. **Firma Digital (Substrate)**
   - Selector de cuenta
   - Confirmar firma
   - Verificar inmediatamente

2. **Firma X.509**
   - Cargar certificado
   - Ingresar contraseña
   - Seleccionar posición en PDF
   - Firmar

3. **Firma Autográfica**
   - Canvas para dibujar
   - Seleccionar posición en PDF
   - Ajustar tamaño
   - Aplicar

4. **Firma Híbrida**
   - Combinar autográfica + digital
   - O autográfica + X.509

## 9. Flujo Completo

### Crear y Firmar Documento

```
1. Usuario crea documento
   ├─ Editor WYSIWYG (texto libre)
   └─ Formulario estructurado (datos específicos)

2. Preview del documento

3. Generar PDF

4. Opciones de firma:
   ├─ Firma Digital (Substrate) → Rápida, criptográfica
   ├─ Firma X.509 → Estándar, legal
   ├─ Firma Autográfica → Visual, familiar
   └─ Firma Híbrida → Combinación

5. Opciones de seguridad:
   ├─ Encriptar documento
   └─ Configurar acceso

6. Guardar documento
```

## 10. Consideraciones Legales

### Firma Digital vs Firma Autográfica

**Firma Digital (X.509 o Substrate):**
- ✅ Criptográficamente segura
- ✅ Legalmente vinculante en muchos países
- ✅ Verificable técnicamente
- ✅ No repudio

**Firma Autográfica:**
- ⚠️ Visual pero no criptográfica
- ⚠️ Puede ser falsificada
- ✅ Familiar para usuarios
- ✅ Útil como complemento visual

**Recomendación:**
- Para documentos legales: Usar firma digital (X.509 o Substrate)
- Para documentos informales: Firma autográfica es suficiente
- Para máxima seguridad: Firma híbrida (autográfica + digital)

## 11. Preguntas y Respuestas

### ¿Se puede firmar con X.509 además de Substrate?

**Sí, absolutamente.** Puedes tener múltiples firmas en el mismo documento:
- Firma con Substrate keys (criptográfica)
- Firma con X.509 (estándar PDF)
- Firma autográfica (visual)

Todas pueden coexistir en el mismo documento.

### ¿Se puede firmar autográficamente?

**Sí.** Usando canvas para capturar la firma y luego incrustándola en el PDF. Es una imagen, no una firma criptográfica, pero es visualmente reconocible.

### ¿Qué editor usar?

**Recomendación:**
- **Quill** para la mayoría de casos (simple, ligero)
- **TipTap** si necesitas más control
- **Formularios estructurados** para documentos con formato fijo (contratos, flight logs)

### ¿Cómo combinar todo?

**Estrategia híbrida:**
1. Editor WYSIWYG para documentos genéricos
2. Formularios para documentos estructurados
3. Múltiples tipos de firma disponibles
4. Encriptación opcional
5. Verificación completa

## 12. Próximos Pasos

1. **Fase 1**: Implementar editor básico (Quill)
2. **Fase 2**: Implementar firma con Substrate keys
3. **Fase 3**: Implementar firma autográfica
4. **Fase 4**: Implementar encriptación
5. **Fase 5**: Implementar firma X.509 (opcional)
6. **Fase 6**: Verificación completa

