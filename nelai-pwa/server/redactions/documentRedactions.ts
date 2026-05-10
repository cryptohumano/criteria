import type { PrismaClient } from '@prisma/client'

import { decryptSecret, encryptSecret, isPlatformLlmSecretConfigured } from '../crypto/secretBox.js'
import { HttpError } from '../auth/httpError.js'
import type { AuthSession } from '../auth/types.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any

function db(prisma: PrismaClient) {
  return (prisma as P).documentRedaction as {
    create: (a: {
      data: {
        organizationId: string
        userId: string
        docId: string
        placeholder: string
        originalEnc: string
      }
      select?: { id?: boolean; placeholder?: boolean; createdAt?: boolean }
    }) => Promise<{ id: string; placeholder: string; createdAt: Date }>
    findMany: (a: {
      where: { organizationId: string; docId: string; restoredAt?: null }
      orderBy: { createdAt: 'desc' }
      take?: number
      select: { id: boolean; placeholder: boolean; createdAt: boolean; originalEnc: boolean }
    }) => Promise<{ id: string; placeholder: string; createdAt: Date; originalEnc: string }[]>
    update: (a: {
      where: { id: string }
      data: { restoredAt: Date }
      select?: { id?: boolean }
    }) => Promise<{ id: string }>
    findFirst: (a: {
      where: { id: string; organizationId: string; docId: string; restoredAt?: null }
      select: { id: boolean; placeholder: boolean; originalEnc: boolean }
    }) => Promise<{ id: string; placeholder: string; originalEnc: string } | null>
  }
}

export type RedactionRow = {
  id: string
  placeholder: string
  createdAt: string
}

export async function createRedaction(
  prisma: PrismaClient | null,
  session: AuthSession,
  docId: string,
  placeholder: string,
  original: string,
): Promise<RedactionRow> {
  if (!prisma) throw new HttpError('Base de datos no configurada (DATABASE_URL).', 503)
  if (!isPlatformLlmSecretConfigured()) {
    throw new HttpError(
      'Configura CRITERIA_PLATFORM_LLM_SECRET (≥16; legacy NELAI_PLATFORM_LLM_SECRET) para cifrar redacciones.',
      503,
    )
  }
  const originalEnc = encryptSecret(original)
  const row = await db(prisma).create({
    data: {
      organizationId: session.organizationId,
      userId: session.userId,
      docId,
      placeholder,
      originalEnc,
    },
    select: { id: true, placeholder: true, createdAt: true },
  })
  return { id: row.id, placeholder: row.placeholder, createdAt: row.createdAt.toISOString() }
}

export async function listRedactions(
  prisma: PrismaClient | null,
  session: AuthSession,
  docId: string,
): Promise<RedactionRow[]> {
  if (!prisma) throw new HttpError('Base de datos no configurada (DATABASE_URL).', 503)
  const rows = await db(prisma).findMany({
    where: { organizationId: session.organizationId, docId, restoredAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, placeholder: true, createdAt: true, originalEnc: true },
  })
  return rows.map((r) => ({ id: r.id, placeholder: r.placeholder, createdAt: r.createdAt.toISOString() }))
}

export async function restoreRedaction(
  prisma: PrismaClient | null,
  session: AuthSession,
  docId: string,
  redactionId: string,
): Promise<{ id: string; placeholder: string; original: string }> {
  if (!prisma) throw new HttpError('Base de datos no configurada (DATABASE_URL).', 503)
  if (!isPlatformLlmSecretConfigured()) {
    throw new HttpError(
      'Configura CRITERIA_PLATFORM_LLM_SECRET (≥16; legacy NELAI_PLATFORM_LLM_SECRET) para descifrar redacciones.',
      503,
    )
  }
  const row = await db(prisma).findFirst({
    where: { id: redactionId, organizationId: session.organizationId, docId, restoredAt: null },
    select: { id: true, placeholder: true, originalEnc: true },
  })
  if (!row) throw new HttpError('Redacción no encontrada o ya restaurada.', 404)
  const original = decryptSecret(row.originalEnc)
  await db(prisma).update({ where: { id: row.id }, data: { restoredAt: new Date() }, select: { id: true } })
  return { id: row.id, placeholder: row.placeholder, original }
}

