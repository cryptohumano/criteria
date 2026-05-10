import { useEffect, useState } from 'react'
import { DedotClient, WsProvider } from 'dedot'

export interface ChainInfo {
  name: string
  endpoint: string
  description?: string
  /** Prefijo SS58 para formatear direcciones (0=Polkadot, 2=Kusama, 42=Generic/Paseo) */
  ss58Prefix?: number
}

/** Mapeo endpoint -> prefijo SS58 (0=Polkadot, 2=Kusama, 42=Generic/Paseo) */
const ENDPOINT_SS58: Record<string, number> = {
  'wss://rpc.ibp.network/polkadot': 0,
  'wss://rpc.ibp.network/kusama': 2,
  'wss://rpc.ibp.network/paseo': 42,
  'wss://sys.ibp.network/asset-hub-paseo': 42,
  'wss://sys.ibp.network/bridgehub-paseo': 42,
  'wss://sys.ibp.network/coretime-paseo': 42,
  'wss://sys.ibp.network/people-paseo': 42,
  'wss://sys.ibp.network/collectives-paseo': 42,
  'wss://sys.ibp.network/asset-hub-polkadot': 0,
  'wss://sys.ibp.network/asset-hub-kusama': 2,
  'wss://sys.ibp.network/people-polkadot': 0,
  'wss://sys.ibp.network/people-kusama': 2,
  'wss://sys.ibp.network/bridgehub-polkadot': 0,
  'wss://sys.ibp.network/coretime-polkadot': 0,
  'wss://sys.ibp.network/collectives-polkadot': 0,
}

export const DEFAULT_CHAINS: ChainInfo[] = [
  {
    name: 'Polkadot',
    endpoint: 'wss://rpc.ibp.network/polkadot',
    description: 'Red principal de Polkadot (IBP)',
    ss58Prefix: 0,
  },
  {
    name: 'Kusama',
    endpoint: 'wss://rpc.ibp.network/kusama',
    description: 'Red canary de Polkadot (IBP)',
    ss58Prefix: 2,
  },
  {
    name: 'Paseo Relay Chain',
    endpoint: 'wss://rpc.ibp.network/paseo',
    description: 'Paseo Relay Chain - Testnet de Polkadot',
    ss58Prefix: 42,
  },
  {
    name: 'Asset Hub (Paseo)',
    endpoint: 'wss://sys.ibp.network/asset-hub-paseo',
    description: 'Asset Hub de Paseo - Gestión de activos y NFTs',
    ss58Prefix: 42,
  },
  {
    name: 'Bridge Hub (Paseo)',
    endpoint: 'wss://sys.ibp.network/bridgehub-paseo',
    description: 'Bridge Hub de Paseo - Puentes entre cadenas',
    ss58Prefix: 42,
  },
  {
    name: 'Coretime (Paseo)',
    endpoint: 'wss://sys.ibp.network/coretime-paseo',
    description: 'Coretime Chain de Paseo - Gestión de coretime',
    ss58Prefix: 42,
  },
  {
    name: 'People (Paseo)',
    endpoint: 'wss://sys.ibp.network/people-paseo',
    description: 'People Chain de Paseo - Sistema de identidad',
    ss58Prefix: 42,
  },
  {
    name: 'Collectives (Paseo)',
    endpoint: 'wss://sys.ibp.network/collectives-paseo',
    description: 'Collectives Chain de Paseo - Gobernanza y colectivos',
    ss58Prefix: 42,
  },
  {
    name: 'Asset Hub (Polkadot)',
    endpoint: 'wss://sys.ibp.network/asset-hub-polkadot',
    description: 'Asset Hub de Polkadot - Gestión de activos y NFTs (IBP)',
    ss58Prefix: 0,
  },
  {
    name: 'Asset Hub (Kusama)',
    endpoint: 'wss://sys.ibp.network/asset-hub-kusama',
    description: 'Asset Hub de Kusama - Gestión de activos y NFTs (IBP)',
    ss58Prefix: 2,
  },
  {
    name: 'People Chain (Polkadot)',
    endpoint: 'wss://sys.ibp.network/people-polkadot',
    description: 'People Chain de Polkadot - Sistema de identidad (IBP)',
    ss58Prefix: 0,
  },
  {
    name: 'People Chain (Kusama)',
    endpoint: 'wss://sys.ibp.network/people-kusama',
    description: 'People Chain de Kusama - Sistema de identidad (IBP)',
    ss58Prefix: 2,
  },
  {
    name: 'Bridge Hub (Polkadot)',
    endpoint: 'wss://sys.ibp.network/bridgehub-polkadot',
    description: 'Bridge Hub de Polkadot - Puentes entre cadenas (IBP)',
    ss58Prefix: 0,
  },
  {
    name: 'Coretime (Polkadot)',
    endpoint: 'wss://sys.ibp.network/coretime-polkadot',
    description: 'Coretime Chain de Polkadot - Gestión de coretime (IBP)',
    ss58Prefix: 0,
  },
  {
    name: 'Collectives (Polkadot)',
    endpoint: 'wss://sys.ibp.network/collectives-polkadot',
    description: 'Collectives Chain de Polkadot - Gobernanza y colectivos (IBP)',
    ss58Prefix: 0,
  },
]

