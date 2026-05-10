import { useEffect, useState } from 'react'
import { DedotClient } from 'dedot'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Play, Square } from 'lucide-react'

/**
 * Componente para demostrar el uso de Storage Queries de Dedot
 * https://docs.dedot.dev/client-api/storage-queries
 */
interface StorageQueriesProps {
  client: DedotClient | null
}

export function StorageQueries({ client }: StorageQueriesProps) {
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')
  const [balances, setBalances] = useState<{ address: string; balance: any }[]>([])
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [unsubscribeFunctions, setUnsubscribeFunctions] = useState<Array<() => void>>([])
  const [queryMultiResult, setQueryMultiResult] = useState<{
    accountBalance?: any
    blockNumber?: number
  } | null>(null)

  // Suscripción al número de bloque actual
  useEffect(() => {
    if (!client || !isSubscribed) {
      setBlockNumber(null)
      return
    }

    let unsub: (() => void) | null = null

    const subscribeToBlockNumber = async () => {
      try {
        // Esperar un momento para asegurar que el cliente esté completamente conectado
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Verificar que el cliente esté conectado
        const provider = (client as any).provider
        if (!provider) {
          console.warn('Provider no disponible')
          return
        }
        
        // Suscribirse a cambios en el número de bloque
        // https://docs.dedot.dev/client-api/storage-queries#subscribe-to-on-chain-storage
        if ((client as any).query?.system?.number) {
          unsub = await (client as any).query.system.number((blockNum: any) => {
            setBlockNumber(Number(blockNum))
          })
          
          if (unsub) {
            setUnsubscribeFunctions((prev) => [...prev, unsub!])
          }
        }
      } catch (error) {
        console.error('Error al suscribirse al número de bloque:', error)
      }
    }

    subscribeToBlockNumber()

    return () => {
      if (unsub) {
        unsub()
      }
    }
  }, [client, isSubscribed])

  // Suscripción a eventos
  useEffect(() => {
    if (!client || !isSubscribed) {
      setEvents([])
      return
    }

    let unsub: (() => void) | null = null

    const subscribeToEvents = async () => {
      try {
        // Esperar un momento para asegurar que el cliente esté completamente conectado
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Verificar que el cliente esté conectado
        const provider = (client as any).provider
        if (!provider) {
          console.warn('Provider no disponible')
          return
        }
        
        // Suscribirse a eventos del bloque actual
        // https://docs.dedot.dev/client-api/storage-queries#subscribe-to-on-chain-storage
        if ((client as any).query?.system?.events) {
          unsub = await (client as any).query.system.events((eventRecords: any[]) => {
            // Filtrar eventos de transferencia
            const transferEvents = eventRecords.filter((record: any) => {
              const event = record?.event
              return event?.pallet === 'Balances' && event?.name === 'Transfer'
            })
            
            if (transferEvents.length > 0) {
              setEvents((prev) => [...prev, ...transferEvents].slice(-10)) // Mantener solo los últimos 10
            }
          })
          
          if (unsub) {
            setUnsubscribeFunctions((prev) => [...prev, unsub!])
          }
        }
      } catch (error) {
        console.error('Error al suscribirse a eventos:', error)
      }
    }

    subscribeToEvents()

    return () => {
      if (unsub) {
        unsub()
      }
    }
  }, [client, isSubscribed])

  // Suscripción a balances múltiples
  useEffect(() => {
    if (!client || !isSubscribed || (!address1 && !address2)) {
      setBalances([])
      return
    }

    let unsub: (() => void) | null = null

    const subscribeToBalances = async () => {
      try {
        // Esperar un momento para asegurar que el cliente esté completamente conectado
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Verificar que el cliente esté conectado
        const provider = (client as any).provider
        if (!provider) {
          console.warn('Provider no disponible')
          return
        }
        
        const addresses = [address1, address2].filter(Boolean)
        if (addresses.length === 0) return

        // Multi-query: consultar múltiples balances en una sola llamada
        // https://docs.dedot.dev/client-api/storage-queries#multi-queries
        if ((client as any).query?.system?.account?.multi) {
          unsub = await (client as any).query.system.account.multi(
            addresses,
            (accountInfos: any[]) => {
              const newBalances = accountInfos.map((info, idx) => ({
                address: addresses[idx],
                balance: info?.data?.free || '0',
              }))
              setBalances(newBalances)
            }
          )
          
          if (unsub) {
            setUnsubscribeFunctions((prev) => [...prev, unsub!])
          }
        }
      } catch (error) {
        console.error('Error al suscribirse a balances:', error)
      }
    }

    subscribeToBalances()

    return () => {
      if (unsub) {
        unsub()
      }
    }
  }, [client, isSubscribed, address1, address2])

  const handleStartSubscription = () => {
    setIsSubscribed(true)
  }

  const handleStopSubscription = () => {
    // Desuscribirse de todas las suscripciones
    unsubscribeFunctions.forEach((unsub) => {
      try {
        unsub()
      } catch (error) {
        console.error('Error al desuscribirse:', error)
      }
    })
    setUnsubscribeFunctions([])
    setIsSubscribed(false)
    setBalances([])
    setBlockNumber(null)
    setEvents([])
    setQueryMultiResult(null)
  }

  const fetchBalancesOnce = async () => {
    if (!client) return

    try {
      // Verificar que el cliente esté conectado
      const provider = (client as any).provider
      if (!provider) {
        console.error('Provider no disponible')
        return
      }
      
      const addresses = [address1, address2].filter(Boolean)
      if (addresses.length === 0) return

      // Multi-query directa (sin suscripción)
      // https://docs.dedot.dev/client-api/storage-queries#same-storage-types
      if ((client as any).query?.system?.account?.multi) {
        const accountInfos = await (client as any).query.system.account.multi(addresses)
        const newBalances = accountInfos.map((info: any, idx: number) => ({
          address: addresses[idx],
          balance: info?.data?.free || '0',
        }))
        setBalances(newBalances)
      }
    } catch (error: any) {
      console.error('Error al obtener balances:', error)
    }
  }

  const fetchQueryMulti = async () => {
    if (!client || !address1) return

    try {
      // Verificar que el cliente esté conectado
      const provider = (client as any).provider
      if (!provider) {
        console.error('Provider no disponible')
        return
      }

      // QueryMulti: consultar múltiples tipos de storage en una sola llamada RPC
      // https://docs.dedot.dev/client-api/storage-queries#different-storage-types
      if ((client as any).queryMulti) {
        const [accountBalance, blockNumber] = await (client as any).queryMulti([
          { fn: (client as any).query.system.account, args: [address1] },
          { fn: (client as any).query.system.number }
        ])

        setQueryMultiResult({
          accountBalance,
          blockNumber: Number(blockNumber)
        })
      }
    } catch (error: any) {
      console.error('Error al ejecutar queryMulti:', error)
    }
  }

  const subscribeQueryMulti = async () => {
    if (!client || !address1) return

    try {
      // Esperar un momento para asegurar que el cliente esté completamente conectado
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Verificar que el cliente esté conectado
      const provider = (client as any).provider
      if (!provider) {
        console.warn('Provider no disponible')
        return
      }

      // Suscripción a queryMulti
      // https://docs.dedot.dev/client-api/storage-queries#different-storage-types
      if ((client as any).queryMulti) {
        const unsub = await (client as any).queryMulti(
          [
            { fn: (client as any).query.system.account, args: [address1] },
            { fn: (client as any).query.system.number }
          ],
          ([accountBalance, blockNumber]: [any, number]) => {
            setQueryMultiResult({
              accountBalance,
              blockNumber: Number(blockNumber)
            })
          }
        )

        if (unsub) {
          setUnsubscribeFunctions((prev) => [...prev, unsub])
        }
      }
    } catch (error) {
      console.error('Error al suscribirse a queryMulti:', error)
    }
  }

  if (!client) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Queries (Dedot)</CardTitle>
        <CardDescription>
          Demostración de consultas y suscripciones según{' '}
          <a
            href="https://docs.dedot.dev/client-api/storage-queries"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            documentación de Dedot
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Control de suscripciones */}
        <div className="flex gap-2">
          {!isSubscribed ? (
            <Button onClick={handleStartSubscription} variant="default">
              <Play className="h-4 w-4 mr-2" />
              Iniciar Suscripciones
            </Button>
          ) : (
            <Button onClick={handleStopSubscription} variant="destructive">
              <Square className="h-4 w-4 mr-2" />
              Detener Suscripciones
            </Button>
          )}
        </div>

        {/* Número de bloque actual (suscripción) */}
        {isSubscribed && (
          <div className="p-3 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-1">Número de Bloque Actual (Suscripción)</p>
            <Badge variant="outline" className="text-lg">
              {blockNumber !== null ? blockNumber : 'Esperando...'}
            </Badge>
          </div>
        )}

        {/* Multi-query de balances */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Multi-Query: Balances de Múltiples Cuentas</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Dirección 1 (SS58)"
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
            />
            <Input
              placeholder="Dirección 2 (SS58)"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
            />
          </div>
          <Button onClick={fetchBalancesOnce} variant="outline" size="sm">
            Consultar Balances (Una vez)
          </Button>
        </div>

        {/* Resultados de balances */}
        {balances.length > 0 && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium">Balances:</p>
            {balances.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs font-mono truncate flex-1">{item.address}</span>
                <Badge variant="secondary" className="ml-2">
                  {item.balance.toString()}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Eventos (suscripción) */}
        {isSubscribed && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Eventos de Transferencia (Suscripción)</p>
            <div className="p-3 border rounded-lg bg-muted/50 max-h-40 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">Esperando eventos...</p>
              ) : (
                <div className="space-y-1">
                  {events.map((event, idx) => (
                    <div key={idx} className="text-xs font-mono break-all">
                      {JSON.stringify(event, null, 2).substring(0, 200)}...
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* QueryMulti: Diferentes tipos de storage */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">QueryMulti: Diferentes Tipos de Storage</p>
          <p className="text-xs text-muted-foreground">
            Consulta múltiples tipos de storage en una sola llamada RPC
          </p>
          <Input
            placeholder="Dirección para consultar (usado en QueryMulti)"
            value={address1}
            onChange={(e) => setAddress1(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={fetchQueryMulti} variant="outline" size="sm" disabled={!address1}>
              Consultar (Una vez)
            </Button>
            {isSubscribed && (
              <Button onClick={subscribeQueryMulti} variant="outline" size="sm" disabled={!address1}>
                Suscribirse
              </Button>
            )}
          </div>
          
          {queryMultiResult && (
            <div className="p-3 border rounded-lg bg-muted/50 space-y-2">
              <div>
                <p className="text-xs font-medium mb-1">Número de Bloque:</p>
                <Badge variant="outline">
                  {queryMultiResult.blockNumber ?? 'N/A'}
                </Badge>
              </div>
              {queryMultiResult.accountBalance && (
                <div>
                  <p className="text-xs font-medium mb-1">Balance de la Cuenta:</p>
                  <div className="space-y-1 text-xs">
                    <p>Free: {queryMultiResult.accountBalance.data?.free?.toString() || 'N/A'}</p>
                    <p>Reserved: {queryMultiResult.accountBalance.data?.reserved?.toString() || 'N/A'}</p>
                    <p>Nonce: {queryMultiResult.accountBalance.nonce?.toString() || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

