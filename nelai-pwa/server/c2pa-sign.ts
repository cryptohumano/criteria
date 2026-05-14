/**
 * Servidor para embeber manifiestos C2PA en PDFs.
 * Usa certificados de prueba (solo desarrollo).
 *
 * Ejecutar: npx tsx server/c2pa-sign.ts
 * O: yarn c2pa-server
 */

import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'
import { Builder, LocalSigner } from '@contentauth/c2pa-node'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getPrisma, isDatabaseConfigured } from './db.js'
import { prismaRegister, prismaLogin } from './prisma-auth.js'
import { registerGoogleAuthRoutes } from './routes/googleAuthRoutes.js'
import { registerEmailVerificationRoutes } from './routes/emailVerificationRoutes.js'
import type { RegisterBody, LoginBody } from './prisma-auth.js'
import { createPlatformRouter } from './routes/platformRouter.js'
import { createPadsRouter } from './routes/padsRouter.js'
import { createBillingRouter, createBillingWebhookHandler } from './routes/billingRouter.js'
import { createOrgRouter } from './routes/orgRouter.js'
import { createUsageRouter } from './routes/usageRouter.js'
import { resolveServerGeminiApiKey } from './llm/resolveServerGeminiKey.js'
import { corsMiddleware } from './middleware/cors.js'
import { requestIdMiddleware } from './middleware/requestId.js'
import {
  apiGeneralLimiter,
  authCredentialsLimiter,
  llmModelsLimiter,
  llmProxyLimiter,
} from './middleware/rateLimits.js'
import { requireAuth, requirePlatformSuperadmin } from './middleware/authz.js'
import { c2paSignAuthResolver, c2paSigningRequiresSession } from './middleware/c2paAuthGate.js'
import { createResolveAuthSession } from './auth/resolveSession.js'
import { authSessions, usersByEmail, type MemoryUserRow } from './auth/memoryDevStore.js'
import { HttpError, getHttpStatus } from './auth/httpError.js'
import { memoryDeleteOwnAccount, prismaDeleteOwnAccount } from './auth/deleteOwnAccount.js'
import { assertOrgLlmTokenQuota, recordLlmGeminiSuccess } from './usage/llmUsage.js'
import { attachEtherpadWebSocketUpgrade, mountEtherpadProxy } from './etherpad/proxy.js'
import type { AuthSession } from './auth/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CERTS_DIR = join(__dirname, 'certs')
// `PORT` lo inyectan plataformas como Railway/Heroku; respetamos primero ese valor,
// y caemos a `C2PA_PORT` para entornos legacy y a 3456 en local.
const PORT = Number(process.env.PORT) || Number(process.env.C2PA_PORT) || 3456
const DIST_DIR = join(__dirname, '..', 'dist')
const INDEX_HTML = join(DIST_DIR, 'index.html')

const app = express()
// Detrás del edge proxy de Railway/Heroku/Cloudflare: confiar 1 hop para que
// `req.ip`, rate-limits y cookies "secure" funcionen con la IP real del cliente.
app.set('trust proxy', 1)

let llmRequestCount = 0

const resolveAuthSession = createResolveAuthSession(getPrisma)
const requireUser = requireAuth(resolveAuthSession)
const superadminGuard = requirePlatformSuperadmin(resolveAuthSession)
const c2paAuthGate = c2paSignAuthResolver(resolveAuthSession)

let signer: ReturnType<typeof LocalSigner.newSigner> | null = null

function getSigner(): ReturnType<typeof LocalSigner.newSigner> {
  if (signer) return signer
  const certPath = join(CERTS_DIR, 'es256.pub')
  const keyPath = join(CERTS_DIR, 'es256.pem')
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    throw new Error('Certificados C2PA no encontrados. Ejecuta: node server/download-certs.js')
  }
  const cert = fs.readFileSync(certPath)
  const key = fs.readFileSync(keyPath)
  signer = LocalSigner.newSigner(cert, key, 'es256')
  return signer
}