// Endpoints alternativos para cadenas conocidas
// Usando IBP (Infrastructure Builders' Programme) como principal y dotters.network como fallback
// Referencia: https://wiki.ibp.network/docs/consumers/archives
const FALLBACK_ENDPOINTS: Record<string, string[]> = {
  // Polkadot Relay Chain
  'wss://rpc.ibp.network/polkadot': [
    'wss://polkadot.dotters.network',
    'wss://rpc.polkadot.io',
  ],
  // Kusama Relay Chain
  'wss://rpc.ibp.network/kusama': [
    'wss://kusama.dotters.network',
    'wss://kusama-rpc.polkadot.io',
  ],
  // Asset Hub (Polkadot)
  'wss://sys.ibp.network/asset-hub-polkadot': [
    'wss://asset-hub-polkadot.dotters.network',
    'wss://polkadot-asset-hub-rpc.polkadot.io',
    'wss://statemint-rpc.polkadot.io',
  ],
  // Asset Hub (Kusama)
  'wss://sys.ibp.network/asset-hub-kusama': [
    'wss://asset-hub-kusama.dotters.network',
    'wss://kusama-asset-hub-rpc.polkadot.io',
    'wss://statemine-rpc.polkadot.io',
  ],
  // People Chain (Polkadot)
  'wss://sys.ibp.network/people-polkadot': [
    'wss://people-polkadot.dotters.network',
    'wss://polkadot-people-rpc.polkadot.io',
  ],
  // People Chain (Kusama)
  'wss://sys.ibp.network/people-kusama': [
    'wss://people-kusama.dotters.network',
    'wss://kusama-people-rpc.polkadot.io',
  ],
  // Bridge Hub (Polkadot)
  'wss://sys.ibp.network/bridgehub-polkadot': [
    'wss://bridge-hub-polkadot.dotters.network',
  ],
  // Coretime (Polkadot)
  'wss://sys.ibp.network/coretime-polkadot': [
    'wss://coretime-polkadot.dotters.network',
  ],
  // Collectives (Polkadot)
  'wss://sys.ibp.network/collectives-polkadot': [
    'wss://collectives-polkadot.dotters.network',
  ],
  // Paseo Relay Chain
  'wss://rpc.ibp.network/paseo': [
    'wss://paseo.dotters.network',
  ],
  // Asset Hub (Paseo)
  'wss://sys.ibp.network/asset-hub-paseo': [
    'wss://asset-hub-paseo.dotters.network',
  ],
  // Bridge Hub (Paseo)
  'wss://sys.ibp.network/bridgehub-paseo': [
    'wss://bridge-hub-paseo.dotters.network',
  ],
  // Coretime (Paseo)
  'wss://sys.ibp.network/coretime-paseo': [
    'wss://coretime-paseo.dotters.network',
  ],
  // People (Paseo)
  'wss://sys.ibp.network/people-paseo': [
    'wss://people-paseo.dotters.network',
  ],
  // Collectives (Paseo)
  'wss://sys.ibp.network/collectives-paseo': [
    'wss://collectives-paseo.dotters.network',
  ],
}

