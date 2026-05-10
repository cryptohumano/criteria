export class EtherpadApiError extends Error {
  readonly code: number

  constructor(message: string, code: number) {
    super(message)
    this.name = 'EtherpadApiError'
    this.code = code
  }
}

type EtherpadRawResponse = {
  code: number
  message?: string
  data?: unknown
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export async function etherpadCall(
  baseUrl: string,
  apiKey: string,
  methodName: string,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  // Etherpad API soporta GET y POST, pero **GET rompe fácilmente** para métodos como setText
  // porque el parámetro `text` acaba en la URL (límites/proxies/encoding). Usamos POST siempre.
  const url = new URL(`${normalizeBaseUrl(baseUrl)}/api/1/${methodName}`)
  const body = new URLSearchParams()
  body.set('apikey', apiKey)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') body.set(k, v)
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body,
  })

  // Etherpad normalmente responde JSON, pero si algo falla puede devolver vacío/HTML.
  const raw = await res.text()
  let json: EtherpadRawResponse
  try {
    json = raw ? (JSON.parse(raw) as EtherpadRawResponse) : ({ code: res.status, message: '' } as EtherpadRawResponse)
  } catch (e: unknown) {
    const snippet = raw.slice(0, 400)
    throw new EtherpadApiError(
      `Respuesta no-JSON de Etherpad (HTTP ${res.status}). Body: ${snippet || '[vacío]'}`,
      res.status,
    )
  }

  if (!res.ok) {
    throw new EtherpadApiError(json.message || `HTTP ${res.status}`, json.code ?? res.status)
  }
  if (json.code !== 0) {
    throw new EtherpadApiError(json.message || 'Etherpad API error', json.code)
  }
  return json.data
}

export async function createGroupIfNotExistsFor(
  baseUrl: string,
  apiKey: string,
  groupMapper: string,
): Promise<string> {
  const data = await etherpadCall(baseUrl, apiKey, 'createGroupIfNotExistsFor', {
    groupMapper,
  })
  const groupID = (data as { groupID?: unknown })?.groupID
  if (typeof groupID !== 'string' || !groupID) throw new Error('Etherpad: groupID inválido')
  return groupID
}

export async function createAuthorIfNotExistsFor(
  baseUrl: string,
  apiKey: string,
  authorMapper: string,
  name: string,
): Promise<string> {
  const data = await etherpadCall(baseUrl, apiKey, 'createAuthorIfNotExistsFor', {
    authorMapper,
    name,
  })
  const authorID = (data as { authorID?: unknown })?.authorID
  if (typeof authorID !== 'string' || !authorID) throw new Error('Etherpad: authorID inválido')
  return authorID
}

export async function createGroupPad(
  baseUrl: string,
  apiKey: string,
  groupID: string,
  padName: string,
  text = ' ',
): Promise<string> {
  const data = await etherpadCall(baseUrl, apiKey, 'createGroupPad', {
    groupID,
    padName,
    text,
  })
  const padID = (data as { padID?: unknown })?.padID
  if (typeof padID !== 'string' || !padID) throw new Error('Etherpad: padID inválido')
  return padID
}

/**
 * Crea el group pad si no existe.
 * Siempre devuelve el ID canónico `groupID$padName` (el que Etherpad usa en getText/setText y en la URL),
 * para que coincida entre rutas aunque `createGroupPad` devolviera otro formato en respuestas antiguas.
 */
export async function ensureGroupPad(
  baseUrl: string,
  apiKey: string,
  groupID: string,
  padName: string,
  text = ' ',
): Promise<string> {
  const canonical = `${groupID}$${padName}`
  try {
    await createGroupPad(baseUrl, apiKey, groupID, padName, text)
    return canonical
  } catch (e: unknown) {
    if (e instanceof EtherpadApiError) {
      const msg = e.message.toLowerCase()
      if (msg.includes('already exists') || msg.includes('does already exist')) {
        return canonical
      }
    }
    throw e
  }
}

export async function createSession(
  baseUrl: string,
  apiKey: string,
  groupID: string,
  authorID: string,
  validUntilUnixSeconds: number,
): Promise<string> {
  const data = await etherpadCall(baseUrl, apiKey, 'createSession', {
    groupID,
    authorID,
    validUntil: String(validUntilUnixSeconds),
  })
  const sessionID = (data as { sessionID?: unknown })?.sessionID
  if (typeof sessionID !== 'string' || !sessionID) throw new Error('Etherpad: sessionID inválido')
  return sessionID
}

/** Crea el pad si no existe (ignora error de pad ya existente). */
export async function ensurePad(
  baseUrl: string,
  apiKey: string,
  padId: string,
  initialText = ' ',
): Promise<void> {
  try {
    await etherpadCall(baseUrl, apiKey, 'createPad', {
      padID: padId,
      text: initialText,
    })
  } catch (e: unknown) {
    if (e instanceof EtherpadApiError) {
      const msg = e.message.toLowerCase()
      if (msg.includes('already exists') || msg.includes('does already exist')) return
      // Respuesta típica cuando el pad existe
      if (e.code === 1 && msg.includes('pad')) return
    }
    throw e
  }
}

export async function getPadText(baseUrl: string, apiKey: string, padId: string): Promise<string> {
  const data = await etherpadCall(baseUrl, apiKey, 'getText', { padID: padId })
  if (data && typeof data === 'object' && 'text' in data) {
    const t = (data as { text?: unknown }).text
    return typeof t === 'string' ? t : ''
  }
  return ''
}

export async function setPadText(baseUrl: string, apiKey: string, padId: string, text: string): Promise<void> {
  await etherpadCall(baseUrl, apiKey, 'setText', { padID: padId, text })
}