/**
 * Crea un Builder con el manifiesto C2PA para el documento.
 */
function createBuilder(metadata: Record<string, unknown>) {
  const builder = Builder.new({
    verify: {
      verify_after_sign: false,
      verify_trust: false,
    },
  })

  builder.setIntent({
    create: 'http://cv.iptc.org/newscodes/digitalsourcetype/composite',
  })

  const actionsAssertion = {
    actions: [
      {
        action: 'c2pa.created',
        when: (metadata.createdAt as string) || new Date().toISOString(),
        software_agent: (metadata.claimGenerator as string) || 'CriterIA',
      },
    ],
  }
  builder.addAssertion('c2pa.actions', actionsAssertion, 'Cbor')

  const contentHash = String(metadata.contentHash || '').replace(/^0x/, '')
  if (contentHash) {
    builder.addAssertion(
      'c2pa.hash.data',
      {
        alg: 'sha256',
        hash: contentHash,
      },
      'Cbor',
    )
  }

  const polkadotAssertion: Record<string, unknown> = {
    address: (metadata.author as string) || '',
    signature: (metadata.signature as string) || '',
    contentHash: (metadata.contentHash as string) || '',
    createdAt: (metadata.createdAt as string) || new Date().toISOString(),
    title: (metadata.title as string) || '',
    documentId: (metadata.documentId as string) || '',
    claimGenerator: (metadata.claimGenerator as string) || 'CriterIA',
  }
  if (metadata.exifData != null) polkadotAssertion.exifData = metadata.exifData
  builder.addAssertion('org.nelai.polkadot', polkadotAssertion, 'Json')

  return builder
}

app.use(requestIdMiddleware)
app.use(corsMiddleware)

// Stripe webhook requiere el body "raw" para validar firma. Debe ir ANTES de express.json().
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), createBillingWebhookHandler())

app.use(express.json({ limit: '50mb' }))
app.use('/api', apiGeneralLimiter)
registerGoogleAuthRoutes(app)
registerEmailVerificationRoutes(app, getPrisma)
app.use('/api/usage', createUsageRouter(requireUser))

function toAuthSession(row: MemoryUserRow, email: string): AuthSession {
  return {
    userId: row.userId,
    email,
    displayName: row.displayName,
    orgRole: row.orgRole,
    platformRole: row.platformRole,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    organizationKind: row.organizationKind,
    plan: row.plan,
    trialEndsAt: null,
    trialExpired: false,
  }
}

app.post('/api/c2pa-sign', c2paAuthGate, async (req, res) => {
  try {
    const { pdfBase64, metadata } = req.body as { pdfBase64?: string; metadata?: Record<string, unknown> }
    if (!pdfBase64) {
      return res.status(400).json({ error: 'pdfBase64 es requerido' })
    }

    const buffer = Buffer.from(
      pdfBase64.includes(',') ? pdfBase64.split(',')[1]! : pdfBase64,
      'base64',
    )

    const inputAsset = { buffer, mimeType: 'application/pdf' as const }
    const outputAsset: { buffer: Buffer | null } = { buffer: null }

    const builder = createBuilder(metadata || {})
    const s = getSigner()
    const result = await builder.sign(s, inputAsset, outputAsset)

    const signedBase64 = result.toString('base64')
    res.json({ pdfBase64: signedBase64, success: true })
  } catch (err: unknown) {
    console.error('[C2PA] Error:', err)
    const message = err instanceof Error ? err.message : 'Error al firmar con C2PA'
    res.status(500).json({
      error: message,
      stack: process.env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined,
    })
  }
})

