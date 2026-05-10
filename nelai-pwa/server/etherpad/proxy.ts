/**
 * Reverse-proxy de Etherpad para mantener same-origin entre la PWA y el pad.
 *
 * En desarrollo, Vite proxea estos paths al contenedor Etherpad (ver `vite.config.ts`).
 * En producción (p. ej. Railway), el servicio Express asume ese rol y reenvía al
 * Etherpad interno expuesto vía la red privada del proveedor.
 *
 * Si `ETHERPAD_INTERNAL_URL` no está definida, el proxy se omite y los paths
 * caen al fallback SPA (modo "sin Etherpad" — el editor Quill clásico sigue
 * funcionando).
 */
import type { Application, RequestHandler } from 'express'
import type { Server as HttpServer, IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import { createProxyMiddleware, type Options } from 'http-proxy-middleware'

/**
 * Handler producido por `http-proxy-middleware` con la propiedad `upgrade`
 * usada para enrutar WebSockets desde el evento `'upgrade'` del server HTTP.
 */
type ProxyHandler = RequestHandler & {
  upgrade?: (req: IncomingMessage, socket: Socket, head: Buffer) => void
}

/** Paths del cliente Etherpad que deben llegar al servicio interno (no a la SPA). */
const ETHERPAD_PASSTHROUGH_PATHS = [
  '/p',
  '/ep',
  '/static',
  '/locales',
  '/pluginfw',
  '/jserror',
] as const

function isProxyEnabled(): boolean {
  return Boolean(String(process.env.ETHERPAD_INTERNAL_URL || '').trim())
}

function getTarget(): string {
  return String(process.env.ETHERPAD_INTERNAL_URL || '').trim()
}

function logOnError(prefix: string): NonNullable<Options['on']>['error'] {
  return (err, _req, res) => {
    console.error(`[${prefix}] proxy error:`, err instanceof Error ? err.message : err)
    if (res && 'writeHead' in res && typeof (res as { writeHead?: unknown }).writeHead === 'function') {
      try {
        ;(res as { writeHead: (code: number, headers: Record<string, string>) => void }).writeHead(
          502,
          { 'content-type': 'text/plain; charset=utf-8' },
        )
        ;(res as { end: (body: string) => void }).end('Etherpad no disponible')
      } catch {
        // si ya se inició la respuesta, no hay nada que hacer
      }
    }
  }
}

let registeredWsHandlers: ProxyHandler[] = []
let proxyMounted = false

/**
 * Monta el proxy en la app Express. Llamar ANTES de los handlers SPA y del 404
 * para que estos paths no caigan al fallback de `index.html`.
 *
 * Devuelve `true` si el proxy quedó montado, `false` si se omitió por falta de
 * configuración (sin Etherpad).
 */
export function mountEtherpadProxy(app: Application): boolean {
  if (!isProxyEnabled()) {
    console.log('[Etherpad-Proxy] ETHERPAD_INTERNAL_URL no definida; reverse-proxy desactivado.')
    return false
  }

  const target = getTarget()
  console.log(
    `[Etherpad-Proxy] Reenviando /pad, /socket.io, ${ETHERPAD_PASSTHROUGH_PATHS.join(', ')} → ${target}`,
  )

  // /pad → reescribe a la raíz del Etherpad (tal como en vite.config.ts).
  const padHandler = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/pad': '' },
    on: { error: logOnError('Etherpad-Proxy:/pad') },
  }) as ProxyHandler
  app.use('/pad', padHandler)

  // socket.io con upgrade a WebSocket. Sin esto los pads no sincronizan.
  const socketIoHandler = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    on: { error: logOnError('Etherpad-Proxy:/socket.io') },
  }) as ProxyHandler
  app.use('/socket.io', socketIoHandler)

  // Algunos clientes de Etherpad construyen URLs con el prefijo del embed.
  const padSocketIoHandler = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/pad': '' },
    on: { error: logOnError('Etherpad-Proxy:/pad/socket.io') },
  }) as ProxyHandler
  app.use('/pad/socket.io', padSocketIoHandler)

  // Resto de paths que Etherpad genera como absolutos (no necesitan WS).
  for (const p of ETHERPAD_PASSTHROUGH_PATHS) {
    const handler = createProxyMiddleware({
      target,
      changeOrigin: true,
      on: { error: logOnError(`Etherpad-Proxy:${p}`) },
    }) as ProxyHandler
    app.use(p, handler)
  }

  registeredWsHandlers = [padHandler, socketIoHandler, padSocketIoHandler]
  proxyMounted = true
  return true
}

/**
 * Engancha los WebSocket upgrades al server HTTP. Llamar DESPUÉS de `app.listen`.
 * Sin esto, el evento `upgrade` no llega al middleware y el cliente Etherpad
 * cae en polling permanente o falla con timeout.
 */
export function attachEtherpadWebSocketUpgrade(server: HttpServer): void {
  if (!proxyMounted) return
  server.on('upgrade', (req, socket, head) => {
    const url = req.url || ''
    const handler = registeredWsHandlers.find((h) => {
      if (!h.upgrade) return false
      if (url.startsWith('/pad/socket.io')) return h === registeredWsHandlers[2]
      if (url.startsWith('/socket.io')) return h === registeredWsHandlers[1]
      if (url.startsWith('/pad')) return h === registeredWsHandlers[0]
      return false
    })
    if (handler?.upgrade) {
      handler.upgrade(req, socket as Socket, head as Buffer)
      return
    }
    // Fallback: cerrar el socket si el path no corresponde a ningún proxy.
    socket.destroy()
  })
}
