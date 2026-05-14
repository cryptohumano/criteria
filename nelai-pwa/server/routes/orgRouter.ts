/**
 * Invitaciones a organización tipo equipo + vista previa pública del token.
 */
import { Router, type RequestHandler, type Request, type Response } from 'express'
import type { OrgMemberRole } from '@prisma/client'
import { getPrisma } from '../db.js'
import { getHttpStatus } from '../auth/httpError.js'
import {
  createOrganizationInvite,
  getInvitePreview,
  prismaApplyOrganizationInvite,
} from '../org/orgInviteService.js'
import {
  listOrganizationMembersWithLlmUsage,
  removeOrganizationMember,
} from '../org/orgMemberService.js'

function getFrontendOrigin(): string {
  return (process.env.AUTH_FRONTEND_ORIGIN || 'http://localhost:5173').trim().replace(/\/$/, '')
}

export function createOrgRouter(requireUser: RequestHandler): Router {
  const r = Router()

  r.get('/invite-preview', async (req: Request, res: Response) => {
    const raw = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    if (!raw) {
      return res.status(400).json({ error: 'Falta token' })
    }
    try {
      const prisma = await getPrisma()
      if (!prisma) return res.status(503).json({ error: 'Base de datos no configurada' })
      const preview = await getInvitePreview(prisma, raw)
      if (!preview) {
        return res.status(404).json({ error: 'Invitación no encontrada o caducada' })
      }
      return res.json(preview)
    } catch (e: unknown) {
      console.error('[org/invite-preview]', e)
      return res.status(500).json({ error: 'Error al validar la invitación' })
    }
  })

  r.use(requireUser)

  r.get('/members', async (req: Request, res: Response) => {
    try {
      const prisma = await getPrisma()
      if (!prisma) return res.status(503).json({ error: 'Base de datos no configurada' })
      const { members, unattributedLlmTokensThisPeriod } = await listOrganizationMembersWithLlmUsage(
        prisma,
        req.auth!.organizationId,
        req.auth!.plan,
      )
      return res.json({ members, unattributedLlmTokensThisPeriod })
    } catch (e: unknown) {
      console.error('[org/members]', e)
      return res.status(500).json({ error: 'Error al listar miembros' })
    }
  })

  r.delete('/members/:userId', async (req: Request, res: Response) => {
    const targetUserId = String(req.params.userId || '').trim()
    if (!targetUserId) {
      return res.status(400).json({ error: 'Falta el identificador del usuario' })
    }
    try {
      const prisma = await getPrisma()
      if (!prisma) return res.status(503).json({ error: 'Base de datos no configurada' })
      await removeOrganizationMember(prisma, {
        organizationId: req.auth!.organizationId,
        actorUserId: req.auth!.userId,
        actorOrgRole: req.auth!.orgRole as OrgMemberRole,
        targetUserId,
      })
      return res.json({ ok: true })
    } catch (e: unknown) {
      const status = getHttpStatus(e)
      console.error('[org/members/:userId]', e)
      return res.status(status).json({ error: e instanceof Error ? e.message : 'No se pudo expulsar al miembro' })
    }
  })

  /**
   * Usuario ya autenticado: aplica el token de invitación y mueve la cuenta a la org invitada
   * (misma lógica que login con `inviteToken`, sin volver a pedir contraseña).
   */
  r.post('/invite/accept', async (req: Request, res: Response) => {
    const raw = String((req.body as { token?: unknown })?.token ?? '').trim()
    if (!raw) {
      return res.status(400).json({ error: 'Falta el token de invitación' })
    }
    try {
      const prisma = await getPrisma()
      if (!prisma) return res.status(503).json({ error: 'Base de datos no configurada' })
      const a = req.auth!
      await prismaApplyOrganizationInvite(prisma, {
        user: {
          id: a.userId,
          organizationId: a.organizationId,
          orgRole: a.orgRole as OrgMemberRole,
        },
        rawInviteToken: raw,
      })
      return res.json({ ok: true })
    } catch (e: unknown) {
      const status = getHttpStatus(e)
      console.error('[org/invite/accept]', e)
      return res.status(status).json({ error: e instanceof Error ? e.message : 'No se pudo aceptar la invitación' })
    }
  })

  r.post('/invites', async (req: Request, res: Response) => {
    const role = req.auth!.orgRole
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Solo el propietario o un administrador puede invitar miembros.' })
    }
    try {
      const prisma = await getPrisma()
      if (!prisma) return res.status(503).json({ error: 'Base de datos no configurada' })
      const { rawToken, expiresAt } = await createOrganizationInvite(prisma, {
        organizationId: req.auth!.organizationId,
        invitedByUserId: req.auth!.userId,
      })
      const base = getFrontendOrigin()
      const joinUrl = `${base}/register?invite=${encodeURIComponent(rawToken)}`
      return res.status(201).json({
        token: rawToken,
        expiresAt: expiresAt.toISOString(),
        joinUrl,
      })
    } catch (e: unknown) {
      const status = getHttpStatus(e)
      console.error('[org/invites]', e)
      return res.status(status).json({ error: e instanceof Error ? e.message : 'Error al crear invitación' })
    }
  })

  return r
}
