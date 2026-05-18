import { Router, type RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'
import { padIdFromDocId } from '../etherpad/padId.js'
import {
  EtherpadApiError,
  createAuthorIfNotExistsFor,
  createGroupIfNotExistsFor,
  createSession,
  ensureGroupPad,
  getPadText,
  setPadText,
} from '../etherpad/etherpadApi.js'
import { HttpError } from '../auth/httpError.js'
import { assertTrialActiveOrPaid } from '../usage/orgEntitlements.js'
import { createRedaction, listRedactions, restoreRedaction } from '../redactions/documentRedactions.js'
import { getPrisma } from '../db.js'

type ProposalRow = {
  userId: string
  docId: string
  padId: string
  before: string
  after: string
  createdAt: number
}

const proposals = new Map<string, ProposalRow>()
const PROPOSAL_TTL_MS = 60 * 60 * 1000

function pruneProposals() {
  const now = Date.now()
  for (const [id, row] of proposals) {
    if (now - row.createdAt > PROPOSAL_TTL_MS) proposals.delete(id)
  }
}

function getEtherpadConfig() {
  const baseUrl = process.env.ETHERPAD_BASE_URL?.trim()
  const apiKey = process.env.ETHERPAD_API_KEY?.trim()
  const publicUrl =
    (process.env.ETHERPAD_PUBLIC_URL || baseUrl || '').trim() || '/pad'
  return { baseUrl, apiKey, publicUrl }
}

/** Encadena llamadas Etherpad por organización para evitar dos grupos distintos en paralelo (session vs content). */
const etherpadOrgTail = new Map<string, Promise<unknown>>()

function runEtherpadForOrg<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
  const prev = etherpadOrgTail.get(organizationId) ?? Promise.resolve()
  const next = prev.catch(() => {}).then(() => fn()) as Promise<T>
  etherpadOrgTail.set(
    organizationId,
    next.then(() => undefined).catch(() => undefined),
  )
  return next
}

async function resolveGroupPadIdForDoc(
  baseUrl: string,
  apiKey: string,
  organizationId: string,
  docId: string,
): Promise<{ groupID: string; padName: string; padId: string }> {
  return runEtherpadForOrg(organizationId, async () => {
    const groupID = await createGroupIfNotExistsFor(baseUrl, apiKey, organizationId)
    const padName = padIdFromDocId(docId)
    const padId = await ensureGroupPad(baseUrl, apiKey, groupID, padName, ' ')
    return { groupID, padName, padId }
  })
}

