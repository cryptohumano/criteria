/**
 * Estado y CRUD de claves de proveedor IA a nivel plataforma (superadmin).
 */
import type { PrismaClient } from '@prisma/client'
import { HttpError } from './auth/httpError.js'
import { encryptSecret, isPlatformLlmSecretConfigured } from './crypto/secretBox.js'
import { hasEnvGeminiKey } from './llm/resolveServerGeminiKey.js'
import { platformLlmCredentialDb } from './prismaPlatformLlm.js'

const PROVIDER_GEMINI = 'gemini'

export type LlmCredentialsStatus = {
  gemini: {
    /** Origen que usará el servidor: BD tiene prioridad sobre env. */
    activeSource: 'database' | 'environment' | 'none'
    last4: string | null
    hasEnvFallback: boolean
  }
  /** Puede el superadmin guardar en BD (clave maestra en env). */
  databaseEncryptionReady: boolean
}

export async function getPlatformLlmCredentialsStatus(
  prisma: PrismaClient | null
): Promise<LlmCredentialsStatus> {
  let row: { last4: string | null; secretEnc: string } | null = null
  if (prisma) {
    row = await platformLlmCredentialDb(prisma).findUnique({
      where: { provider: PROVIDER_GEMINI },
      select: { last4: true, secretEnc: true },
    })
  }
  const hasDb = !!(row && row.secretEnc)
  const hasEnv = hasEnvGeminiKey()
  const activeSource: LlmCredentialsStatus['gemini']['activeSource'] = hasDb
    ? 'database'
    : hasEnv
      ? 'environment'
      : 'none'
  return {
    gemini: {
      activeSource,
      last4: row?.last4 ?? null,
      hasEnvFallback: hasEnv,
    },
    databaseEncryptionReady: isPlatformLlmSecretConfigured(),
  }
}

export async function setPlatformGeminiKey(
  prisma: PrismaClient,
  rawKey: string,
  superadminUserId: string
): Promise<void> {
  if (!isPlatformLlmSecretConfigured()) {
    throw new HttpError(
      'Configura CRITERIA_PLATFORM_LLM_SECRET (≥16 caracteres; legacy NELAI_PLATFORM_LLM_SECRET) en el servidor para guardar claves cifradas en la base de datos.',
      503,
    )
  }
  const k = String(rawKey).trim()
  if (!k) {
    throw new HttpError('La clave API no puede estar vacía', 400)
  }
  const last4 = k.length >= 4 ? k.slice(-4) : '****'
  const secretEnc = encryptSecret(k)
  await platformLlmCredentialDb(prisma).upsert({
    where: { provider: PROVIDER_GEMINI },
    create: {
      provider: PROVIDER_GEMINI,
      secretEnc,
      last4,
      updatedByUserId: superadminUserId,
    },
    update: { secretEnc, last4, updatedByUserId: superadminUserId },
  })
}

export async function deletePlatformGeminiKey(prisma: PrismaClient): Promise<void> {
  try {
    await platformLlmCredentialDb(prisma).delete({ where: { provider: PROVIDER_GEMINI } })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'P2025') return
    throw e
  }
}
