/**
 * Módulo CriterIA: publicación y consulta de evidencias en OriginTrail DKG.
 * Publica metadata firmada como Knowledge Asset y permite consultar por UAL.
 */

import { getDkgNetworkById } from '@/config/dkgNetworks'

export const CRITERIA_DKG_CONFIG_KEY = 'criteria-dkg-config'
export const NELAI_DKG_CONFIG_KEY = 'nelai-dkg-config' // legacy

export interface DkgConfig {
  /** ID de red predefinida (ej: neuroweb-testnet) o config manual */
  networkId?: string
  endpoint?: string
  port?: number
  blockchain?: {
    name: string
    privateKey?: string
    rpc?: string
  }
  /** Usar clave EVM derivada de la cuenta activa (mismo seed que Substrate) */
  useDerivedKey?: boolean
  authToken?: string
}

export interface PublishResult {
  UAL: string
  datasetRoot?: string
  operation?: unknown
}

export interface GetAssetResult {
  assertion?: unknown[]
  operation?: { get?: { status?: string } }
}

/**
 * Resuelve la config DKG a endpoint, port, blockchain.
 * Si networkId está definido, usa la red predefinida; si no, usa endpoint/blockchain manual.
 */
export function resolveDkgConfig(config: DkgConfig): {
  endpoint: string
  port: number
  blockchain: { name: string; privateKey?: string; rpc?: string }
  authToken?: string
} | null {
  if (config.networkId) {
    const net = getDkgNetworkById(config.networkId)
    if (!net) return null
    return {
      endpoint: net.endpoint,
      port: net.port,
      blockchain: {
        name: net.blockchainId,
        privateKey: config.blockchain?.privateKey,
        rpc: net.rpc,
      },
      authToken: config.authToken,
    }
  }
  if (config.endpoint && config.blockchain?.name) {
    return {
      endpoint: config.endpoint,
      port: config.port ?? 8900,
      blockchain: config.blockchain,
      authToken: config.authToken,
    }
  }
  return null
}

/** Config por defecto cuando no hay config guardada (semi-automático). */
const DEFAULT_DKG_CONFIG: DkgConfig = {
  networkId: 'neuroweb-testnet',
  useDerivedKey: true,
}

/**
 * Obtiene la configuración DKG desde localStorage.
 */
