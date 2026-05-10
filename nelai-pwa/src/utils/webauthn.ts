/**
 * Utilidades para WebAuthn (Web Authentication API)
 * Permite autenticación usando credenciales biométricas o claves de seguridad
 * 
 * Referencia oficial: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
 * 
 * WebAuthn usa claves públicas/privadas asimétricas:
 * - La clave privada nunca sale del dispositivo
 * - La clave pública se almacena en el servidor (en nuestro caso, IndexedDB)
 * - La autenticación se hace mediante un challenge-response
 * - El challenge debe ser al menos 16 bytes de datos aleatorios criptográficamente seguros
 * 
 * Características de seguridad:
 * - Protección contra phishing: la firma cambia con el origen del sitio
 * - Resistente a data breaches: la clave pública no puede usarse para autenticar
 * - Invulnerable a ataques de contraseña: usa criptografía asimétrica
 */

// Configuración de WebAuthn
// Según MDN: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
const getRPId = (): string => {
  // El RP ID debe ser el dominio (hostname) sin protocolo ni puerto
  // Para localhost, usar 'localhost'
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'localhost'
  }
  // Para otros dominios, usar el hostname
  return hostname
}

const RP_NAME = 'CriterIA'
const TIMEOUT = 60000 // 60 segundos (recomendado por MDN)
const MIN_CHALLENGE_LENGTH = 16 // Mínimo según MDN (usamos 32 para mayor seguridad)

export interface WebAuthnCredential {
  id: string // credentialId (base64url)
  publicKey: string // Clave pública (base64url)
  counter: number // Contador de uso (protección contra replay attacks)
  createdAt: number
  lastUsedAt?: number
  name?: string // Nombre descriptivo de la credencial
  masterKeySalt?: string // Salt para derivar la clave maestra (base64url)
}

/**
 * Verifica si WebAuthn está disponible en el navegador
 */
export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'credentials' in navigator &&
    'create' in navigator.credentials &&
    'get' in navigator.credentials &&
    typeof PublicKeyCredential !== 'undefined'
  )
}

/**
 * Verifica si el dispositivo soporta autenticación biométrica
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnAvailable()) return false

  try {
    // Verificar si hay autenticadores disponibles
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    return available
  } catch {
    return false
  }
}

/**
 * Convierte ArrayBuffer a base64url
 */
export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Convierte base64url a ArrayBuffer
 */
export function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Genera un challenge aleatorio
 * Según MDN: debe ser al menos 16 bytes, preferiblemente más grande
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
 */
function generateChallenge(): ArrayBuffer {
  // Generar 32 bytes (256 bits) de datos aleatorios criptográficamente seguros
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  return challenge.buffer
}

/**
 * Genera un salt para la clave maestra de WebAuthn
 */
export function generateMasterKeySalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

/**
 * Registra una nueva credencial WebAuthn
 * @param userId - ID único del usuario (puede ser un hash de la contraseña o un ID generado)
 * @param userName - Nombre del usuario
 * @param userDisplayName - Nombre para mostrar
 * @param credentialName - Nombre descriptivo para la credencial
 */
