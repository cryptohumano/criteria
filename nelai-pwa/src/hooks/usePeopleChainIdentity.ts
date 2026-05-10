import { useState, useEffect, useCallback } from 'react'
import { DedotClient } from 'dedot'
import { WsProvider } from 'dedot'

// Endpoints de People Chain
// Usando IBP (Infrastructure Builders' Programme) como principal
// Referencia: https://wiki.ibp.network/docs/consumers/archives
const PEOPLE_CHAIN_ENDPOINTS = {
  polkadot: 'wss://sys.ibp.network/people-polkadot',
  kusama: 'wss://sys.ibp.network/people-kusama',
  paseo: 'wss://sys.ibp.network/people-paseo',
}

export interface IdentityInfo {
  display?: string
  legal?: string
  web?: string
  riot?: string
  email?: string
  twitter?: string
  additional?: Array<{ key: string; value: string }>
  judgements?: Array<{ index: number; judgement: string }>
  deposit?: bigint
}

export interface IdentityResult {
  identity: IdentityInfo | null
  isLoading: boolean
  error: string | null
  hasIdentity: boolean
}

/**
 * Hook para obtener información de identidad de una cuenta en People Chain
 */
export function usePeopleChainIdentity(
  address: string | null,
  network: 'polkadot' | 'kusama' | 'paseo' = 'polkadot'
): IdentityResult {
  const [identity, setIdentity] = useState<IdentityInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasIdentity, setHasIdentity] = useState(false)

  const fetchIdentity = useCallback(async () => {
    if (!address) {
      setIdentity(null)
      setHasIdentity(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const endpoint = PEOPLE_CHAIN_ENDPOINTS[network]
      const provider = new WsProvider(endpoint)
      await provider.connect()
      const client = await DedotClient.new(provider)

      try {
        // Verificar que el pallet identity esté disponible
        if (!client.query.identity) {
          console.warn(`[Identity] ⚠️ El pallet 'identity' no está disponible en ${network}`)
          console.log(`[Identity] Pallets disponibles:`, Object.keys(client.query))
          setError(`El pallet 'identity' no está disponible en ${network}`)
          setIdentity(null)
          setHasIdentity(false)
          await client.disconnect()
          return
        }

        // Query de identidad usando el pallet identity
        // Según la documentación de dedot: client.query.<pallet>.<storageEntry>
        // Cuando no hay identidad, dedot devuelve null directamente
        console.log(`[Identity] Consultando identidad para ${address} en ${network}...`)
        console.log(`[Identity] Storage entries disponibles en identity:`, Object.keys(client.query.identity))
        
        const identityData = await client.query.identity.identityOf(address)
        
        console.log(`[Identity] Resultado de query:`, identityData)

        // En dedot, cuando no hay datos, el storage query devuelve null
        // Si hay datos, puede venir como objeto con estructura específica
        if (identityData === null || identityData === undefined) {
          console.log(`[Identity] No se encontró identidad para ${address} en ${network}`)
          setIdentity(null)
          setHasIdentity(false)
        } else {
          // La estructura puede variar, intentar diferentes formatos
          let identityValue: any = null
          
          // Formato 1: identityData.value
          if (identityData && typeof identityData === 'object' && 'value' in identityData) {
            identityValue = identityData.value
          }
          // Formato 2: identityData directamente
          else if (identityData && typeof identityData === 'object') {
            identityValue = identityData
          }

          if (identityValue) {
            const info = identityValue.info || {}
            const judgements = identityValue.judgements || []
            const deposit = identityValue.deposit ? BigInt(identityValue.deposit.toString()) : undefined

            // En dedot, los campos opcionales pueden venir como Option<T>
            // Necesitamos extraer el valor si es un Option
            const extractValue = (field: any): string | undefined => {
              if (!field) return undefined
              // Si es un Option, extraer el value
              if (typeof field === 'object' && 'value' in field) {
                return field.value
              }
              // Si es un string directamente
              if (typeof field === 'string') {
                return field
              }
              return undefined
            }

            const identityInfo: IdentityInfo = {
              display: extractValue(info.display),
              legal: extractValue(info.legal),
              web: extractValue(info.web),
              riot: extractValue(info.riot),
              email: extractValue(info.email),
              twitter: extractValue(info.twitter),
              additional: info.additional?.map((item: any) => {
                // Los additional fields vienen como [key, value]
                const key = Array.isArray(item) ? (item[0]?.value || item[0]) : item?.key
                const value = Array.isArray(item) ? (item[1]?.value || item[1]) : item?.value
                return {
                  key: typeof key === 'string' ? key : '',
                  value: typeof value === 'string' ? value : '',
                }
              }),
              judgements: judgements.map((j: any, index: number) => {
                // Los judgements vienen como tuplas [registrarIndex, judgement]
                if (Array.isArray(j) && j.length >= 2) {
                  return {
                    index: typeof j[0] === 'number' ? j[0] : index,
                    judgement: j[1]?.toString() || 'Unknown',
                  }
                }
                return {
                  index,
                  judgement: j?.toString() || 'Unknown',
                }
              }),
              deposit,
            }

            console.log(`[Identity] ✅ Identidad encontrada:`, identityInfo)
            setIdentity(identityInfo)
            setHasIdentity(true)
          } else {
            console.log(`[Identity] No se encontró identidad (valor vacío) para ${address} en ${network}`)
            setIdentity(null)
            setHasIdentity(false)
          }
        }
      } catch (err: any) {
        // Si el pallet no existe o hay un error, asumimos que no hay identidad
        console.error(`[Identity] ❌ Error querying identity from People Chain (${network}):`, err)
        console.error(`[Identity] Detalles del error:`, {
          message: err.message,
          stack: err.stack,
          name: err.name,
        })
        setError(err.message || 'Error al consultar identidad')
        setIdentity(null)
        setHasIdentity(false)
      } finally {
        await client.disconnect()
      }
    } catch (err: any) {
      setError(err.message || 'Error al conectar con People Chain')
      console.error('Error fetching identity:', err)
      setIdentity(null)
      setHasIdentity(false)
    } finally {
      setIsLoading(false)
    }
  }, [address, network])

  useEffect(() => {
    fetchIdentity()
  }, [fetchIdentity])

  return {
    identity,
    isLoading,
    error,
    hasIdentity,
  }
}

