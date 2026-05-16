import type {
  ResearchEvidenceDocumentAnchor,
  ResearchEvidenceLogEntry,
  ResearchEvidenceLogOrigin,
} from '@/types/documents'
import { absoluteHttpUrlFromLooseTarget } from '@/utils/externalHref'

/** Documentos antiguos sin campo: tratar como lista vacía al leer. */
export function normalizeResearchEvidenceLog(
  log: ResearchEvidenceLogEntry[] | undefined
): ResearchEvidenceLogEntry[] {
  return log ?? []
}

/**
 * Añade entradas a la bitácora sin duplicar `id` (append-only).
 */
export function appendResearchEvidenceEntries(
  existing: ResearchEvidenceLogEntry[] | undefined,
  incoming: ResearchEvidenceLogEntry[]
): ResearchEvidenceLogEntry[] {
  const base = [...(existing ?? [])]
  const ids = new Set(base.map((e) => e.id))
  for (const e of incoming) {
    if (!ids.has(e.id)) {
      base.push(e)
      ids.add(e.id)
    }
  }
  return base
}

const TRAILING_IN_URL = /[),.;:!?*}\]'"»]+$/u

/** Quita puntuación final típica de Markdown / citas. */
export function normalizeExtractedUrl(raw: string): string {
  let u = raw.trim()
  while (TRAILING_IN_URL.test(u)) {
    u = u.replace(TRAILING_IN_URL, '')
  }
  return u
}

const VERTEX_GROUNDING_REDIRECT_HOST = 'vertexaisearch.cloud.google.com'
const VERTEX_GROUNDING_REDIRECT_PATH = '/grounding-api-redirect/'

/**
 * Texto corto para la tabla de bitácora; el `href` del enlace sigue siendo la URL completa.
 * Redirecciones largas de Vertex se muestran con el título del sitio cuando existe.
 */
export function formatResearchEvidenceUrlDisplay(url: string, title?: string | null): string {
  if (!url?.trim()) return '—'
  const raw = url.trim()
  const t = title?.trim()
  if (raw.includes(VERTEX_GROUNDING_REDIRECT_HOST) && raw.includes(VERTEX_GROUNDING_REDIRECT_PATH)) {
    return t || 'Google (citas web)'
  }
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.replace(/^www\./, '')
    let path = parsed.pathname
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
    const withPath = path && path !== '/' ? `${host}${path}` : host
    return withPath.length > 72 ? `${withPath.slice(0, 69)}…` : withPath
  } catch {
    return raw.length > 72 ? `${raw.slice(0, 69)}…` : raw
  }
}

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"')\]]+/gi

/** doi.org o www. sin esquema (citas APA, listas de referencias). */
const DOI_OR_DX_RE = /(?:https?:\/\/)?(?:dx\.)?doi\.org\/[^\s<>"')\]]+/gi
const WWW_HOST_RE = /(?:https?:\/\/)?www\.[^\s<>"')\]]+/gi

/** Destinos de enlaces Markdown `[texto](url)` (cualquier `url`); se normalizan a https. */
const MD_LINK_TARGET_RE = /\[([^\]]*)\]\(\s*([^)\s]+)\s*\)/gi
const MD_ANGLE_URL_RE = /<(https?:\/\/[^>\s]+)>/gi
const HTML_HREF_RE = /href\s*=\s*["'](https?:\/\/[^"'<>]+)["']/gi

function collectUrlsWithRegex(text: string, re: RegExp, groupIndex: number): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  re.lastIndex = 0
  while ((m = re.exec(text))) {
    const raw = m[groupIndex]
    if (typeof raw === 'string' && raw.startsWith('http')) out.push(raw)
  }
  return out
}

