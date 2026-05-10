/**
 * Prisma ORM 7 + adaptador pg (requiere Node >= 20.19).
 * Import dinámico: el cliente vive en `node_modules` (`@prisma/client`).
 *
 * `.env` se resuelve respecto a la raíz del PWA (`server/..`), no solo `process.cwd()`.
 */
import { PrismaPg } from '@prisma/adapter-pg'
import type { PrismaClient } from '@prisma/client'
import { NELAI_PWA_ROOT } from './loadEnv.js'

const _root = NELAI_PWA_ROOT

let client: PrismaClient | null = null

export async function getPrisma(): Promise<PrismaClient | null> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[getPrisma] DATABASE_URL no definida. Se espera .env en',
        _root,
        '— o el IDE está lanzando node con cwd distinto.',
      )
    }
    return null
  }
  if (!client) {
    try {
      const { PrismaClient: PC } = await import('@prisma/client')
      const adapter = new PrismaPg({ connectionString: url })
      client = new PC({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
    } catch (e) {
      console.error(
        '[getPrisma] Falló el import de @prisma/client. Ejecuta `yarn prisma:generate` en la raíz del PWA.',
        e,
      )
      throw e
    }
  }
  return client
}

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL?.trim()
}