app.get('/api/c2pa-health', (_req, res) => {
  try {
    getSigner()
    res.json({ ok: true, c2pa: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    res.status(503).json({ ok: false, c2pa: false, error: message })
  }
})

// --- Auth B2B ---
app.post('/api/auth/register', authCredentialsLimiter, async (req, res) => {
  let prisma = null as Awaited<ReturnType<typeof getPrisma>>
  try {
    prisma = await getPrisma()
  } catch (e) {
    console.error('[auth/register] Prisma:', e)
    return res.status(503).json({
      error: 'Base de datos no disponible. ¿Ejecutaste `yarn prisma:generate` y configuraste DATABASE_URL?',
    })
  }
  try {
    if (prisma) {
      const out = await prismaRegister(prisma, req.body as RegisterBody)
      if (out.kind === 'pending') {
        return res.status(201).json({ pendingVerification: true, email: out.email })
      }
      return res.json({
        accessToken: out.accessToken,
        user: out.user,
        organization: out.organization,
      })
    }
    const inviteTok = String((req.body as RegisterBody).inviteToken || '').trim()
    if (inviteTok) {
      return res.status(503).json({ error: 'Las invitaciones requieren base de datos (DATABASE_URL + Prisma).' })
    }
    const { organizationName, email, password, displayName, accountKind } =
      (req.body as RegisterBody) || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son requeridos' })
    }
    const em = String(email).trim().toLowerCase()
    const kind = String(accountKind || '')
      .toLowerCase()
      .trim()
    const wantsTeam =
      kind === 'team' || (kind !== 'personal' && String(organizationName || '').trim().length > 0)
    if (wantsTeam && !String(organizationName || '').trim()) {
      return res
        .status(400)
        .json({ error: 'Para cuenta equipo (B2B), organizationName es requerido' })
    }
    if (usersByEmail.has(em)) {
      return res.status(409).json({ error: 'El correo ya está registrado' })
    }
    const orgId = 'org-' + randomBytes(8).toString('hex')
    const userId = 'user-' + randomBytes(8).toString('hex')
    const hash = await bcrypt.hash(String(password), 10)
    const disp = String(displayName || em.split('@')[0] || 'Usuario').trim()
    const orgDisplayName = wantsTeam
      ? String(organizationName).trim()
      : `Cuenta de ${disp}`
    const row: MemoryUserRow = {
      passwordHash: hash,
      userId,
      organizationId: orgId,
      organizationName: orgDisplayName,
      organizationKind: wantsTeam ? 'team' : 'personal',
      displayName: disp,
      plan: 'trial',
      orgRole: 'owner',
      platformRole: 'none',
    }
    usersByEmail.set(em, row)
    const accessToken = randomBytes(32).toString('hex')
    authSessions.set(accessToken, toAuthSession(row, em))
    return res.json({
      accessToken,
      user: {
        id: row.userId,
        email: em,
        displayName: row.displayName,
        orgRole: row.orgRole,
        platformRole: row.platformRole,
      },
      organization: {
        id: row.organizationId,
        name: row.organizationName,
        plan: row.plan,
        kind: row.organizationKind,
      },
    })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'P2002') {
      return res.status(409).json({ error: 'El correo ya está registrado' })
    }
    const status = getHttpStatus(e)
    console.error('[auth/register]', e)
    return res.status(status).json({
      error: e instanceof Error ? e.message : 'Error al registrar',
    })
  }
})