/** URLs http(s) en texto plano, Markdown (enlaces e imágenes), ángulos y atributos HTML. */
export function extractHttpUrlsFromText(text: string): string[] {
  if (!text) return []
  const seen = new Set<string>()
  const ordered: string[] = []
  const push = (raw: string) => {
    const u = normalizeExtractedUrl(raw)
    if (!u.startsWith('http') || u.startsWith('data:')) return
    if (seen.has(u)) return
    seen.add(u)
    ordered.push(u)
  }
  const pushMaybeBare = (raw: string) => {
    const normalized = absoluteHttpUrlFromLooseTarget(normalizeExtractedUrl(raw))
    if (!normalized) return
    push(normalized)
  }

  let m: RegExpExecArray | null
  URL_IN_TEXT_RE.lastIndex = 0
  while ((m = URL_IN_TEXT_RE.exec(text))) {
    push(m[0])
  }
  DOI_OR_DX_RE.lastIndex = 0
  while ((m = DOI_OR_DX_RE.exec(text))) {
    pushMaybeBare(m[0])
  }
  WWW_HOST_RE.lastIndex = 0
  while ((m = WWW_HOST_RE.exec(text))) {
    pushMaybeBare(m[0])
  }
  MD_LINK_TARGET_RE.lastIndex = 0
  while ((m = MD_LINK_TARGET_RE.exec(text))) {
    const raw = m[2]
    if (typeof raw !== 'string') continue
    const abs = absoluteHttpUrlFromLooseTarget(normalizeExtractedUrl(raw))
    if (abs) push(abs)
  }
  for (const u of collectUrlsWithRegex(text, MD_ANGLE_URL_RE, 1)) push(u)
  for (const u of collectUrlsWithRegex(text, HTML_HREF_RE, 1)) push(u)

  return ordered
}

export type AssistantSourceRef = { url: string; title?: string; snippet?: string }

/**
 * El modelo a veces omite el `[` inicial: `Consulta: texto del enlace](https://...)`.
 * Sin esto, el parser trata el destino como ruta relativa y el clic abre la PWA (localhost).
 */
export function repairBracketLinksMissingOpen(md: string): string {
  let i = 0
  let out = ''
  while (i < md.length) {
    const j = md.indexOf('](http', i)
    if (j === -1) {
      out += md.slice(i)
      break
    }
    const lineStart = md.lastIndexOf('\n', j)
    const segStart = lineStart + 1
    const openBracket = md.lastIndexOf('[', j)
    const hasOpen = openBracket > lineStart
    if (hasOpen) {
      out += md.slice(i, j + 1)
      i = j + 1
      continue
    }
    out += md.slice(i, segStart) + '[' + md.slice(segStart, j + 1)
    i = j + 1
  }
  return out
}

function canonicalEvidenceUrlKey(raw: string): string {
  let u = normalizeExtractedUrl(raw)
  if (!u.startsWith('http')) {
    const fixed = absoluteHttpUrlFromLooseTarget(u)
    if (fixed) u = fixed
  }
  return u
}

/**
 * Usa el texto del enlace Markdown `[etiqueta](url)` como título de bitácora cuando existe,
 * en sustitución del título corto de grounding (p. ej. solo el hostname).
 */
export function enrichAssistantRefsWithMarkdownTitles(text: string, refs: AssistantSourceRef[]): AssistantSourceRef[] {
  const repaired = repairBracketLinksMissingOpen(text)
  const map = new Map<string, string>()
  const re = /\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(repaired))) {
    const label = m[1].replace(/\s+/g, ' ').trim()
    const urlKey = canonicalEvidenceUrlKey(m[2])
    if (!label || !urlKey.startsWith('http') || label.length > 800) continue
    const prev = map.get(urlKey)
    if (!prev || label.length > prev.length) map.set(urlKey, label)
  }
  return refs.map((r) => {
    const key = canonicalEvidenceUrlKey(r.url)
    const mdTitle = map.get(key)
    if (!mdTitle) return r
    return { ...r, title: mdTitle }
  })
}