export async function registerWebAuthnCredential(
  userId: string,
  userName: string,
  userDisplayName: string,
  credentialName?: string
): Promise<WebAuthnCredential> {
  if (!isWebAuthnAvailable()) {
    throw new Error('WebAuthn no está disponible en este navegador')
  }

  try {
    // Generar challenge (debe ser al menos 16 bytes según MDN)
    const challenge = generateChallenge()
    const userIdBuffer = new TextEncoder().encode(userId)

    // Verificar que el userId no esté vacío
    if (userIdBuffer.length === 0) {
      throw new Error('El ID de usuario no puede estar vacío')
    }

    // Crear opciones de credencial según especificación WebAuthn
    // Referencia: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: challenge,
      rp: {
        id: getRPId(),
        name: RP_NAME,
      },
      user: {
        id: userIdBuffer,
        name: userName,
        displayName: userDisplayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256 (ECDSA w/ SHA-256) - recomendado
        { alg: -257, type: 'public-key' }, // RS256 (RSA w/ SHA-256) - alternativa
      ],
      authenticatorSelection: {
        // No especificar authenticatorAttachment para permitir tanto platform como cross-platform
        // Esto permite usar PIN de Windows Hello sin requerir hardware USB
        userVerification: 'preferred', // Preferir verificación del usuario, pero permitir PIN
        requireResidentKey: false, // No requerir resident key (más compatible)
      },
      timeout: TIMEOUT,
      attestation: 'none', // No necesitamos attestation para uso local (más privado)
    }

    // Crear credencial usando la API de WebAuthn
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential

    if (!credential || !credential.response) {
      throw new Error('No se pudo crear la credencial WebAuthn')
    }

    const response = credential.response as AuthenticatorAttestationResponse

    // Extraer información de la credencial
    const credentialId = arrayBufferToBase64Url(credential.rawId)
    const publicKey = arrayBufferToBase64Url(response.getPublicKey() || new ArrayBuffer(0))

    // Generar salt para la clave maestra
    const masterKeySalt = generateMasterKeySalt()
    const masterKeySaltBase64 = arrayBufferToBase64Url(masterKeySalt.buffer)

    const webauthnCredential: WebAuthnCredential = {
      id: credentialId,
      publicKey: publicKey,
      counter: 0,
      createdAt: Date.now(),
      name: credentialName || 'Credencial WebAuthn',
      masterKeySalt: masterKeySaltBase64,
    }

    console.log('[WebAuthn] ✅ Credencial registrada exitosamente')
    return webauthnCredential
  } catch (error) {
    console.error('[WebAuthn] ❌ Error al registrar credencial:', error)
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Registro cancelado por el usuario')
      } else if (error.name === 'InvalidStateError') {
        throw new Error('Ya existe una credencial para este usuario')
      }
      throw new Error(`Error al registrar: ${error.message}`)
    }
    throw error
  }
}

/**
 * Autentica usando una credencial WebAuthn existente
 * @param credentialId - ID de la credencial a usar
 * @param challenge - Challenge para la autenticación (opcional, se genera si no se proporciona)
 * @returns La firma de autenticación y el authenticatorData
 */
export async function authenticateWithWebAuthn(
  credentialId: string,
  challenge?: ArrayBuffer
): Promise<{
  signature: ArrayBuffer
  authenticatorData: ArrayBuffer
  userHandle: ArrayBuffer | null
  credentialId: string
  clientDataJSON: ArrayBuffer
}> {
  if (!isWebAuthnAvailable()) {
    throw new Error('WebAuthn no está disponible en este navegador')
  }

  try {
    // Generar challenge si no se proporciona (debe ser al menos 16 bytes según MDN)
    const challengeToUse = challenge || generateChallenge()
    const credentialIdBuffer = base64UrlToArrayBuffer(credentialId)

    // Crear opciones de autenticación según especificación WebAuthn
    // Referencia: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: challengeToUse,
      allowCredentials: [
        {
          id: credentialIdBuffer,
          type: 'public-key',
          // Priorizar 'internal' para permitir PIN de Windows Hello sin hardware USB
          // 'usb' se incluye como fallback pero no se fuerza
          transports: ['internal', 'usb', 'nfc', 'ble'],
        },
      ],
      timeout: TIMEOUT,
      userVerification: 'preferred', // Preferir verificación, pero permitir PIN sin hardware
      rpId: getRPId(), // Especificar RP ID para mayor seguridad
    }

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential

    if (!assertion || !assertion.response) {
      throw new Error('No se pudo autenticar con WebAuthn')
    }

    const response = assertion.response as AuthenticatorAssertionResponse

    return {
      signature: response.signature,
      authenticatorData: response.authenticatorData,
      userHandle: response.userHandle,
      credentialId: arrayBufferToBase64Url(assertion.rawId),
      clientDataJSON: response.clientDataJSON, // Incluir para verificación completa
    }
  } catch (error) {
    console.error('[WebAuthn] ❌ Error al autenticar:', error)
    if (error instanceof Error) {
      // Manejar errores según especificación WebAuthn
      if (error.name === 'NotAllowedError') {
        throw new Error('Autenticación cancelada por el usuario o timeout')
      } else if (error.name === 'InvalidStateError') {
        throw new Error('Credencial no encontrada o inválida')
      } else if (error.name === 'NotSupportedError') {
        throw new Error('WebAuthn no está soportado en este dispositivo')
      } else if (error.name === 'SecurityError') {
        throw new Error('Error de seguridad: el contexto no es seguro (requiere HTTPS)')
      } else if (error.name === 'UnknownError') {
        throw new Error('Error desconocido del autenticador')
      }
      throw new Error(`Error al autenticar: ${error.message}`)
    }
    throw error
  }
}

