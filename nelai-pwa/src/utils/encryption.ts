/**
 * Utilidades de encriptación usando Web Crypto API
 * Encripta/desencripta datos usando una contraseña del usuario
 */

import { u8aToHex, hexToU8a } from '@polkadot/util'

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits para GCM
const SALT_LENGTH = 32
const ITERATIONS = 100000 // PBKDF2 iterations

/**
 * Verifica que Web Crypto API esté disponible
 */
function ensureCryptoAvailable(): void {
  if (typeof crypto === 'undefined') {
    throw new Error('Web Crypto API no está disponible. Asegúrate de usar HTTPS o localhost.')
  }
  
  if (!crypto.subtle) {
    throw new Error('crypto.subtle no está disponible. Asegúrate de usar HTTPS o localhost.')
  }
  
  if (!crypto.getRandomValues) {
    throw new Error('crypto.getRandomValues no está disponible.')
  }
}

/**
 * Deriva una clave de encriptación desde una contraseña usando PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  ensureCryptoAvailable()
  
  // Convertir contraseña a bytes
  const passwordBytes = new TextEncoder().encode(password)
  
  // Importar la contraseña como clave base para PBKDF2
  const baseKey = await crypto.subtle!.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  )
  
  // Derivar la clave AES-GCM usando PBKDF2
  return crypto.subtle!.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Genera bytes aleatorios usando Web Crypto API
 */
function randomBytes(length: number): Uint8Array {
  ensureCryptoAvailable()
  return crypto.getRandomValues!(new Uint8Array(length))
}

/**
 * Encripta datos usando AES-GCM
 */
export async function encrypt(plaintext: string, password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  
  const key = await deriveKey(password, salt)
  const data = new TextEncoder().encode(plaintext)
  
  const encrypted = await crypto.subtle!.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    data
  )
  
  // Combinar salt, iv y datos encriptados
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)
  
  return u8aToHex(combined)
}

/**
 * Desencripta datos usando AES-GCM
 */
export async function decrypt(encryptedHex: string, password: string): Promise<string> {
  const combined = hexToU8a(encryptedHex)
  
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH)
  
  const key = await deriveKey(password, salt)
  
  try {
    ensureCryptoAvailable()
    const decrypted = await crypto.subtle!.decrypt(
      {
        name: ALGORITHM,
        iv: iv,
      },
      key,
      encrypted
    )
    
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    throw new Error('Contraseña incorrecta o datos corruptos')
  }
}

/**
 * Verifica si una contraseña es correcta intentando desencriptar
 */
export async function verifyPassword(encryptedHex: string, password: string): Promise<boolean> {
  try {
    await decrypt(encryptedHex, password)
    return true
  } catch {
    return false
  }
}

/**
 * Desencripta datos usando una CryptoKey directamente (para WebAuthn)
 */
export async function decryptWithKey(encryptedHex: string, key: CryptoKey): Promise<string> {
  const { hexToU8a } = await import('@polkadot/util')
  const combined = hexToU8a(encryptedHex)
  
  const SALT_LENGTH = 32
  const IV_LENGTH = 12
  
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH)
  
  try {
    ensureCryptoAvailable()
    const decrypted = await crypto.subtle!.decrypt(
      {
        name: ALGORITHM,
        iv: iv,
      },
      key,
      encrypted
    )
    
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    throw new Error('Error al desencriptar con clave: ' + (error instanceof Error ? error.message : String(error)))
  }
}

