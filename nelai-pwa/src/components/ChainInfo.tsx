import { useEffect, useState } from 'react'
import { DedotClient } from 'dedot'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ChainInfoProps {
  client: DedotClient | null
}

export function ChainInfo({ client }: ChainInfoProps) {
  const [chainInfo, setChainInfo] = useState<{
    name?: string
    version?: string
    properties?: Record<string, any>
    genesisHash?: string
    runtimeVersion?: any
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!client) {
      setChainInfo(null)
      return
    }

    setLoading(true)
    setError(null)

    // Usar client.query para storage queries y provider.send para RPC calls
    // https://docs.dedot.dev/client-api/storage-queries
    const provider = (client as any).provider
    
    Promise.all([
      // RPC calls que no son storage queries
      provider?.send('system_chain', []).catch(() => null),
      provider?.send('system_version', []).catch(() => null),
      provider?.send('system_properties', []).catch(() => null),
      provider?.send('chain_getBlockHash', [0]).catch(() => null),
      provider?.send('state_getRuntimeVersion', []).catch(() => null),
      // Intentar usar query para obtener el número de bloque actual
      (client as any).query?.system?.number?.().catch(() => null),
    ])
      .then(([chain, version, properties, genesisHash, runtimeVersion, blockNumber]) => {
        setChainInfo({
          name: chain,
          version,
          properties,
          genesisHash: genesisHash?.toString(),
          runtimeVersion,
        })
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Error al obtener información')
        setLoading(false)
      })
  }, [client])

  if (!client) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Información de la Red</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Información de la Red</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de la Red</CardTitle>
        <CardDescription>Datos de la cadena conectada</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {chainInfo?.name && (
          <div>
            <p className="text-sm font-medium mb-1">Nombre</p>
            <Badge variant="outline">{chainInfo.name}</Badge>
          </div>
        )}
        {chainInfo?.version && (
          <div>
            <p className="text-sm font-medium mb-1">Versión</p>
            <p className="text-sm text-muted-foreground">{chainInfo.version}</p>
          </div>
        )}
        {chainInfo?.genesisHash && (
          <div>
            <p className="text-sm font-medium mb-1">Genesis Hash</p>
            <p className="text-sm text-muted-foreground font-mono break-all">
              {chainInfo.genesisHash}
            </p>
          </div>
        )}
        {chainInfo?.properties && Object.keys(chainInfo.properties).length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Propiedades</p>
            <div className="space-y-2">
              {Object.entries(chainInfo.properties).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm font-medium">{key}:</span>
                  <span className="text-sm text-muted-foreground">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {chainInfo?.runtimeVersion && (
          <div>
            <p className="text-sm font-medium mb-2">Runtime Version</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Spec: {chainInfo.runtimeVersion.specName}</p>
              <p>Spec Version: {chainInfo.runtimeVersion.specVersion}</p>
              <p>Impl Version: {chainInfo.runtimeVersion.implVersion}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