/**
 * Hook para obtener identidad de múltiples redes de People Chain
 */
export function useMultiPeopleChainIdentity(address: string | null) {
  const [identities, setIdentities] = useState<Record<string, IdentityInfo | null>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) {
      setIdentities({})
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const fetchAll = async () => {
      const results: Record<string, IdentityInfo | null> = {}

      for (const [network, endpoint] of Object.entries(PEOPLE_CHAIN_ENDPOINTS)) {
        try {
          const provider = new WsProvider(endpoint)
          await provider.connect()
          const client = await DedotClient.new(provider)

          try {
            console.log(`[Identity] Consultando identidad para ${address} en ${network}...`)
            const identityData = await client.query.identity.identityOf(address)
            console.log(`[Identity] Resultado de query en ${network}:`, identityData)

            if (identityData === null || identityData === undefined) {
              results[network] = null
            } else {
              // La estructura puede variar, intentar diferentes formatos
              let identityValue: any = null
              
              if (identityData && typeof identityData === 'object' && 'value' in identityData) {
                identityValue = identityData.value
              } else if (identityData && typeof identityData === 'object') {
                identityValue = identityData
              }

              if (identityValue) {
                const info = identityValue.info || {}
                const judgements = identityValue.judgements || []
                
                const extractValue = (field: any): string | undefined => {
                  if (!field) return undefined
                  if (typeof field === 'object' && 'value' in field) {
                    return field.value
                  }
                  if (typeof field === 'string') {
                    return field
                  }
                  return undefined
                }

                results[network] = {
                  display: extractValue(info.display),
                  legal: extractValue(info.legal),
                  web: extractValue(info.web),
                  riot: extractValue(info.riot),
                  email: extractValue(info.email),
                  twitter: extractValue(info.twitter),
                  additional: info.additional?.map((item: any) => {
                    const key = Array.isArray(item) ? (item[0]?.value || item[0]) : item?.key
                    const value = Array.isArray(item) ? (item[1]?.value || item[1]) : item?.value
                    return {
                      key: typeof key === 'string' ? key : '',
                      value: typeof value === 'string' ? value : '',
                    }
                  }),
                  judgements: judgements.map((j: any, index: number) => {
                    if (Array.isArray(j) && j.length >= 2) {
                      return {
                        index: typeof j[0] === 'number' ? j[0] : index,
                        judgement: j[1]?.toString() || 'Unknown',
                      }
                    }
                    return {
                      index,
                      judgement: j?.toString() || 'Unknown',
                    }
                  }),
                  deposit: identityValue.deposit ? BigInt(identityValue.deposit.toString()) : undefined,
                }
              } else {
                results[network] = null
              }
            }
          } catch (err: any) {
            console.warn(`[Identity] No identity found on ${network} People Chain:`, err.message)
            results[network] = null
          } finally {
            await client.disconnect()
          }
        } catch (err: any) {
          console.error(`Error fetching identity from ${network}:`, err)
          results[network] = null
        }
      }

      setIdentities(results)
      setIsLoading(false)
    }

    fetchAll()
  }, [address])

  return { identities, isLoading, error }
}

