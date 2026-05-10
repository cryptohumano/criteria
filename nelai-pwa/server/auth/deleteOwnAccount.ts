/**
 * Eliminación de la cuenta del usuario autenticado y de su organización (solo si es el único miembro).
 */
import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'
import type { AuthSession } from './types.js'
import { HttpError } from './httpError.js'
import { authSessions, usersByEmail, type MemoryUserRow } from './memoryDevStore.js'

export async function prismaDeleteOwnAccount(
  prisma: PrismaClient,
  auth: AuthSession,
  password?: string | null
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      organization: {
        include: {
          users: { select: { id: true } },
        },
      },
    },
  })
  if (!user) {
    throw new HttpError('Usuario no encontrado', 404)
  }

  if (user.passwordHash) {
    const pw = String(password ?? '').trim()
    if (!pw) {
      throw new HttpError('Indica tu contraseña para confirmar la eliminación.', 400)
    }
    if (!(await bcrypt.compare(pw, user.passwordHash))) {
      throw new HttpError('Contraseña incorrecta.', 401)
    }
  }

  if (user.organization.users.length > 1) {
    throw new HttpError(
      'Tu organización tiene más de un usuario. Solo puedes eliminar la cuenta cuando eres el único miembro. Contacta al administrador del equipo.',
      403
    )
  }

  const orgId = user.organizationId

  await prisma.$transaction(async (tx) => {
    await tx.documentRedaction.deleteMany({ where: { organizationId: orgId } })
    await tx.organization.delete({ where: { id: orgId } })
  })
}

export async function memoryDeleteOwnAccount(auth: AuthSession, password?: string | null): Promise<void> {
  let email: string | null = null
  let row: MemoryUserRow | null = null
  for (const [em, r] of usersByEmail) {
    if (r.userId === auth.userId) {
      email = em
      row = r
      break
    }
  }
  if (!email || !row) {
    throw new HttpError('Usuario no encontrado', 404)
  }
  const pw = String(password ?? '').trim()
  if (!pw || !(await bcrypt.compare(pw, row.passwordHash))) {
    throw new HttpError('Contraseña incorrecta o ausente.', 401)
  }
  usersByEmail.delete(email)
  for (const token of [...authSessions.keys()]) {
    const s = authSessions.get(token)
    if (s?.userId === auth.userId) {
      authSessions.delete(token)
    }
  }
}
