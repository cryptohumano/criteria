import { useEffect, useState } from 'react'
import { DedotClient } from 'dedot'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface BlockExplorerProps {
  client: DedotClient | null
}

export function BlockExplorer({ client }: BlockExplorerProps) {
  const [blockNumber, setBlockNumber] = useState<string>('')
  const [blockData, setBlockData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latestBlock, setLatestBlock] = useState<number | null>(null)

  useEffect(() => {
    if (!client) {
      setLatestBlock(null)
      return
    }

    const fetchLatestBlockNumber = async () => {
      try {
        // Verificar que el cliente esté conectado antes de usar query
        const provider = (client as any).provider
        if (!provider) return
        
        // Verificar que el provider esté conectado
        if (provider.isConnected && !provider.isConnected()) {
          return
        }
        
        // Intentar usar client.query.system.number primero (método recomendado de Dedot)
        // https://docs.dedot.dev/client-api/storage-queries
        // Pero solo si el cliente está completamente inicializado
        try {
          if ((client as any).query?.system?.number) {
            const blockNumber = await (client as any).query.system.number()
            if (blockNumber !== null && blockNumber !== undefined) {
              setLatestBlock(Number(blockNumber))
              return
            }
          }
        } catch (queryError) {
          // Si query falla, usar RPC calls como fallback
          console.log('Query no disponible, usando RPC calls:', queryError)
        }
        
        // Fallback: usar RPC calls si query no está disponible
        if (!provider || typeof provider.send !== 'function') return
        
        // Verificar que el provider esté conectado
        if (provider.isConnected && typeof provider.isConnected === 'function') {
          if (!provider.isConnected()) {
            console.warn('Provider no conectado, esperando...')
            return
          }
        }
        
        // Obtener el hash del último bloque
        const latestHash = await provider.send('chain_getBlockHash', [])
        if (!latestHash) return
        
        // Obtener el bloque completo
        const block = await provider.send('chain_getBlock', [latestHash])
        if (block && block.block && block.block.header && block.block.header.number) {
          // El número puede venir como string o número
          const blockNum = block.block.header.number
          setLatestBlock(typeof blockNum === 'string' ? parseInt(blockNum, 10) : Number(blockNum))
        }
      } catch (error) {
        console.error('Error al obtener último bloque:', error)
        // Intentar método alternativo
        try {
          const provider = (client as any).provider
          if (provider && typeof provider.send === 'function') {
            // Algunas cadenas soportan chain_getBlockNumber directamente
            const num = await provider.send('chain_getBlockNumber', [])
            if (num) {
              setLatestBlock(Number(num))
            }
          }
        } catch (e) {
          // Ignorar si tampoco funciona
        }
      }
    }

    // Esperar un poco para asegurar que el cliente esté completamente conectado
    const timeoutId = setTimeout(() => {
      fetchLatestBlockNumber()
    }, 500)
    
    // Actualizar periódicamente
    const interval = setInterval(fetchLatestBlockNumber, 10000) // Cada 10 segundos
    
    return () => {
      clearTimeout(timeoutId)
      clearInterval(interval)
    }
  }, [client])

  const fetchBlock = async () => {
    if (!client || !blockNumber) return

    setLoading(true)
    setError(null)

    try {
      const provider = (client as any).provider
      if (!provider || typeof provider.send !== 'function') {
        throw new Error('Provider no disponible')
      }
      
      const blockHash = await provider.send('chain_getBlockHash', [Number(blockNumber)])
      if (!blockHash) {
        throw new Error('No se pudo obtener el hash del bloque')
      }
      const block = await provider.send('chain_getBlock', [blockHash])
      if (!block || !block.block) {
        throw new Error('No se pudo obtener el bloque')
      }
      setBlockData(block)
    } catch (err: any) {
      setError(err.message || 'Error al obtener el bloque')
    } finally {
      setLoading(false)
    }
  }

  const fetchLatestBlock = async () => {
    if (!client) return

    setLoading(true)
    setError(null)

    try {
      const provider = (client as any).provider
      if (!provider || typeof provider.send !== 'function') {
        throw new Error('Provider no disponible')
      }
      
      const latestHash = await provider.send('chain_getBlockHash', [])
      if (!latestHash) {
        throw new Error('No se pudo obtener el hash del último bloque')
      }
      const block = await provider.send('chain_getBlock', [latestHash])
      if (!block || !block.block) {
        throw new Error('No se pudo obtener el bloque')
      }
      setBlockData(block)
      // Actualizar el número de bloque si está disponible
      if (block && block.block && block.block.header && block.block.header.number) {
        const blockNum = block.block.header.number
        const num = typeof blockNum === 'string' ? parseInt(blockNum, 10) : Number(blockNum)
        setBlockNumber(num.toString())
        setLatestBlock(num)
      } else if (latestBlock) {
        setBlockNumber(latestBlock.toString())
      }
    } catch (err: any) {
      setError(err.message || 'Error al obtener el bloque')
    } finally {
      setLoading(false)
    }
  }

  if (!client) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Explorador de Bloques</CardTitle>
        <CardDescription>
          Explora bloques de la cadena
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder={latestBlock ? `Último bloque: ${latestBlock}` : "Número de bloque"}
            value={blockNumber}
            onChange={(e) => setBlockNumber(e.target.value)}
            min="0"
          />
          <Button onClick={fetchBlock} disabled={loading || !blockNumber}>
            Buscar
          </Button>
          <Button onClick={fetchLatestBlock} disabled={loading} variant="outline">
            Último
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}

        {blockData && !loading && blockData.block && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium mb-1">Hash del Bloque</p>
              <p className="text-xs font-mono break-all text-muted-foreground">
                {blockData.block?.header?.hash?.toString() || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Número de Bloque</p>
              <Badge variant="outline">
                {blockData.block?.header?.number?.toString() || 'N/A'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Parent Hash</p>
              <p className="text-xs font-mono break-all text-muted-foreground">
                {blockData.block?.header?.parentHash?.toString() || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Extrinsics</p>
              <Badge variant="secondary">
                {blockData.block?.extrinsics?.length || 0} extrinsics
              </Badge>
            </div>
            {blockData.block?.extrinsics && blockData.block.extrinsics.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Extrinsics (primeros 3)</p>
                <div className="space-y-2">
                  {blockData.block.extrinsics.slice(0, 3).map((ext: any, idx: number) => (
                    <div key={idx} className="p-2 bg-background rounded text-xs font-mono break-all">
                      {ext?.toString()?.substring(0, 100) || 'N/A'}...
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