app.post('/api/auth/login', authCredentialsLimiter, async (req, res) => {
  let prisma = null as Awaited<ReturnType<typeof getPrisma>>
  try {
    prisma = await getPrisma()
  } catch (e) {
    console.error('[auth/login] Prisma:', e)
    return res.status(503).json({
      error: 'Base de datos no disponible. ¿Ejecutaste `yarn prisma:generate` y configuraste DATABASE_URL?',
    })
  }
  try {
    if (prisma) {
      const out = await prismaLogin(prisma, req.body as LoginBody)
      return res.json(out)
    }
    const { email, password } = (req.body as { email?: string; password?: string }) || {}
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son requeridos' })
    }
    const em = String(email).trim().toLowerCase()
    const row = usersByEmail.get(em)
    if (!row || !(await bcrypt.compare(String(password), row.passwordHash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }
    const accessToken = randomBytes(32).toString('hex')
    authSessions.set(accessToken, toAuthSession(row, em))
    return res.json({
      accessToken,
      user: {
        id: row.userId,
        email: em,
        displayName: row.displayName,
        orgRole: row.orgRole,
        platformRole: row.platformRole,
      },
      organization: {
        id: row.organizationId,
        name: row.organizationName,
        plan: row.plan,
        kind: row.organizationKind,
      },
    })
  } catch (e: unknown) {
    const status = getHttpStatus(e)
    console.error('[auth/login]', e)
    return res.status(status).json({
      error: e instanceof Error ? e.message : 'Error al iniciar sesión',
    })
  }
})

app.get('/api/auth/me', requireUser, (req, res) => {
  const s = req.auth!
  res.json({
    user: {
      id: s.userId,
      email: s.email,
      displayName: s.displayName,
      orgRole: s.orgRole,
      platformRole: s.platformRole,
    },
    organization: {
      id: s.organizationId,
      name: s.organizationName,
      plan: s.plan,
      kind: s.organizationKind,
    },
  })
})

/** Elimina usuario + organización (solo miembro). Contraseña obligatoria si la cuenta tiene password. */
async function handleDeleteOwnAccount(req: express.Request, res: express.Response) {
  const password = (req.body as { password?: string })?.password
  let prisma: Awaited<ReturnType<typeof getPrisma>> = null
  try {
    prisma = await getPrisma()
  } catch (e) {
    console.error('[auth/delete-account] Prisma:', e)
    return res.status(503).json({ error: 'Base de datos no disponible' })
  }
  try {
    if (prisma) {
      await prismaDeleteOwnAccount(prisma, req.auth!, password)
    } else {
      await memoryDeleteOwnAccount(req.auth!, password)
    }
    res.json({ ok: true })
  } catch (e: unknown) {
    const status = getHttpStatus(e)
    console.error('[auth/delete-account]', e)
    res.status(status).json({
      error: e instanceof Error ? e.message : 'No se pudo eliminar la cuenta',
    })
  }
}

app.delete('/api/auth/me', authCredentialsLimiter, requireUser, handleDeleteOwnAccount)
app.post('/api/auth/delete-account', authCredentialsLimiter, requireUser, handleDeleteOwnAccount)

app.use('/api/platform', createPlatformRouter(superadminGuard))
app.use('/api/docs', createPadsRouter(requireUser))
app.use('/api/billing', createBillingRouter(requireUser))
app.use('/api/org', createOrgRouter(requireUser))

app.post('/api/llm-proxy', llmProxyLimiter, async (req, res) => {
  llmRequestCount++
  const requestId = req.header('X-Request-ID') || 'internal-' + Date.now()
  const body = req.body as {
    apiKey?: string
    model?: string
    body?: unknown
    useServerKey?: boolean
  }
  const { apiKey, model, body: geminiBody, useServerKey } = body
  const timestamp = new Date().toLocaleTimeString()
  const serverGeminiKey = await resolveServerGeminiApiKey()
  const session = await resolveAuthSession(req)
  const wantsServerKey = !!useServerKey || (!apiKey && serverGeminiKey && session)

  res.setHeader('X-Request-ID', requestId)
  res.setHeader('X-LLM-Total-Requests', llmRequestCount.toString())

  if (useServerKey && !session) {
    console.error(`[${timestamp}] [LLM Proxy] [${requestId}] useServerKey sin sesión válida`)
    return res.status(401).json({ error: 'Sesión requerida para usar la clave de IA en el servidor' })
  }

  const effectiveKey =
    wantsServerKey && serverGeminiKey && session ? serverGeminiKey : apiKey

  if (!effectiveKey) {
    console.error(`[${timestamp}] [LLM Proxy] [${requestId}] Error: falta API key o GEMINI_API_KEY + sesión`)
    return res.status(400).json({
      error:
        'Indica apiKey en el body, o configura GEMINI_API_KEY en el servidor e inicia sesión (Bearer) para el modo SaaS.',
    })
  }

  /** Coste de plataforma: sesión + `GEMINI_API_KEY` (no BYOK en cliente). */
  const platformPays = Boolean(wantsServerKey && serverGeminiKey && session)

  if (platformPays) {
    let prismaCheck = null as Awaited<ReturnType<typeof getPrisma>>
    try {
      prismaCheck = await getPrisma()
    } catch (e) {
      console.error(`[${timestamp}] [LLM Proxy] [${requestId}] Prisma:`, e)
    }
    if (prismaCheck && session) {
      try {
        await assertOrgLlmTokenQuota(prismaCheck, session, requestId)
      } catch (e: unknown) {
        if (e instanceof HttpError) {
          return res.status(e.statusCode).json({ error: e.message, requestId })
        }
        throw e
      }
    }
  }

  const targetModel = model || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${effectiveKey}`

  console.log(
    `[${timestamp}] [LLM Proxy] [#${llmRequestCount}] [${requestId}] 🚀 Forwarding to Google: ${targetModel}${platformPays ? ' (clave servidor)' : ''}`,
  )

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    })

    const data = (await response.json()) as Record<string, unknown>

    if (!response.ok) {
      const ge = data.error as { message?: string; status?: string } | undefined
      const extra = ge?.message ? `: ${ge.message}` : ''
      console.error(
        `[${timestamp}] [LLM Proxy] [${requestId}] ❌ Google Error (${response.status})${extra}`,
      )

      if (response.status === 429) {
        return res.status(429).json({
          error: 'Cuota de IA agotada en Google Cloud. Por favor espera 60s.',
          details: data,
        })
      }
      return res.status(response.status).json(data)
    }

    if (platformPays && session) {
      let prismaUse = null as Awaited<ReturnType<typeof getPrisma>>
      try {
        prismaUse = await getPrisma()
      } catch (e) {
        console.error(`[${timestamp}] [LLM Proxy] [${requestId}] Prisma (usage):`, e)
      }
      if (prismaUse) {
        try {
          await recordLlmGeminiSuccess(prismaUse, session, data, requestId, targetModel)
        } catch (e) {
          console.error(`[${timestamp}] [LLM Proxy] [${requestId}] [usage] falló al guardar:`, e)
        }
      }
    }

    console.log(`[${timestamp}] [LLM Proxy] [${requestId}] ✅ Success`)
    res.json(data)
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message, requestId })
    }
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[${timestamp}] [LLM Proxy] [${requestId}] 🔥 Connection Error:`, msg)
    res.status(500).json({ error: 'Error interno en el proxy de CriterIA' })
  }
})

app.post('/api/llm-proxy/', (req, res) => res.redirect(307, '/api/llm-proxy'))

app.get('/api/llm-proxy-health', (_req, res) =>
  res.json({ status: 'ok', requests: llmRequestCount }),
)

app.get('/api/llm-models', llmModelsLimiter, async (req, res) => {
  const apiKey = req.query.key
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API Key es requerida como query parameter (?key=...)' })
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`

  try {
    const response = await fetch(url)
    const data = (await response.json()) as {
      models?: Array<{
        name?: string
        displayName?: string
        description?: string
        inputTokenLimit?: number
        supportedGenerationMethods?: string[]
      }>
    }

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    const chatModels =
      data.models?.filter((m) => m.supportedGenerationMethods?.includes('generateContent')) || []

    res.json({
      total: data.models?.length || 0,
      chatModelsCount: chatModels.length,
      chatModels: chatModels.map((m) => ({
        name: (m.name || '').replace('models/', ''),
        displayName: m.displayName,
        description: m.description,
        inputTokenLimit: m.inputTokenLimit,
      })),
    })
  } catch {
    res.status(500).json({ error: 'Error al consultar modelos' })
  }
})

