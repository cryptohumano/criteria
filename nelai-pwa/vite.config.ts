import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import os from 'os'

// Detectar si existen certificados SSL
const httpsConfig = (() => {
  const certPath = path.resolve(__dirname, '.certs/cert.pem')
  const keyPath = path.resolve(__dirname, '.certs/key.pem')
  
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    }
  }
  return false
})()

// Obtener IP local para acceso desde móvil
function getLocalIP(): string {
  try {
    const interfaces = os.networkInterfaces()
    if (!interfaces) return 'localhost'
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address
        }
      }
    }
  } catch {
    // Si no se puede obtener, usar localhost
  }
  return 'localhost'
}

const LOCAL_IP = getLocalIP()

// Resolver el `base` de Vite según el entorno.
// - `VITE_BASE_URL` explícito gana (útil para CI / Railway / testing).
// - Dev server (`vite serve`): `/` (evita 404 al refrescar rutas SPA).
// - Build con `GITHUB_REPOSITORY`: `/<repo>/` (GitHub Pages).
// - Cualquier otro build (Railway, contenedor propio, hosting estático en raíz): `/`.
const getBase = (isDevServer: boolean) => {
  if (process.env.VITE_BASE_URL) {
    return process.env.VITE_BASE_URL
  }

  if (isDevServer) {
    return '/'
  }

  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (repoName && !repoName.includes('.github.io')) {
    return `/${repoName}/`
  }

  return '/'
}

// Calcular el base path dinámicamente (se recalcula cada vez que se accede)
// Esto asegura que las variables de entorno estén disponibles durante el build
// Nota: el log del base se hace dentro de defineConfig para reflejar `command` (serve/build).