export function getDkgConfig(): DkgConfig | null {
  try {
    const raw = localStorage.getItem(CRITERIA_DKG_CONFIG_KEY) ?? localStorage.getItem(NELAI_DKG_CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DkgConfig
    if (parsed.networkId || (parsed.endpoint && parsed.blockchain?.name)) return parsed
    return null
  } catch {
    return null
  }
}

/**
 * Obtiene la config DKG o la config por defecto (semi-automático).
 * Usar para publicar/consultar sin que el usuario configure explícitamente.
 */
export function getDkgConfigOrDefault(): DkgConfig {
  const c = getDkgConfig()
  return c ?? DEFAULT_DKG_CONFIG
}

/**
 * Guarda la configuración DKG en localStorage.
 */
export function setDkgConfig(config: DkgConfig): void {
  localStorage.setItem(CRITERIA_DKG_CONFIG_KEY, JSON.stringify(config))
  localStorage.removeItem(NELAI_DKG_CONFIG_KEY)
}

/**
 * Construye el contenido JSON-LD para el Knowledge Asset (Schema.org).
 * Solo assertions públicas: contentHash, autor, fecha, tipo.
 */
function buildKnowledgeAssetContent(
  signedMetadata: { metadata: Record<string, unknown>; signature: string; signer: string }
): { public: Record<string, unknown>; private?: Record<string, unknown> } {
  const meta = signedMetadata.metadata
  const contentHash = meta?.contentHash ?? ''
  const author = meta?.author ?? signedMetadata.signer ?? ''
  const createdAt = meta?.createdAt ?? new Date().toISOString()
  const type = meta?.type ?? 'photo'
  const mimeType = meta?.mimeType ?? 'image/jpeg'
  const filename = meta?.filename ?? 'evidence'

  const publicContent = {
    '@context': 'https://schema.org',
    '@type': 'DigitalDocument',
    '@id': `urn:criteria:evidence:${contentHash}`,
    name: filename,
    contentHash,
    author: {
      '@type': 'Person',
      identifier: author,
    },
    dateCreated: createdAt,
    fileFormat: mimeType,
    criteriaType: type,
    criteriaSignature: signedMetadata.signature,
    criteriaSigner: signedMetadata.signer,
  }

  return {
    public: publicContent,
    private: {
      '@context': 'https://schema.org',
      '@type': 'DigitalDocumentPrivate',
      '@id': `urn:criteria:evidence:${contentHash}:private`,
      fullMetadata: meta,
    },
  }
}

/**
 * Publica una evidencia firmada como Knowledge Asset en el DKG.
 * Requiere dkg.js cargado globalmente (vía CDN) y configuración DKG.
 *
 * Nota: La publicación requiere transacciones blockchain. Para uso sin dkg.js,
 * la consulta por UAL está disponible vía REST directo al nodo.
 *
 * @param signedMetadata - Metadata firmada (metadata, signature, signer)
 * @param options - epochsNum (por defecto 6)
 * @returns UAL del Knowledge Asset creado
 */
export async function publishEvidenceToDKG(
  signedMetadata: { metadata: Record<string, unknown>; signature: string; signer: string },
  options: { epochsNum?: number; evmPrivateKey?: string } = {}
): Promise<PublishResult> {
  const config = getDkgConfigOrDefault()
  const resolved = resolveDkgConfig(config)
  if (!resolved) {
    throw new Error('No se pudo resolver la configuración DKG. Verifica la red seleccionada.')
  }

  const privateKey = options.evmPrivateKey ?? resolved.blockchain.privateKey
  if (!privateKey) {
    throw new Error(
      'Se requiere private key EVM para publicar. Usa la opción "Clave derivada" con tu contraseña.'
    )
  }

  const DkgClient = (globalThis as unknown as { DKG?: new (c: unknown) => { asset: { create: (c: unknown, o: unknown) => Promise<{ UAL?: string }> } } }).DKG
  if (!DkgClient) {
    throw new Error(
      'El SDK dkg.js no está cargado. Para publicar en DKG, añade en index.html: ' +
      '<script src="https://cdn.jsdelivr.net/npm/web3@latest/dist/web3.min.js"></script> ' +
      '<script src="https://cdn.jsdelivr.net/npm/dkg.js@8/dist/dkg.min.js"></script>'
    )
  }

  const dkgConfig = {
    endpoint: resolved.endpoint,
    port: resolved.port,
    blockchain: {
      name: resolved.blockchain.name,
      privateKey,
      rpc: resolved.blockchain.rpc,
    },
    ...(resolved.authToken && { authToken: resolved.authToken }),
  }

  const dkg = new DkgClient(dkgConfig)
  const content = buildKnowledgeAssetContent(signedMetadata)

  const result = await dkg.asset.create(content, { epochsNum: 6 })

  const ual = result?.UAL
  if (!ual) {
    throw new Error('No se recibió UAL del DKG')
  }

  return {
    UAL: ual,
    datasetRoot: (result as { datasetRoot?: string }).datasetRoot,
    operation: (result as { operation?: unknown }).operation,
  }
}

/**
 * Obtiene un Knowledge Asset del DKG por su UAL.
 * Usa la API REST del nodo directamente (no requiere dkg.js).
 *
 * @param ual - Uniform Asset Locator (ej: did:dkg:base:84532/0x.../...)
 * @returns Assertions del asset
 */
export async function getAssetFromDKG(ual: string): Promise<GetAssetResult> {
  const config = getDkgConfigOrDefault()
  const resolved = resolveDkgConfig(config)
  if (!resolved) {
    throw new Error('No se pudo resolver la configuración DKG.')
  }

  const baseUrl = `${resolved.endpoint.replace(/\/$/, '')}:${resolved.port}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (resolved.authToken) {
    headers.Authorization = `Bearer ${resolved.authToken}`
  }

  // POST /get para iniciar la operación
  const initRes = await fetch(`${baseUrl}/get`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: ual,
      state: 'latest',
      hashFunctionId: 1,
    }),
  })

  if (!initRes.ok) {
    const text = await initRes.text()
    throw new Error(`DKG get falló: ${initRes.status} ${text}`)
  }

  const { operationId } = (await initRes.json()) as { operationId?: string }
  if (!operationId) {
    throw new Error('No se recibió operationId del nodo DKG')
  }

  // Poll hasta completar
  const maxRetries = 30
  const frequencyMs = 1000

  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, frequencyMs))

    const pollRes = await fetch(`${baseUrl}/get/${operationId}`, { headers })
    if (!pollRes.ok) {
      throw new Error(`DKG poll falló: ${pollRes.status}`)
    }

    const data = (await pollRes.json()) as { status?: string; data?: { assertion?: unknown[] } }
    if (data.status === 'COMPLETED') {
      return {
        assertion: data.data?.assertion,
        operation: { get: { status: data.status } },
      }
    }
    if (data.status === 'FAILED') {
      throw new Error('La operación DKG falló')
    }
  }

  throw new Error('Timeout esperando resultado del DKG')
}

function extractValue(obj: unknown, keys: string[]): string | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined
  const o = obj as Record<string, unknown>
  for (const key of keys) {
    const v = o[key]
    if (v === undefined) continue
    if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && '@value' in (v[0] as object)) {
      return String((v[0] as { '@value': unknown })['@value'])
    }
    if (typeof v === 'string') return v
  }
  return undefined
}

/**
 * Extrae un reporte legible de las assertions de un Knowledge Asset.
 */
export function summarizeDkgAssertions(assertion: unknown[]): {
  author?: string
  contentHash?: string
  createdAt?: string
  type?: string
  report: string
} {
  if (!Array.isArray(assertion)) {
    return { report: 'No hay assertions disponibles.' }
  }

  let author: string | undefined
  let contentHash: string | undefined
  let createdAt: string | undefined
  let type: string | undefined

  for (const node of assertion) {
    if (typeof node !== 'object' || node === null) continue
    const n = node as Record<string, unknown>
    const id = n['@id']
    if (typeof id === 'string') {
      if (id.startsWith('urn:criteria:evidence:')) {
        contentHash = id.replace('urn:criteria:evidence:', '').split(':')[0]
      } else if (id.startsWith('urn:nelai:evidence:')) {
        contentHash = id.replace('urn:nelai:evidence:', '').split(':')[0]
      }
    }
    author =
      author ??
      extractValue(n, ['criteriaSigner', 'nelaiSigner', 'http://schema.org/author', 'author'])
    createdAt = createdAt ?? extractValue(n, ['dateCreated', 'http://schema.org/dateCreated'])
    type = type ?? extractValue(n, ['criteriaType', 'nelaiType'])
    if (extractValue(n, ['contentHash'])) contentHash = contentHash ?? extractValue(n, ['contentHash'])
  }

  const parts: string[] = []
  if (author) parts.push(`Firmante: **${author}**`)
  if (contentHash) parts.push(`Hash: ${contentHash.slice(0, 18)}…`)
  if (createdAt) parts.push(`Fecha: **${createdAt}**`)
  if (type) parts.push(`Tipo: **${type}**`)

  const report =
    parts.length > 0
      ? `Evidencia publicada en DKG. ${parts.join('. ')}.`
      : 'Evidencia encontrada en DKG. Revisa las assertions para más detalles.'

  return { author, contentHash, createdAt, type, report }
}
