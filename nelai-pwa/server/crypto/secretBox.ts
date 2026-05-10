import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const IV_LEN = 12
const TAG_LEN = 16
const ALGO = 'aes-256-gcm' as const

function platformLlmSecretRaw(): string | undefined {
  return (
    process.env.CRITERIA_PLATFORM_LLM_SECRET?.trim() ||
    process.env.NELAI_PLATFORM_LLM_SECRET?.trim()
  )
}

function deriveKey(): Buffer {
  const s = platformLlmSecretRaw()
  if (!s || s.length < 16) {
    throw new Error(
      'CRITERIA_PLATFORM_LLM_SECRET (o legacy NELAI_PLATFORM_LLM_SECRET) debe tener al menos 16 caracteres',
    )
  }
  return createHash('sha256').update(s, 'utf8').digest()
}

/** Necesaria para cifrar/descifrar claves almacenadas en BD. */
export function isPlatformLlmSecretConfigured(): boolean {
  const s = platformLlmSecretRaw()
  return !!s && s.length >= 16
}

export function encryptSecret(plain: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_LEN)
  const c = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  const tag = c.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

export function decryptSecret(stored: string): string {
  const key = deriveKey()
  const buf = Buffer.from(stored, 'base64url')
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('payload cifrado inválido')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const enc = buf.subarray(IV_LEN + TAG_LEN)
  const d = createDecipheriv(ALGO, key, iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}
