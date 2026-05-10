import { getPrisma } from '../db.js'
import { decryptSecret } from '../crypto/secretBox.js'
import { platformLlmCredentialDb } from '../prismaPlatformLlm.js'

const PROVIDER = 'gemini' as const

/**
 * Clave de Gemini para el proxy: prioridad 1) fila cifrada en `platform_llm_credentials`,
 * 2) variable `GEMINI_API_KEY` en el proceso.
 */
export async function resolveServerGeminiApiKey(): Promise<string | null> {
  const fromEnv = process.env.GEMINI_API_KEY?.trim() || null
  try {
    const prisma = await getPrisma()
    if (prisma) {
      const row = await platformLlmCredentialDb(prisma).findUnique({
        where: { provider: PROVIDER },
      })
      if (row?.secretEnc) {
        try {
          return decryptSecret(row.secretEnc)
        } catch (e) {
          console.error(
            '[LLM] No se pudo descifrar la clave de Gemini en BD. Revisa CRITERIA_PLATFORM_LLM_SECRET (o legacy NELAI_PLATFORM_LLM_SECRET).',
            e,
          )
        }
      }
    }
  } catch {
    // Prisma no disponible
  }
  return fromEnv
}

export function hasEnvGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim()
}