function findUrlPositionInText(text: string, url: string): { index: number; matchedLength: number } | null {
  const u = url.trim()
  if (!u) return null
  const variants = [
    u,
    u.replace(/\/$/, ''),
    u.replace(/^http:\/\//i, 'https://'),
    u.replace(/^https:\/\//i, 'http://'),
  ]
  for (const v of variants) {
    const i = text.indexOf(v)
    if (i !== -1) return { index: i, matchedLength: v.length }
  }
  return null
}

function evidenceHostnameFallback(url: string): string | undefined {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/**
 * Para URLs sueltas (sin `[etiqueta](url)`), infiere título a partir de la línea donde aparece
 * la URL y la línea anterior (p. ej. cita bibliográfica + enlace en la siguiente).
 */
export function inferAssistantRefContextFromText(
  assistantText: string,
  url: string
): { title?: string; snippet?: string } {
  const found = findUrlPositionInText(assistantText, url)
  if (!found) {
    return { title: evidenceHostnameFallback(url) }
  }
  const { index: idx, matchedLength: len } = found
  const lineStart = assistantText.lastIndexOf('\n', idx) + 1
  const lineEnd = assistantText.indexOf('\n', idx + len)
  const end = lineEnd === -1 ? assistantText.length : lineEnd
  const line = assistantText.slice(lineStart, end).trim()
  const snippet = line.length > 480 ? `${line.slice(0, 477)}…` : line
  const relStart = idx - lineStart
  const relEnd = relStart + len
  const before = line.slice(0, relStart).replace(/\s+$/, '')
  const after = line.slice(relEnd).replace(/^\s+/, '')
  const sameLineRest = [before, after].filter(Boolean).join(' ').replace(/^[-*•\d.)\]\s]+/, '').trim()
  let title: string | undefined
  if (sameLineRest.length >= 6) title = sameLineRest.slice(0, 300)
  if (!title) {
    const prevEnd = lineStart - 2
    if (prevEnd > 0) {
      const pStart = assistantText.lastIndexOf('\n', prevEnd) + 1
      const prev = assistantText.slice(pStart, prevEnd + 1).trim()
      if (prev.length >= 6) title = prev.slice(0, 300)
    }
  }
  if (!title) title = evidenceHostnameFallback(url)
  return { title, snippet }
}

/**
 * Combina citas del modelo (Gemini grounding) con URLs detectadas en el cuerpo de la respuesta.
 */
export function collectAssistantSourceRefs(
  text: string,
  citations?: Array<{ url: string; title?: string }>
): AssistantSourceRef[] {
  const out: AssistantSourceRef[] = []
  const seen = new Set<string>()
  for (const c of citations ?? []) {
    const raw = (c as { url?: string; uri?: string }).url ?? (c as { uri?: string }).uri
    if (typeof raw !== 'string' || !raw.trim()) continue
    let u = normalizeExtractedUrl(raw)
    if (!u.startsWith('http')) {
      const fixed = absoluteHttpUrlFromLooseTarget(u)
      if (!fixed) continue
      u = fixed
    }
    if (u.startsWith('data:')) continue
    if (seen.has(u)) continue
    seen.add(u)
    const title = typeof c.title === 'string' ? c.title : undefined
    out.push({ url: u, ...(title ? { title } : {}) })
  }
  for (const u of extractHttpUrlsFromText(text)) {
    if (seen.has(u)) continue
    seen.add(u)
    out.push({ url: u })
  }
  const mdPass = enrichAssistantRefsWithMarkdownTitles(text, out)
  return mdPass.map((r) => {
    const ctx = inferAssistantRefContextFromText(text, r.url)
    const titleCandidates = [r.title, ctx.title].filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    const title = titleCandidates.sort((a, b) => b.length - a.length)[0]
    return {
      ...r,
      ...(title ? { title } : {}),
      snippet: r.snippet ?? ctx.snippet,
    }
  })
}

function newEvidenceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export function buildResearchEvidenceEntries(
  documentId: string,
  urls: string[],
  options: {
    origin: ResearchEvidenceLogOrigin
    chatHistoryIndex?: number
    addedBy?: string
    accessedAt?: number
    createdAt?: number
    indexedFromUserPrompt?: string
  }
): ResearchEvidenceLogEntry[] {
  const now = options.createdAt ?? Date.now()
  const accessed = options.accessedAt ?? now
  return urls.map((url) => ({
    id: newEvidenceId(),
    documentId,
    createdAt: now,
    accessedAt: accessed,
    url,
    origin: options.origin,
    ...(options.chatHistoryIndex !== undefined ? { chatHistoryIndex: options.chatHistoryIndex } : {}),
    ...(options.addedBy ? { addedBy: options.addedBy } : {}),
    ...(options.indexedFromUserPrompt
      ? { indexedFromUserPrompt: options.indexedFromUserPrompt.slice(0, 8000) }
      : {}),
  }))
}

export function buildResearchEvidenceEntriesFromRefs(
  documentId: string,
  refs: AssistantSourceRef[],
  options: {
    origin: ResearchEvidenceLogOrigin
    chatHistoryIndex?: number
    addedBy?: string
    accessedAt?: number
    createdAt?: number
    indexedFromUserPrompt?: string
  }
): ResearchEvidenceLogEntry[] {
  const now = options.createdAt ?? Date.now()
  const accessed = options.accessedAt ?? now
  const prompt =
    options.indexedFromUserPrompt && options.indexedFromUserPrompt.trim()
      ? options.indexedFromUserPrompt.trim().slice(0, 8000)
      : undefined
  return refs.map((r) => ({
    id: newEvidenceId(),
    documentId,
    createdAt: now,
    accessedAt: accessed,
    url: r.url,
    ...(r.title ? { title: r.title } : {}),
    ...(r.snippet ? { snippet: r.snippet } : {}),
    origin: options.origin,
    ...(options.chatHistoryIndex !== undefined ? { chatHistoryIndex: options.chatHistoryIndex } : {}),
    ...(options.addedBy ? { addedBy: options.addedBy } : {}),
    ...(prompt ? { indexedFromUserPrompt: prompt } : {}),
  }))
}

function escCsvCell(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`
}

export function downloadResearchEvidenceJson(
  entries: ResearchEvidenceLogEntry[],
  filenameBase: string
): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `fuentes-${filenameBase}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function downloadResearchEvidenceCsv(
  entries: ResearchEvidenceLogEntry[],
  filenameBase: string
): void {
  const header = [
    'id',
    'createdAt',
    'accessedAt',
    'url',
    'title',
    'snippet',
    'indexedFromUserPrompt',
    'userComment',
    'origin',
    'chatHistoryIndex',
    'addedBy',
  ]
  const lines = [
    header.join(','),
    ...entries.map((e) =>
      [
        escCsvCell(e.id),
        e.createdAt,
        e.accessedAt ?? '',
        escCsvCell(e.url),
        escCsvCell(e.title ?? ''),
        escCsvCell(e.snippet ?? ''),
        escCsvCell(e.indexedFromUserPrompt ?? ''),
        escCsvCell(e.userComment ?? ''),
        escCsvCell(e.origin),
        e.chatHistoryIndex ?? '',
        escCsvCell(e.addedBy ?? ''),
      ].join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `fuentes-${filenameBase}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

const IMPORT_ORIGINS: ReadonlySet<ResearchEvidenceLogOrigin> = new Set([
  'user_message',
  'assistant_message',
  'user_attachment',
  'document_scan',
])

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function strField(v: unknown, maxLen: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  if (!t) return undefined
  return t.length > maxLen ? t.slice(0, maxLen) : t
}

function numField(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function parseImportedAnchor(raw: unknown): ResearchEvidenceDocumentAnchor | undefined {
  if (!isPlainObject(raw)) return undefined
  const anchor: ResearchEvidenceDocumentAnchor = {}
  const dv = numField(raw.documentVersion)
  if (dv !== undefined && dv >= 0) anchor.documentVersion = Math.floor(dv)
  const ph = strField(raw.pdfHash, 512)
  if (ph) anchor.pdfHash = ph
  const eh = strField(raw.excerptHash, 512)
  if (eh) anchor.excerptHash = eh
  return Object.keys(anchor).length > 0 ? anchor : undefined
}

/**
 * Interpreta un objeto JSON (p. ej. archivo de «Exportar JSON») y devuelve entradas listas para fusionar
 * en el documento `targetDocumentId` (se ignora el `documentId` que traía cada fila al exportar).
 */
export function parseResearchEvidenceLogImportJson(
  rawText: string,
  targetDocumentId: string
): { entries: ResearchEvidenceLogEntry[]; skipped: number } {
  if (!targetDocumentId.trim()) {
    throw new Error('Se requiere un identificador de documento para importar la bitácora.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('El archivo no es JSON válido.')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('El JSON debe ser un array de entradas (mismo formato que «Exportar JSON»).')
  }

  let skipped = 0
  const entries: ResearchEvidenceLogEntry[] = []

  for (const item of parsed) {
    if (!isPlainObject(item)) {
      skipped += 1
      continue
    }

    const idRaw = strField(item.id, 200)
    const id =
      idRaw && idRaw.length > 0
        ? idRaw
        : typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `ev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

    const urlRaw = typeof item.url === 'string' ? item.url.trim() : ''
    const url =
      urlRaw && (urlRaw.startsWith('http://') || urlRaw.startsWith('https://'))
        ? urlRaw
        : absoluteHttpUrlFromLooseTarget(urlRaw)
    if (!url || url.startsWith('data:')) {
      skipped += 1
      continue
    }

    const originRaw = item.origin
    const origin =
      typeof originRaw === 'string' && IMPORT_ORIGINS.has(originRaw as ResearchEvidenceLogOrigin)
        ? (originRaw as ResearchEvidenceLogOrigin)
        : null
    if (!origin) {
      skipped += 1
      continue
    }

    const createdAt = numField(item.createdAt)
    if (createdAt === undefined) {
      skipped += 1
      continue
    }

    const accessedAt = numField(item.accessedAt)
    const chatHistoryIndex = numField(item.chatHistoryIndex)
    const entry: ResearchEvidenceLogEntry = {
      id,
      documentId: targetDocumentId,
      createdAt,
      url,
      origin,
    }

    if (accessedAt !== undefined) entry.accessedAt = accessedAt
    const canonicalUrl = strField(item.canonicalUrl, 4096)
    if (canonicalUrl) entry.canonicalUrl = canonicalUrl
    const title = strField(item.title, 2000)
    if (title) entry.title = title
    const snippet = strField(item.snippet, 8000)
    if (snippet) entry.snippet = snippet
    const indexedFromUserPrompt = strField(item.indexedFromUserPrompt, 8000)
    if (indexedFromUserPrompt) entry.indexedFromUserPrompt = indexedFromUserPrompt
    const userComment = strField(item.userComment, 8000)
    if (userComment) entry.userComment = userComment
    const addedBy = strField(item.addedBy, 512)
    if (addedBy) entry.addedBy = addedBy
    const supersedesId = strField(item.supersedesId, 200)
    if (supersedesId) entry.supersedesId = supersedesId

    if (chatHistoryIndex !== undefined && Number.isFinite(chatHistoryIndex)) {
      entry.chatHistoryIndex = Math.floor(chatHistoryIndex)
    }

    const anchor = parseImportedAnchor(item.anchor)
    if (anchor) entry.anchor = anchor

    entries.push(entry)
  }

  if (entries.length === 0 && parsed.length > 0) {
    throw new Error(
      'No se importó ninguna entrada: revisa que el JSON sea el exportado desde CriterIA (url, origin y createdAt obligatorios).',
    )
  }

  return { entries, skipped }
}