export function createPadsRouter(requireUser: RequestHandler) {
  const r = Router({ mergeParams: true })
  r.use(requireUser)
  r.use((req, res, next) => {
    try {
      assertTrialActiveOrPaid(req.auth!)
      next()
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.statusCode).json({ error: e.message })
      next(e)
    }
  })
  // Resolver Prisma en demanda (lazy) para no romper modo sin BD.
  const getDb = () => getPrisma()

  r.post('/:docId/pad/session', async (req, res) => {
    const { baseUrl, apiKey, publicUrl } = getEtherpadConfig()
    if (!baseUrl || !apiKey || !publicUrl) {
      return res.status(503).json({
        error:
          'Etherpad no configurado. Define ETHERPAD_BASE_URL, ETHERPAD_API_KEY y ETHERPAD_PUBLIC_URL (ver .env.example).',
      })
    }

    const docId = String(req.params.docId || '').trim()
    if (!docId) return res.status(400).json({ error: 'docId inválido' })

    try {
      // Aislamiento por organización: todos los pads son group pads.
      const { groupID, padId } = await resolveGroupPadIdForDoc(
        baseUrl,
        apiKey,
        req.auth!.organizationId,
        docId,
      )
      const authorID = await createAuthorIfNotExistsFor(
        baseUrl,
        apiKey,
        req.auth!.userId,
        req.auth!.displayName || req.auth!.email,
      )

      // Cookie de sesión (Etherpad la busca como `sessionID`).
      const validUntil = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
      const sessionID = await createSession(baseUrl, apiKey, groupID, authorID, validUntil)
      const isProd = process.env.NODE_ENV === 'production'
      res.cookie('sessionID', sessionID, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        path: '/',
      })

      const embedBase = publicUrl.replace(/\/+$/, '')
      // Forzar idioma del UI en embeds para evitar warnings por variantes regionales (p. ej. es-MX)
      // y mantener consistente la experiencia dentro del iframe.
      const lang = (process.env.ETHERPAD_LANG || 'es').trim()
      const padPath = `${embedBase}/p/${encodeURIComponent(padId)}`
      const padUrl = lang ? `${padPath}?lang=${encodeURIComponent(lang)}` : padPath

      return res.json({
        padId,
        padUrl,
        expiresAt: null as string | null,
      })
    } catch (e: unknown) {
      const msg = e instanceof EtherpadApiError ? e.message : e instanceof Error ? e.message : String(e)
      console.error('[pads/session]', e)
      return res.status(502).json({ error: `Etherpad: ${msg}` })
    }
  })

  r.get('/:docId/pad/content', async (req, res) => {
    const { baseUrl, apiKey } = getEtherpadConfig()
    if (!baseUrl || !apiKey) {
      return res.status(503).json({
        error:
          'Etherpad no configurado. Define ETHERPAD_BASE_URL y ETHERPAD_API_KEY (ver .env.example).',
      })
    }

    const docId = String(req.params.docId || '').trim()
    if (!docId) return res.status(400).json({ error: 'docId inválido' })

    const format = String(req.query.format || 'text').toLowerCase()
    if (format !== 'text') {
      return res.status(400).json({ error: 'Por ahora solo format=text (HTML en fase posterior).' })
    }

    try {
      const { padId } = await resolveGroupPadIdForDoc(baseUrl, apiKey, req.auth!.organizationId, docId)
      const text = await getPadText(baseUrl, apiKey, padId)
      res.json({ padId, format: 'text', content: text })
    } catch (e: unknown) {
      const msg = e instanceof EtherpadApiError ? e.message : e instanceof Error ? e.message : String(e)
      console.error('[pads/content]', e)
      return res.status(502).json({ error: `Etherpad: ${msg}` })
    }
  })

  // Export Markdown (ep_markdown)
  r.get('/:docId/pad/export/markdown', async (req, res) => {
    const { baseUrl, apiKey } = getEtherpadConfig()
    if (!baseUrl || !apiKey) {
      return res.status(503).json({
        error:
          'Etherpad no configurado. Define ETHERPAD_BASE_URL y ETHERPAD_API_KEY (ver .env.example).',
      })
    }

    const docId = String(req.params.docId || '').trim()
    if (!docId) return res.status(400).json({ error: 'docId inválido' })

    try {
      const { padId } = await resolveGroupPadIdForDoc(baseUrl, apiKey, req.auth!.organizationId, docId)
      const url = new URL(`${baseUrl.replace(/\/+$/, '')}/p/${encodeURIComponent(padId)}/export/markdown`)
      const r2 = await fetch(url.toString(), { method: 'GET' })
      const body = await r2.text().catch(() => '')
      if (!r2.ok) {
        return res.status(502).json({
          error: `Etherpad export markdown falló (HTTP ${r2.status}).`,
          details: body.slice(0, 200),
        })
      }

      const safeId = docId.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'documento'
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${safeId}.md"`)
      return res.status(200).send(body)
    } catch (e: unknown) {
      const msg = e instanceof EtherpadApiError ? e.message : e instanceof Error ? e.message : String(e)
      console.error('[pads/export/markdown]', e)
      return res.status(502).json({ error: `Etherpad: ${msg}` })
    }
  })

  r.post('/:docId/pad/set-text', async (req, res) => {
    const { baseUrl, apiKey } = getEtherpadConfig()
    if (!baseUrl || !apiKey) {
      return res.status(503).json({
        error:
          'Etherpad no configurado. Define ETHERPAD_BASE_URL y ETHERPAD_API_KEY (ver .env.example).',
      })
    }
    const docId = String(req.params.docId || '').trim()
    if (!docId) return res.status(400).json({ error: 'docId inválido' })
    const text = String((req.body as { text?: unknown })?.text ?? '')
    try {
      const { padId } = await resolveGroupPadIdForDoc(baseUrl, apiKey, req.auth!.organizationId, docId)
      await setPadText(baseUrl, apiKey, padId, text)
      res.json({ ok: true, padId })
    } catch (e: unknown) {
      const msg = e instanceof EtherpadApiError ? e.message : e instanceof Error ? e.message : String(e)
      console.error('[pads/set-text]', e)
      return res.status(502).json({ error: `Etherpad: ${msg}` })
    }
  })

  // --- Redacciones manuales reversibles (persistentes) ---
  r.get('/:docId/redactions', async (req, res) => {
    const docId = String(req.params.docId || '').trim()
    if (!docId) return res.status(400).json({ error: 'docId inválido' })
    try {
      const prisma = await getDb()
      const rows = await listRedactions(prisma, req.auth!, docId)
      return res.json({ redactions: rows })
    } catch (e: unknown) {
      if (e instanceof HttpError) return res.status(e.statusCode).json({ error: e.message })
      console.error('[redactions/list]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error' })
    }
  })

  r.post('/:docId/redactions', async (req, res) => {
    const docId = String(req.params.docId || '').trim()
    if (!docId) return res.status(400).json({ error: 'docId inválido' })
    const placeholder = String((req.body as { placeholder?: unknown })?.placeholder ?? '').trim()
    const original = String((req.body as { original?: unknown })?.original ?? '')
    if (!placeholder) return res.status(400).json({ error: 'placeholder es requerido' })
    if (!original) return res.status(400).json({ error: 'original es requerido' })
    try {
      const prisma = await getDb()
      const row = await createRedaction(prisma, req.auth!, docId, placeholder, original)
      return res.json({ ok: true, redaction: row })
    } catch (e: unknown) {
      if (e instanceof HttpError) return res.status(e.statusCode).json({ error: e.message })
      console.error('[redactions/create]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error' })
    }
  })

  r.post('/:docId/redactions/:redactionId/restore', async (req, res) => {
    const docId = String(req.params.docId || '').trim()
    const redactionId = String(req.params.redactionId || '').trim()
    if (!docId) return res.status(400).json({ error: 'docId inválido' })
    if (!redactionId) return res.status(400).json({ error: 'redactionId inválido' })
    try {
      const prisma = await getDb()
      const restored = await restoreRedaction(prisma, req.auth!, docId, redactionId)
      return res.json({ ok: true, restored })
    } catch (e: unknown) {
      if (e instanceof HttpError) return res.status(e.statusCode).json({ error: e.message })
      console.error('[redactions/restore]', e)
      return res.status(500).json({ error: e instanceof Error ? e.message : 'Error' })
    }
  })

  r.post('/:docId/agent/run', async (req, res) => {
    const { baseUrl, apiKey } = getEtherpadConfig()
    if (!baseUrl || !apiKey) {
      return res.status(503).json({
        error:
          'Etherpad no configurado. Define ETHERPAD_BASE_URL y ETHERPAD_API_KEY (ver .env.example).',
      })
    }

    const docId = String(req.params.docId || '').trim()
    if (!docId) return res.status(400).json({ error: 'docId inválido' })

    let before = ''
    try {
      const { padId } = await resolveGroupPadIdForDoc(baseUrl, apiKey, req.auth!.organizationId, docId)
      before = await getPadText(baseUrl, apiKey, padId)
    } catch (e: unknown) {
      const msg = e instanceof EtherpadApiError ? e.message : e instanceof Error ? e.message : String(e)
      console.error('[agent/run] getText', e)
      return res.status(502).json({ error: `Etherpad: ${msg}` })
    }

    pruneProposals()
    const proposalId = randomUUID()
    const mode = (req.body as { mode?: string })?.mode || 'stub'
    const note =
      mode === 'stub'
        ? '[stub agent] Conecta aquí el LLM / orquestador. Contenido sin cambios.'
        : `[stub agent] mode=${mode}`

    const after = before ? `${before}\n\n${note}` : note

    const { padId } = await resolveGroupPadIdForDoc(baseUrl, apiKey, req.auth!.organizationId, docId)
    proposals.set(proposalId, {
      userId: req.auth!.userId,
      docId,
      padId,
      before,
      after,
      createdAt: Date.now(),
    })

    res.json({
      proposalId,
      mode,
      before: { format: 'text', content: before },
      after: { format: 'text', content: after },
      summary: ['Esqueleto: sin llamada al modelo; solo lectura del pad y propuesta en memoria.'],
    })
  })

  r.post('/:docId/agent/apply', async (req, res) => {
    const { baseUrl, apiKey } = getEtherpadConfig()
    if (!baseUrl || !apiKey) {
      return res.status(503).json({
        error:
          'Etherpad no configurado. Define ETHERPAD_BASE_URL y ETHERPAD_API_KEY (ver .env.example).',
      })
    }

    const docId = String(req.params.docId || '').trim()
    if (!docId) return res.status(400).json({ error: 'docId inválido' })

    const proposalId = String((req.body as { proposalId?: string })?.proposalId || '').trim()
    if (!proposalId) return res.status(400).json({ error: 'proposalId es requerido' })

    pruneProposals()
    const row = proposals.get(proposalId)
    if (!row || row.userId !== req.auth!.userId || row.docId !== docId) {
      return res.status(404).json({ error: 'Propuesta no encontrada o expirada' })
    }

    try {
      const current = await getPadText(baseUrl, apiKey, row.padId)
      if (current !== row.before) {
        return res.status(409).json({
          error: 'El pad cambió desde que se generó la propuesta (conflicto). Vuelve a ejecutar agent/run.',
          padId: row.padId,
        })
      }
      await setPadText(baseUrl, apiKey, row.padId, row.after)
      proposals.delete(proposalId)
      res.json({ ok: true, padId: row.padId })
    } catch (e: unknown) {
      const msg = e instanceof EtherpadApiError ? e.message : e instanceof Error ? e.message : String(e)
      console.error('[agent/apply]', e)
      return res.status(502).json({ error: `Etherpad: ${msg}` })
    }
  })

  return r
}