/**
 * Deriva una clave de encriptación desde la firma WebAuthn
 * Esto permite usar WebAuthn como alternativa a la contraseña
 * @param signature - Firma de WebAuthn
 * @param authenticatorData - Datos del autenticador
 * @param salt - Salt adicional (opcional)
 */
export async function deriveKeyFromWebAuthn(
  signature: ArrayBuffer,
  authenticatorData: ArrayBuffer,
  salt: Uint8Array
): Promise<CryptoKey> {
  // IMPORTANTE: La firma cambia cada vez (porque el challenge es diferente),
  // pero el authenticatorData es más estable. Usamos solo los primeros 37 bytes
  // del authenticatorData que contienen: RP ID hash (32 bytes) + flags (1 byte) + sign count (4 bytes)
  // Estos bytes son relativamente estables entre autenticaciones.
  const authDataStable = new Uint8Array(authenticatorData).slice(0, 37)
  
  // Combinar authenticatorData estable + salt para crear material de clave consistente
  const combined = new Uint8Array(authDataStable.length + salt.length)
  combined.set(authDataStable, 0)
  combined.set(salt, authDataStable.length)

  // Hacer hash del material combinado para obtener material de clave consistente
  const hashedMaterial = await crypto.subtle.digest('SHA-256', combined)

  // Importar como clave base para derivación PBKDF2
  const baseKey = await crypto.subtle.importKey(
    'raw',
    hashedMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derivar clave AES-GCM usando PBKDF2 con el salt fijo
  // Usamos el mismo salt para la derivación final para asegurar consistencia
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Verifica una firma WebAuthn
 * Según la especificación WebAuthn, el mensaje a verificar es:
 * SHA256(authenticatorData || SHA256(clientDataJSON))
 * 
 * Referencia: https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
 * 
 * @param signature - Firma a verificar
 * @param authenticatorData - Datos del autenticador
 * @param clientDataJSON - JSON del cliente (debe contener el challenge)
 * @param publicKey - Clave pública de la credencial (en formato SPKI)
 */
export async function verifyWebAuthnSignature(
  signature: ArrayBuffer,
  authenticatorData: ArrayBuffer,
  clientDataJSON: ArrayBuffer,
  publicKey: string
): Promise<boolean> {
  try {
    // Importar la clave pública desde formato SPKI
    const publicKeyBuffer = base64UrlToArrayBuffer(publicKey)
    
    // Intentar importar como ECDSA primero (algoritmo más común)
    let key: CryptoKey
    try {
      key = await crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        false,
        ['verify']
      )
    } catch {
      // Si falla, intentar como RSA
      key = await crypto.subtle.importKey(
        'spki',
        publicKeyBuffer,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['verify']
      )
    }
    
    // Construir el mensaje a verificar según especificación WebAuthn:
    // SHA256(authenticatorData || SHA256(clientDataJSON))
    const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataJSON)
    const message = new Uint8Array(authenticatorData.byteLength + clientDataHash.byteLength)
    message.set(new Uint8Array(authenticatorData), 0)
    message.set(new Uint8Array(clientDataHash), authenticatorData.byteLength)

    // Verificar la firma
    const algorithm = key.algorithm.name === 'ECDSA' 
      ? { name: 'ECDSA', hash: 'SHA-256' }
      : { name: 'RSASSA-PKCS1-v1_5' }
    
    const isValid = await crypto.subtle.verify(
      algorithm,
      key,
      signature,
      message
    )

    return isValid
  } catch (error) {
    console.error('[WebAuthn] Error al verificar firma:', error)
    return false
  }
}

