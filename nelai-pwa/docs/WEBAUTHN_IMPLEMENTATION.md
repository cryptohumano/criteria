# Implementación de WebAuthn en PWA Substrate Explorer

## Referencia

Esta implementación sigue la especificación oficial de Web Authentication API:
- [MDN Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [W3C Web Authentication Specification](https://w3c.github.io/webauthn/)

## ¿Qué es WebAuthn?

WebAuthn (Web Authentication API) es una API web que permite autenticación fuerte usando criptografía de clave pública, permitiendo:

- **Autenticación sin contraseña**: Usa claves públicas/privadas en lugar de contraseñas
- **Autenticación multi-factor segura**: Sin necesidad de SMS
- **Protección contra phishing**: La firma cambia con el origen del sitio
- **Resistente a data breaches**: La clave pública no puede usarse para autenticar
- **Invulnerable a ataques de contraseña**: Usa criptografía asimétrica

## Características de Seguridad

### 1. Protección contra Phishing
Un atacante que crea un sitio web falso no puede iniciar sesión como el usuario porque la firma cambia con el origen del sitio web.

### 2. Reducción del Impacto de Data Breaches
Los desarrolladores no necesitan hacer hash de la clave pública, y si un atacante obtiene acceso a la clave pública usada para verificar la autenticación, no puede autenticarse porque necesita la clave privada.

### 3. Invulnerable a Ataques de Contraseña
Algunos usuarios pueden reutilizar contraseñas, y un atacante puede obtener la contraseña del usuario para otro sitio web. Las contraseñas de texto son mucho más fáciles de forzar por fuerza bruta que una firma digital.

## Implementación Actual

### Componentes

1. **`src/utils/webauthn.ts`**: Utilidades principales de WebAuthn
   - Registro de credenciales
   - Autenticación
   - Verificación de firmas
   - Derivación de claves

2. **`src/utils/webauthnStorage.ts`**: Almacenamiento de credenciales en IndexedDB
   - Guardar credenciales
   - Obtener credenciales
   - Eliminar credenciales
   - Actualizar estadísticas de uso

3. **`src/components/WebAuthnManager.tsx`**: Componente UI para gestionar credenciales
   - Registrar nuevas credenciales
   - Listar credenciales existentes
   - Eliminar credenciales
   - Mostrar estadísticas

4. **`src/components/KeyringUnlock.tsx`**: Integración con desbloqueo del keyring
   - Opción para desbloquear con WebAuthn
   - Botones para cada credencial registrada

### Flujo de Registro

1. El usuario hace clic en "Registrar Credencial WebAuthn"
2. Se genera un `userId` único
3. Se llama a `navigator.credentials.create()` con:
   - `challenge`: Número aleatorio de al menos 16 bytes
   - `rp`: Información del Relying Party (dominio)
   - `user`: Información del usuario
   - `pubKeyCredParams`: Algoritmos soportados (ES256, RS256)
   - `authenticatorSelection`: Preferencias del autenticador
4. El autenticador (biométrico, clave de seguridad) genera un par de claves
5. Se almacena la clave pública en IndexedDB
6. La clave privada permanece en el autenticador

### Flujo de Autenticación

1. El usuario selecciona una credencial WebAuthn para desbloquear
2. Se genera un `challenge` aleatorio
3. Se llama a `navigator.credentials.get()` con:
   - `challenge`: Número aleatorio
   - `allowCredentials`: Lista de credenciales permitidas
   - `rpId`: ID del Relying Party
   - `userVerification`: Requerir verificación del usuario
4. El autenticador firma el challenge con la clave privada
5. Se verifica la firma usando la clave pública almacenada
6. Si es válida, se desbloquea el keyring

## Requisitos de Seguridad

### Contexto Seguro
WebAuthn requiere un contexto seguro (HTTPS) en producción. En desarrollo local, funciona en `localhost`.

### Challenge
- Debe ser al menos 16 bytes de datos aleatorios criptográficamente seguros
- Debe ser único para cada operación
- No debe ser reutilizado

### Relying Party ID (RP ID)
- Debe ser el hostname del sitio (sin protocolo ni puerto)
- Para `localhost`, usar `'localhost'`
- Debe coincidir exactamente entre registro y autenticación

## Algoritmos Soportados

- **ES256** (ECDSA w/ SHA-256): Algoritmo recomendado, más eficiente
- **RS256** (RSA w/ SHA-256): Alternativa compatible

## Tipos de Autenticadores

### Platform Authenticators
- Autenticadores integrados en el dispositivo
- Ejemplos: Windows Hello, Touch ID, Face ID, Android Biometric
- Más convenientes para usuarios

### Cross-Platform Authenticators
- Autenticadores externos
- Ejemplos: YubiKey, USB Security Keys, NFC/BLE keys
- Más portables entre dispositivos

## Limitaciones Actuales

### Implementación Simplificada
La implementación actual usa WebAuthn como método de autenticación, pero las cuentas siguen encriptadas con contraseña. Esto proporciona:

- ✅ Doble factor de autenticación (WebAuthn + contraseña)
- ✅ Mayor seguridad
- ❌ Menos conveniente (requiere ambos)

### Implementación Completa (Futuro)
Para una implementación completa donde WebAuthn derive la clave de encriptación:

1. Modificar `encrypt/decrypt` para aceptar `CryptoKey` directamente
2. Derivar clave desde la firma WebAuthn usando `deriveKeyFromWebAuthn()`
3. Usar esa clave para encriptar/desencriptar cuentas
4. Almacenar un hash de la clave derivada para verificación

## Mejores Prácticas

### 1. Manejo de Errores
```typescript
try {
  await registerWebAuthnCredential(...)
} catch (error) {
  if (error.name === 'NotAllowedError') {
    // Usuario canceló o timeout
  } else if (error.name === 'InvalidStateError') {
    // Credencial ya existe
  } else if (error.name === 'SecurityError') {
    // Contexto no seguro (requiere HTTPS)
  }
}
```

### 2. Verificación de Firma
Siempre verificar las firmas WebAuthn antes de confiar en la autenticación:

```typescript
const isValid = await verifyWebAuthnSignature(
  signature,
  authenticatorData,
  clientDataJSON,
  publicKey
)
```

### 3. Contador de Uso
Mantener un contador de uso para detectar replay attacks:

```typescript
if (newCounter <= oldCounter) {
  throw new Error('Posible replay attack')
}
```

### 4. Timeout
Usar timeouts apropiados (recomendado: 60 segundos):

```typescript
timeout: 60000 // 60 segundos
```

## Compatibilidad del Navegador

WebAuthn está ampliamente disponible desde septiembre de 2021:
- ✅ Chrome/Edge: Soporte completo
- ✅ Firefox: Soporte completo
- ✅ Safari: Soporte completo (desde iOS 13, macOS 10.15)
- ✅ Opera: Soporte completo

### Requisitos
- Contexto seguro (HTTPS o localhost)
- Navegador moderno
- Autenticador disponible (biométrico o clave de seguridad)

## Ejemplos de Uso

### Registrar una Credencial
```typescript
const credential = await registerWebAuthnCredential(
  'user-id-123',
  'usuario@ejemplo.com',
  'Usuario Ejemplo',
  'Mi Huella Dactilar'
)
```

### Autenticar con WebAuthn
```typescript
const authResult = await authenticateWithWebAuthn(credential.id)
// authResult contiene: signature, authenticatorData, clientDataJSON
```

### Verificar Firma
```typescript
const isValid = await verifyWebAuthnSignature(
  authResult.signature,
  authResult.authenticatorData,
  authResult.clientDataJSON,
  credential.publicKey
)
```

## Recursos Adicionales

- [MDN Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [WebAuthn.io Demo](https://webauthn.io/)
- [Google WebAuthn Demo](https://webauthn.io/)
- [W3C WebAuthn Specification](https://w3c.github.io/webauthn/)

