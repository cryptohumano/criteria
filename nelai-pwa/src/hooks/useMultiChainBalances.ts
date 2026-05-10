import { useState, useEffect, useCallback } from 'react'
import { DedotClient } from 'dedot'
import { DEFAULT_CHAINS, useDedotClient } from './useDedotClient'
import type { ChainInfo } from './useDedotClient'

export interface AccountBalance {
  chain: string
  chainName: string
  address: string
  free: bigint
  reserved: bigint
  frozen: bigint
  total: bigint
  nonce?: number
  lastUpdate?: number
}

export interface MultiChainBalanceResult {
  balances: AccountBalance[]
  isLoading: boolean
  error: string | null
  lastUpdate: number | null
}

/**
 * Hook para obtener balances de una cuenta en múltiples cadenas
 */
export function useMultiChainBalances(
  address: string | null,
  chains: ChainInfo[] = DEFAULT_CHAINS
): MultiChainBalanceResult {
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  const fetchBalance = useCallback(async (chain: ChainInfo, address: string): Promise<AccountBalance | null> => {
    try {
      const provider = new (await import('dedot')).WsProvider(chain.endpoint)
      await provider.connect()
      const client = await DedotClient.new(provider)

      try {
        // Query del balance de la cuenta
        const accountInfo = await client.query.system.account(address)
        
        const free = BigInt(accountInfo.data.free?.toString() || '0')
        const reserved = BigInt(accountInfo.data.reserved?.toString() || '0')
        const frozen = BigInt(accountInfo.data.frozen?.toString() || '0')
        const total = free + reserved

        // Query del nonce
        const nonce = accountInfo.nonce ? Number(accountInfo.nonce) : undefined

        await client.disconnect()

        return {
          chain: chain.endpoint,
          chainName: chain.name,
          address,
          free,
          reserved,
          frozen,
          total,
          nonce,
          lastUpdate: Date.now(),
        }
      } catch (err) {
        await client.disconnect()
        throw err
      }
    } catch (err: any) {
      console.error(`Error fetching balance from ${chain.name}:`, err)
      return null
    }
  }, [])

  const fetchAllBalances = useCallback(async () => {
    if (!address) {
      setBalances([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch balances en paralelo para todas las cadenas
      const balancePromises = chains.map(chain => fetchBalance(chain, address))
      const results = await Promise.all(balancePromises)

      // Filtrar resultados nulos (errores)
      const validBalances = results.filter((b): b is AccountBalance => b !== null)
      
      setBalances(validBalances)
      setLastUpdate(Date.now())
    } catch (err: any) {
      setError(err.message || 'Error al obtener balances')
      console.error('Error fetching multi-chain balances:', err)
    } finally {
      setIsLoading(false)
    }
  }, [address, chains, fetchBalance])

  useEffect(() => {
    fetchAllBalances()
  }, [fetchAllBalances])

  return {
    balances,
    isLoading,
    error,
    lastUpdate,
  }
}

// Importar useNetwork aquí para evitar dependencia circular
import { useNetwork } from '@/contexts/NetworkContext'

/**
 * Hook simplificado que usa el NetworkContext para obtener balance de la cadena actual
 */
export function useCurrentChainBalance(address: string | null) {
  const { client, selectedChain } = useNetwork()
  const [balance, setBalance] = useState<AccountBalance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!client || !address || !selectedChain) {
      setBalance(null)
      return
    }

    const fetchBalance = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const accountInfo = await client.query.system.account(address)
        
        const free = BigInt(accountInfo.data.free?.toString() || '0')
        const reserved = BigInt(accountInfo.data.reserved?.toString() || '0')
        const frozen = BigInt(accountInfo.data.frozen?.toString() || '0')
        const total = free + reserved
        const nonce = accountInfo.nonce ? Number(accountInfo.nonce) : undefined

        setBalance({
          chain: selectedChain.endpoint,
          chainName: selectedChain.name,
          address,
          free,
          reserved,
          frozen,
          total,
          nonce,
          lastUpdate: Date.now(),
        })
      } catch (err: any) {
        setError(err.message || 'Error al obtener balance')
        console.error('Error fetching balance:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBalance()
  }, [client, address, selectedChain])

  return { balance, isLoading, error }
}