// --- Reverse-proxy a Etherpad (same-origin) ---
// Debe ir ANTES del SPA fallback: si /pad o /socket.io caen en el catch-all,
// el cliente Etherpad recibe HTML en lugar del payload real.
mountEtherpadProxy(app)

// --- Static UI (SPA fallback) — al FINAL de las rutas /api ---
// Al recargar en rutas del cliente (p. ej. /platform), el navegador hace GET a esa ruta; hay que
// devolver index.html para que React Router arranque. Requiere `yarn build` (existencia de dist/).
if (fs.existsSync(INDEX_HTML)) {
  const spaIndex = (_req: express.Request, res: express.Response) => res.sendFile(INDEX_HTML)
  // `serve-static` mapea GET / a path "" y hace stat de la raíz de `dist/`: es un directorio
  // y sin manejo explícito puede responder 301 a la misma URL (bucle con Cloudflare/Railway).
  // Atender / y HEAD / antes del middleware estático evita ese stat.
  app.get('/', spaIndex)
  app.head('/', spaIndex)
  // `redirect: false` evita otros 301 por barra final en subcarpetas bajo dist/.
  app.use(express.static(DIST_DIR, { index: false, redirect: false }))
  // No capturar /api/* (Express 5: evitar patrón '*' en app.get).
  app.get(/^(?!\/api\/).*/, spaIndex)
  app.head(/^(?!\/api\/).*/, spaIndex)
}

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Ruta API no encontrada' })
  }
  res
    .status(404)
    .type('text/plain; charset=utf-8')
    .send(
      `CriterIA — este puerto (${PORT}) es la API.\n\n` +
        `Si al recargar ves "Cannot GET /platform/...", el navegador pidió la SPA aquí pero no hay build en dist/.\n` +
        `Opciones:\n` +
        `- Desarrollo: abre la app con Vite (yarn dev / yarn dev:saas:all) en la URL de Vite (suele http://localhost:5173), no recargues solo :${PORT} sin dist.\n` +
        `- Misma máquina con UI en este proceso: ejecuta yarn build y reinicia; se servirá nelai-pwa/dist/ con fallback SPA.\n` +
        `- Configura VITE_API_BASE_URL=http://localhost:${PORT} en .env para que la PWA llame a esta API.\n`,
    )
})