async function tryConnectWithFallback(
  primaryEndpoint: string,
  fallbacks: string[] = []
): Promise<{ client: DedotClient; endpoint: string }> {
  const allEndpoints = [primaryEndpoint, ...fallbacks]
  let lastError: Error | null = null

  for (const endpoint of allEndpoints) {
    try {
      const provider = new WsProvider(endpoint)
      await provider.connect()
      
      // Crear el cliente con manejo de errores
      // El error "Cannot read properties of undefined (reading 'hash')" 
      // puede ocurrir en eventos de seguimiento internos de Dedot
      // Estos errores no afectan la funcionalidad principal, así que los ignoramos
      const client = await DedotClient.new(provider)
      
      // Agregar un manejador de errores no capturados para eventos internos
      // Esto previene que errores internos de Dedot rompan la aplicación
      if (typeof window !== 'undefined') {
        // Función helper para detectar errores internos de Dedot
        const isDedotInternalError = (message: string, error?: Error): boolean => {
          const errorString = String(message)
          const stack = error?.stack || ''
          const hasHashError = errorString.includes('hash') && 
            (errorString.includes('undefined') || errorString.includes('Cannot read properties'))
          const hasStackHashError = stack.includes('hash') && 
            (stack.includes('undefined') || stack.includes('Cannot read properties'))
          const hasOnFollowEventError = stack.includes('#onFollowEvent') && 
            (errorString.includes('hash') || errorString.includes('undefined'))
          const hasDedotJsError = stack.includes('dedot.js') && errorString.includes('hash')
          
          return hasHashError || hasStackHashError || hasOnFollowEventError || hasDedotJsError
        }

        // Manejador de errores síncronos
        const originalErrorHandler = window.onerror
        window.onerror = (message, source, lineno, colno, error) => {
          const messageStr = typeof message === 'string' ? message : String(message)
          if (isDedotInternalError(messageStr, error)) {
            // Solo loguear en modo debug para no saturar la consola
            if (process.env.NODE_ENV === 'development') {
              console.debug('[DedotClient] ⚠️ Error interno de Dedot ignorado:', messageStr.substring(0, 100))
            }
            return true // Prevenir que el error se propague
          }
          // Llamar al manejador original para otros errores
          if (originalErrorHandler) {
            const result = originalErrorHandler(message, source, lineno, colno, error)
            return result === true
          }
          return false
        }

        // Manejador de promesas rechazadas (errores asíncronos)
        const originalRejectionHandler = window.onunhandledrejection
        window.onunhandledrejection = (event: PromiseRejectionEvent) => {
          const reason = event.reason
          const error = reason instanceof Error ? reason : new Error(String(reason))
          const message = error.message || String(reason)
          
          if (isDedotInternalError(message, error)) {
            // Solo loguear en modo debug para no saturar la consola
            if (process.env.NODE_ENV === 'development') {
              console.debug('[DedotClient] ⚠️ Promesa rechazada de Dedot ignorada:', message.substring(0, 100))
            }
            event.preventDefault() // Prevenir que el error se propague
            return
          }
          
          // Llamar al manejador original para otros errores
          if (originalRejectionHandler) {
            if (typeof originalRejectionHandler === 'function') {
              originalRejectionHandler.call(window, event)
            }
          }
        }
      }
      
      console.log(`[DedotClient] ✅ Conectado a ${endpoint}`)
      return { client, endpoint }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      // Ignorar errores específicos de eventos internos de Dedot
      if (
        lastError.message.includes('hash') && 
        (lastError.stack?.includes('onFollowEvent') || lastError.message.includes('onFollowEvent'))
      ) {
        console.warn(`[DedotClient] ⚠️ Error interno de Dedot al conectar a ${endpoint} (continuando):`, lastError.message)
        continue
      }
      console.warn(`[DedotClient] ⚠️ Error al conectar a ${endpoint}:`, lastError.message)
      // Continuar con el siguiente endpoint
    }
  }

  throw lastError || new Error('No se pudo conectar a ningún endpoint')
}

export function useDedotClient(endpoint: string | null) {
  const [client, setClient] = useState<DedotClient | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectedEndpoint, setConnectedEndpoint] = useState<string | null>(null)

  useEffect(() => {
    if (!endpoint) {
      setClient(null)
      setConnectedEndpoint(null)
      return
    }

    setIsConnecting(true)
    setError(null)

    const fallbacks = FALLBACK_ENDPOINTS[endpoint] || []
    let newClient: DedotClient | null = null

    tryConnectWithFallback(endpoint, fallbacks)
      .then(({ client: connectedClient, endpoint: connectedEndpoint }) => {
        newClient = connectedClient
        setClient(connectedClient)
        setConnectedEndpoint(connectedEndpoint)
        setIsConnecting(false)
      })
      .catch((err) => {
        const errorMessage = err.message || 'Error al conectar'
        setError(errorMessage)
        setIsConnecting(false)
        setClient(null)
        setConnectedEndpoint(null)
        console.error(`[DedotClient] ❌ Error al conectar a ${endpoint}:`, errorMessage)
      })

    return () => {
      if (newClient) {
        newClient.disconnect().catch(() => {})
      }
    }
  }, [endpoint])

  return { client, isConnecting, error, connectedEndpoint }
}

