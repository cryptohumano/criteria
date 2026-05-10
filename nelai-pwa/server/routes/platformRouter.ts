/**
 * Rutas bajo `/api/platform` (superadmin). Router separado para registro explícito.
 */
import { Router, type RequestHandler } from 'express'
import { HttpError } from '../auth/httpError.js'
import { getPrisma } from '../db.js'
import {
  deletePlatformGeminiKey,
  getPlatformLlmCredentialsStatus,
  setPlatformGeminiKey,
} from '../platform-llm-creds.js'
import { getPlatformOrganizations, getPlatformStats, getPlatformUsers } from '../platform-api.js'

export function createPlatformRouter(superadminGuard: RequestHandler): Router {
  const r = Router()

  r.get('/health', superadminGuard, (_req, res) => {
    res.json({ ok: true, platform: 'nelai' })
  })

  r.get('/stats', superadminGuard, async (_req, res) => {
    let prisma = null as Awaited<ReturnType<typeof getPrisma>>
    try {
      prisma = await getPrisma()
    } catch (e) {
      console.error('[platform/stats]', e)
      return res.status(503).json({ error: 'Base de datos no disponible' })
    }
    if (!prisma) {
      return res.status(503).json({ error: 'Configura DATABASE_URL para métricas de plataforma' })
    }
    try {
      const stats = await getPlatformStats(prisma)
      return res.json({ stats })
    } catch (e: unknown) {
      console.error('[platform/stats]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error al leer estadísticas' })
    }
  })

  r.get('/organizations', superadminGuard, async (req, res) => {
    let prisma = null as Awaited<ReturnType<typeof getPrisma>>
    try {
      prisma = await getPrisma()
    } catch (e) {
      console.error('[platform/organizations]', e)
      return res.status(503).json({ error: 'Base de datos no disponible' })
    }
    if (!prisma) {
      return res.status(503).json({ error: 'Configura DATABASE_URL' })
    }
    try {
      const out = await getPlatformOrganizations(prisma, {
        take: req.query.take,
        skip: req.query.skip,
      })
      return res.json(out)
    } catch (e: unknown) {
      console.error('[platform/organizations]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error al listar organizaciones' })
    }
  })

  r.get('/llm-credentials', superadminGuard, async (_req, res) => {
    try {
      const prisma = await getPrisma()
      const status = await getPlatformLlmCredentialsStatus(prisma)
      return res.json(status)
    } catch (e: unknown) {
      console.error('[platform/llm-credentials]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error' })
    }
  })

  r.put('/llm-credentials/gemini', superadminGuard, async (req, res) => {
    const auth = req.auth!
    let prisma = null as Awaited<ReturnType<typeof getPrisma>>
    try {
      prisma = await getPrisma()
    } catch (e) {
      console.error('[platform/llm-credentials/gemini]', e)
      return res.status(503).json({ error: 'Base de datos no disponible' })
    }
    if (!prisma) {
      return res.status(503).json({ error: 'Configura DATABASE_URL' })
    }
    const body = req.body as { apiKey?: string }
    try {
      await setPlatformGeminiKey(prisma, body.apiKey ?? '', auth.userId)
      return res.json({ ok: true })
    } catch (e: unknown) {
      if (e instanceof HttpError) {
        return res.status(e.statusCode).json({ error: e.message })
      }
      console.error('[platform/llm-credentials/gemini]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error al guardar' })
    }
  })

  r.delete('/llm-credentials/gemini', superadminGuard, async (_req, res) => {
    let prisma = null as Awaited<ReturnType<typeof getPrisma>>
    try {
      prisma = await getPrisma()
    } catch (e) {
      console.error('[platform/llm-credentials/gemini delete]', e)
      return res.status(503).json({ error: 'Base de datos no disponible' })
    }
    if (!prisma) {
      return res.status(503).json({ error: 'Configura DATABASE_URL' })
    }
    try {
      await deletePlatformGeminiKey(prisma)
      return res.json({ ok: true })
    } catch (e: unknown) {
      console.error('[platform/llm-credentials/gemini delete]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error' })
    }
  })

  r.get('/users', superadminGuard, async (req, res) => {
    let prisma = null as Awaited<ReturnType<typeof getPrisma>>
    try {
      prisma = await getPrisma()
    } catch (e) {
      console.error('[platform/users]', e)
      return res.status(503).json({ error: 'Base de datos no disponible' })
    }
    if (!prisma) {
      return res.status(503).json({ error: 'Configura DATABASE_URL' })
    }
    try {
      const out = await getPlatformUsers(prisma, {
        take: req.query.take,
        skip: req.query.skip,
      })
      return res.json(out)
    } catch (e: unknown) {
      console.error('[platform/users]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error al listar usuarios' })
    }
  })

  return r
}