const httpServer = app.listen(PORT, () => {
  console.log(`[CriterIA] Servidor en http://localhost:${PORT}`)
  if (fs.existsSync(INDEX_HTML)) {
    console.log(`[CriterIA] UI estática + fallback SPA: ${DIST_DIR} (recarga en /platform, etc.)`)
  } else {
    console.warn(
      '[CriterIA] Sin dist/index.html — usa la URL de Vite para la SPA o ejecuta yarn build si quieres servir la UI en este puerto.',
    )
  }
  if (isDatabaseConfigured()) {
    console.log('[CriterIA] Auth: PostgreSQL (Prisma) — tabla sessions + bcrypt')
  } else {
    console.warn('[CriterIA] Auth: sin DATABASE_URL — sesiones en memoria (no uses en producción)')
  }
  console.log(
    `[CriterIA] POST /api/c2pa-sign - Embeber manifiesto en PDF (${c2paSigningRequiresSession() ? 'Bearer obligatorio' : 'Bearer opcional'})`,
  )
  console.log('[CriterIA] POST /api/llm-proxy - Proxy Gemini (evita CORS; opcional GEMINI_API_KEY + Bearer)')
  console.log(
    '[CriterIA] GET /api/usage/llm | /api/platform/* (superadmin) | POST /api/auth/*',
  )
  console.log(
    '[CriterIA] Etherpad (migración): POST /api/docs/:docId/pad/session | GET .../pad/content | POST .../agent/{run,apply}',
  )
  console.log('[CriterIA] GET  /api/c2pa-health - Estado del servicio')
})

// Conectar el evento `upgrade` del HTTP server al proxy de Etherpad para que
// las conexiones WebSocket (socket.io) lleguen al servicio interno. Sin esto,
// http-proxy-middleware no recibe el upgrade y los pads no sincronizan.
attachEtherpadWebSocketUpgrade(httpServer)
