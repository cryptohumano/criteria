import { Router, type RequestHandler } from 'express'
import { getPrisma } from '../db.js'
import { getLlmUsageForSession } from '../usage/llmUsage.js'

/**
 * Rutas bajo `/api/usage` (consumo LLM).
 * Montado explícito para evitar sombras con otros middlewares.
 */
export function createUsageRouter(requireUser: RequestHandler): Router {
  const r = Router()
  r.use(requireUser)

  r.get('/llm', async (req, res) => {
    const s = req.auth!
    try {
      const prisma = await getPrisma()
      const payload = await getLlmUsageForSession(prisma, s)
      return res.json(payload)
    } catch (e: unknown) {
      console.error('[usage/llm]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error al leer uso' })
    }
  })

  return r
}