// Plugin para transformar rutas en index.html durante el build
// IMPORTANTE: Vite transforma automáticamente los scripts cuando base está configurado
// Este plugin ajusta rutas estáticas que Vite no transforma automáticamente
const transformHtmlPlugin = (basePath: string) => {
  return {
    name: 'transform-html',
    enforce: 'post' as const, // Ejecutar después de otros plugins (incluyendo VitePWA)
    transformIndexHtml(html: string) {
      // Solo transformar en producción con base path
      if (process.env.NODE_ENV === 'production' && basePath !== '/') {
        let transformed = html

        // Reemplazar rutas absolutas de favicons y otros assets estáticos
        // Estos no son transformados automáticamente por Vite
        transformed = transformed.replace(
          /href="\/(favicon|apple-touch-icon)/g,
          `href="${basePath}$1`,
        )

        // Asegurar que todas las rutas de assets compilados tengan el base path
        if (!transformed.includes(`${basePath}assets/`)) {
          transformed = transformed.replace(/(src|href)="\/assets\//g, `$1="${basePath}assets/`)
        }

        return transformed
      }
      return html
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = (env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3456').replace(/\/+$/, '')
  const isDevServer = command === 'serve'
  const base = getBase(isDevServer)
  /** SaaS en local: sin SW (Stripe /settings, /api, OAuth). PWA en dev solo con `VITE_PWA_DEV=true`. */
  const viteAppMode = (process.env.VITE_APP_MODE || env.VITE_APP_MODE || '').toLowerCase().trim()
  const pwaDevExplicit = process.env.VITE_PWA_DEV === 'true'
  const disablePwaInSaasDev = isDevServer && viteAppMode === 'saas' && !pwaDevExplicit

  // Log para debugging
  console.log('[Vite Config] Base path calculado:', base)
  console.log('[Vite Config] command:', command)
  console.log('[Vite Config] GITHUB_REPOSITORY:', process.env.GITHUB_REPOSITORY)
  console.log('[Vite Config] NODE_ENV:', process.env.NODE_ENV)
  console.log('[Vite Config] VITE_BASE_URL:', process.env.VITE_BASE_URL)
  if (disablePwaInSaasDev) {
    console.log('[Vite Config] PWA desactivado en dev SaaS (sin VITE_PWA_DEV). Usa VITE_PWA_DEV=true para SW local.')
  }

  if (command === 'build' && (!base || base === '/')) {
    console.log('[Vite Config] Base path "/" (raíz). OK para Railway / hosting propio. Para GitHub Pages necesitas VITE_BASE_URL=/<repo>/ o GITHUB_REPOSITORY.')
  }

  // Solo en `vite serve`: evita que `vite:import-analysis` intente parsear `index.html` como JS
  // (error junto a `</title>`). En `vite build` NO usar `**/*.html` aquí: Vite emitiría
  // `dist/index.html` como stub `export default "…/assets/index-….html"` y rompería producción.
  const devOnlyAssetsInclude = isDevServer ? (['**/*.html'] as const) : undefined

  return {
  base,
  ...(devOnlyAssetsInclude ? { assetsInclude: [...devOnlyAssetsInclude] } : {}),
  server: {
    host: '0.0.0.0', // Permitir acceso desde la red local
    port: 5173,
    // Deshabilitar HTTPS para desarrollo (comentar si necesitas HTTPS)
    // https: httpsConfig || undefined,
    strictPort: true,
    // Cuando el cliente usa VITE_API_USE_SAME_ORIGIN, las peticiones a /api van al mismo origen (p. ej. :5173) y se reenvían al Express.
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      /**
       * Etherpad embebido: servir bajo el mismo origen para evitar bloqueo de cookies en iFrame
       * (Chrome y otros browsers tratan localhost:5173 -> localhost:9001 como third-party por puerto).
       */
      '/pad': {
        target: env.VITE_ETHERPAD_PROXY_TARGET || 'http://127.0.0.1:9001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/pad/, ''),
      },
      // Etherpad genera muchas URLs absolutas (en raíz) aunque lo embebamos bajo /pad.
      // Sin estas reglas, el navegador pide /p, /static, etc. al Vite server y se rompe el cliente.
      // Importante: el match de Vite es por prefijo; `/p` también capturaría `/platform`, `/privacy`, etc.
      // y al recargar esas rutas Etherpad responde "Cannot GET …". Solo proxear rutas reales de pad.
      '/p': {
        target: env.VITE_ETHERPAD_PROXY_TARGET || 'http://127.0.0.1:9001',
        changeOrigin: true,
        bypass(req) {
          const pathname = (req.url || '').split('?')[0] || ''
          if (pathname === '/p' || pathname.startsWith('/p/')) return false
          return '/index.html'
        },
      },
      '/static': {
        target: env.VITE_ETHERPAD_PROXY_TARGET || 'http://127.0.0.1:9001',
        changeOrigin: true,
      },
      '/pluginfw': {
        target: env.VITE_ETHERPAD_PROXY_TARGET || 'http://127.0.0.1:9001',
        changeOrigin: true,
      },
      '/locales': {
        target: env.VITE_ETHERPAD_PROXY_TARGET || 'http://127.0.0.1:9001',
        changeOrigin: true,
      },
      '/ep': {
        target: env.VITE_ETHERPAD_PROXY_TARGET || 'http://127.0.0.1:9001',
        changeOrigin: true,
      },
      // Etherpad (socket.io) NO se cuelga de /pad/... sino de /socket.io en raíz.
      // Si no lo proxyeamos, el pad rompe con errores de cliente.
      '/socket.io': {
        target: env.VITE_ETHERPAD_PROXY_TARGET || 'http://127.0.0.1:9001',
        changeOrigin: true,
        ws: true,
      },
      // En algunos casos Etherpad construye la URL con el prefijo del embed (/pad/socket.io).
      '/pad/socket.io': {
        target: env.VITE_ETHERPAD_PROXY_TARGET || 'http://127.0.0.1:9001',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/pad/, ''),
      },
      // Reporte de errores del cliente Etherpad.
      '/jserror': {
        target: env.VITE_ETHERPAD_PROXY_TARGET || 'http://127.0.0.1:9001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    transformHtmlPlugin(base),
    VitePWA({
      disable: disablePwaInSaasDev,
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico', 
        'favicon.svg', 
        'favicon-96x96.png',
        'apple-touch-icon.png',
        'web-app-manifest-192x192.png',
        'web-app-manifest-512x512.png'
      ],
      base: base,
      scope: base,
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // En dev, base='/' y esto permite navegar/refrescar rutas SPA sin 404.
        navigateFallback: base === '/' ? '/index.html' : base + 'index.html',
        // Sin excluir /api/, el SW intercepta `window.location.href = /api/auth/google/start`
        // y sirve index.html: React Router muestra 404 y OAuth nunca llega al servidor.
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/, /^\/api\//],
        // Misma semántica que Workbox cuando solo hay denylist: cualquier ruta SPA
        // (Stripe redirige a /settings?billing=success; sin esto el SW en dev usa solo /^\/$/).
        navigateFallbackAllowlist: [/./],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB (aumentado de 2 MB por defecto)
        runtimeCaching: [
          {
            // Proxy / API en otro origen (p. ej. http://localhost:3456) — sin caché del SW
            urlPattern: ({ url }: { url: URL }) =>
              (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
              url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
            options: {},
          },
          {
            // Regla específica para staticmap - NetworkOnly para que no intente cachear
            // Esta regla debe ir ANTES de la regla general para tener prioridad
            urlPattern: /^https:\/\/.*staticmap\.openstreetmap\.(de|org|fr)\/.*/,
            handler: 'NetworkOnly',
            options: {
              // No cachear nada, solo intentar la red
              // Si falla, el error se propaga normalmente al componente sin que Workbox interfiera
            }
          },
          {
            // Regla general para otros recursos externos
            // Excluir explícitamente staticmap para que use la regla anterior (NetworkOnly)
            urlPattern: ({ url }: { url: URL }) => {
              // Solo procesar URLs HTTPS que NO sean de staticmap
              return url.protocol === 'https:' && !url.hostname.includes('staticmap.openstreetmap')
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 horas
              },
              matchOptions: {
                ignoreSearch: false,
              }
            }
          }
        ]
      },
      manifest: {
        name: 'criterIA',
        short_name: 'criterIA',
        description: 'Procedencia y autenticidad verificables con identidad Polkadot y DKG',
        theme_color: '#0D9488',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        categories: ['finance', 'utilities', 'productivity'],
        lang: 'es',
        dir: 'ltr',
        icons: [
          {
            src: `${base}web-app-manifest-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: `${base}web-app-manifest-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: `${base}web-app-manifest-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [],
        shortcuts: [
          {
            name: 'Inicio',
            short_name: 'Inicio',
            description: 'Ver resumen de cuentas y balances',
            url: base,
            icons: [{ src: `${base}web-app-manifest-192x192.png`, sizes: '192x192' }]
          },
          {
            name: 'Enviar',
            short_name: 'Enviar',
            description: 'Enviar tokens a otra dirección',
            url: base + 'send',
            icons: [{ src: `${base}web-app-manifest-192x192.png`, sizes: '192x192' }]
          },
          {
            name: 'Cuentas',
            short_name: 'Cuentas',
            description: 'Gestionar cuentas del wallet',
            url: base + 'accounts',
            icons: [{ src: `${base}web-app-manifest-192x192.png`, sizes: '192x192' }]
          },
          {
            name: 'Identidad',
            short_name: 'Identidad',
            description: 'Gestionar identidad y privacidad',
            url: base + 'identity',
            icons: [{ src: `${base}web-app-manifest-192x192.png`, sizes: '192x192' }]
          }
        ]
      },
      // SW en `vite serve` solo si el plugin no está desactivado (ver `disablePwaInSaasDev`) y `VITE_PWA_DEV=true`.
      devOptions: {
        enabled: process.env.VITE_PWA_DEV === 'true',
        type: 'module',
        navigateFallbackAllowlist: [/./],
      },
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Evitar ENOENT: react-quill no existe, usamos react-quill-new
      'react-quill': path.resolve(__dirname, 'node_modules/react-quill-new'),
      // Vite externaliza "buffer" en el cliente si no se enlaza al paquete npm (p. ej. quill / deps)
      buffer: path.resolve(__dirname, 'node_modules/buffer'),
    },
  },
  define: {
    'process.env': {},
    'global': 'globalThis',
    'process.browser': true,
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    include: ['buffer', 'react-quill-new'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  }
})

