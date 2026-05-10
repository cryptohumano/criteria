import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react'
import { ChainInfo, useDedotClient, DEFAULT_CHAINS } from '@/hooks/useDedotClient'
import { DedotClient } from 'dedot'

interface NetworkContextType {
  selectedChain: ChainInfo | null
  setSelectedChain: (chain: ChainInfo | null) => void
  client: DedotClient | null
  isConnecting: boolean
  error: string | null
  connectedEndpoint: string | null
}

// Exportar el contexto para uso directo si es necesario
export const NetworkContext = createContext<NetworkContextType | undefined>(undefined)

export function NetworkProvider({ children }: { children: ReactNode }) {
  // Asset Hub (Paseo) como red por defecto
  const defaultChain = DEFAULT_CHAINS.find(c => c.endpoint === 'wss://sys.ibp.network/asset-hub-paseo') || DEFAULT_CHAINS[0]
  const [selectedChain, setSelectedChain] = useState<ChainInfo | null>(defaultChain)
  const { client, isConnecting, error, connectedEndpoint } = useDedotClient(selectedChain?.endpoint || null)
  
  // Asegurar que siempre haya una red seleccionada
  useEffect(() => {
    if (!selectedChain) {
      setSelectedChain(defaultChain)
    }
  }, [selectedChain, defaultChain])

  return (
    <NetworkContext.Provider
      value={{
        selectedChain,
        setSelectedChain,
        client,
        isConnecting,
        error: error || null,
        connectedEndpoint: connectedEndpoint || null,
      }}
    >
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider')
  }
  return context
}

