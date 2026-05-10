import { useState, useEffect } from 'react'
import { DedotClient } from 'dedot'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Code, ChevronRight, ChevronDown, Search, Play } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Componente para explorar y ejecutar Runtime APIs disponibles
 * Basado en: https://docs.dedot.dev/client-api/runtime-apis
 */
interface RuntimeApisExplorerProps {
  client: DedotClient | null
}

interface RuntimeApiInfo {
  name: string
  methods: string[]
}

export function RuntimeApisExplorer({ client }: RuntimeApisExplorerProps) {
  const [open, setOpen] = useState(false)
  const [runtimeApis, setRuntimeApis] = useState<RuntimeApiInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedApis, setExpandedApis] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedApi, setSelectedApi] = useState<string>('')
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [methodParams, setMethodParams] = useState<string>('')
  const [executing, setExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<any>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !client) {
      return
    }

    const fetchRuntimeApis = async () => {
      setLoading(true)
      setError(null)

      try {
        // Verificar que el cliente esté conectado
        const provider = (client as any).provider
        if (!provider) {
          throw new Error('Provider no disponible')
        }

        // Verificar conexión
        if (provider.isConnected && typeof provider.isConnected === 'function') {
          if (!provider.isConnected()) {
            throw new Error('Cliente no conectado. Espera un momento e intenta de nuevo.')
          }
        }

        // Esperar un momento adicional para asegurar que el cliente esté completamente inicializado
        await new Promise(resolve => setTimeout(resolve, 500))

        const apisList: RuntimeApiInfo[] = []

        // Función helper para obtener propiedades de manera segura sin activar getters
        const getSafeProperties = (obj: any, filterFn?: (key: string) => boolean): string[] => {
          if (!obj || typeof obj !== 'object') return []
          
          try {
            // Usar Object.getOwnPropertyNames para evitar activar getters
            return Object.getOwnPropertyNames(obj)
              .filter(key => {
                if (key.startsWith('_') || key === 'constructor') return false
                if (filterFn && !filterFn(key)) return false
                return true
              })
          } catch {
            return []
          }
        }

        // Lista conocida de Runtime APIs con sus métodos según las especificaciones de Dedot
        // Basado en: https://github.com/dedotdev/dedot/blob/fefe71cf4a04d1433841f5cfc8400a1e2a8db112/packages/runtime-specs/src/all.ts
        const knownRuntimeApis: Record<string, string[]> = {
          core: ['version', 'executeBlock', 'initializeBlock'],
          metadata: ['metadata', 'metadataAtVersion', 'metadataVersions'],
          blockBuilder: ['applyExtrinsic', 'finalizeBlock', 'inherentExtrinsics', 'checkInherents'],
          taggedTransactionQueue: ['validateTransaction'],
          offchainWorkerApi: ['offchainWorker'],
          parachainHost: [
            'validators', 'validatorGroups', 'availabilityCores', 'persistedValidationData',
            'assumedValidationData', 'checkValidationOutputs', 'sessionIndexForChild',
            'validationCode', 'candidatePendingAvailability', 'candidateEvents',
            'dmqContents', 'inboundHrmpChannelsContents', 'validationCodeByHash',
            'onChainVotes', 'sessionInfo', 'submitPvfCheckStatement', 'pvfsRequirePrecheck',
            'validationCodeHash', 'disputes', 'sessionExecutorParams', 'unappliedSlashes',
            'keyOwnershipProof', 'submitReportDisputeLost', 'minimumBackingVotes',
            'paraBackingState', 'asyncBackingParams', 'disabledValidators', 'nodeFeatures',
            'approvalVotingParams', 'claimQueue', 'candidatesPendingAvailability',
            'validationCodeBombLimit', 'backingConstraints', 'schedulingLookahead'
          ],
          beefyApi: [
            'beefyGenesis', 'validatorSet', 'submitReportDoubleVotingUnsignedExtrinsic',
            'submitReportForkVotingUnsignedExtrinsic', 'submitReportFutureBlockVotingUnsignedExtrinsic',
            'generateKeyOwnershipProof', 'generateAncestryProof'
          ],
          mmrApi: ['mmrRoot', 'mmrLeafCount', 'generateProof', 'verifyProof', 'verifyProofStateless'],
          beefyMmrApi: ['authoritySetProof', 'nextAuthoritySetProof'],
          grandpaApi: [
            'grandpaAuthorities', 'submitReportEquivocationUnsignedExtrinsic',
            'generateKeyOwnershipProof', 'currentSetId'
          ],
          babeApi: [
            'configuration', 'currentEpochStart', 'currentEpoch', 'nextEpoch',
            'generateKeyOwnershipProof', 'submitReportEquivocationUnsignedExtrinsic'
          ],
          authorityDiscoveryApi: ['authorities'],
          sessionKeys: ['generateSessionKeys', 'decodeSessionKeys'],
          runtimeViewFunction: ['executeViewFunction'],
          accountNonceApi: ['accountNonce'],
          transactionPaymentApi: ['queryInfo', 'queryFeeDetails', 'queryWeightToFee', 'queryLengthToFee'],
          transactionPaymentCallApi: [
            'queryCallInfo', 'queryCallFeeDetails', 'queryWeightToFee', 'queryLengthToFee'
          ],
          xcmPaymentApi: [
            'queryAcceptablePaymentAssets', 'queryXcmWeight', 'queryWeightToAssetFee', 'queryDeliveryFees'
          ],
          dryRunApi: ['dryRunCall', 'dryRunXcm'],
          locationToAccountApi: ['convertLocation'],
          genesisBuilder: ['buildState', 'getPreset', 'presetNames'],
          inflation: ['experimentalInflationPredictionInfo'],
          nominationPoolsApi: [
            'pendingRewards', 'pointsToBalance', 'balanceToPoints', 'poolPendingSlash',
            'memberPendingSlash', 'poolNeedsDelegateMigration', 'memberNeedsDelegateMigration',
            'memberTotalBalance', 'poolBalance', 'poolAccounts'
          ],
          stakingApi: ['nominationsQuota', 'erasStakersPageCount', 'pendingRewards'],
        }

        // Intentar acceder a cada API conocida de manera segura
        if ((client as any).call) {
          for (const [apiName, methods] of Object.entries(knownRuntimeApis)) {
            try {
              // Verificar que la propiedad existe sin acceder a ella
              if (!(apiName in (client as any).call)) continue
              
              // Agregar la API con sus métodos conocidos
              apisList.push({
                name: apiName,
                methods: methods,
              })
            } catch (err) {
              // Ignorar APIs que no existen
              console.debug(`Runtime API ${apiName} no disponible:`, err)
            }
          }
        } else {
          throw new Error('Runtime APIs no disponibles (client.call no existe)')
        }

        // Ordenar alfabéticamente
        apisList.sort((a, b) => a.name.localeCompare(b.name))

        setRuntimeApis(apisList)
      } catch (err: any) {
        setError(err.message || 'Error al obtener Runtime APIs')
        console.error('Error al obtener Runtime APIs:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRuntimeApis()
  }, [open, client])

  const toggleApi = (apiName: string) => {
    const newExpanded = new Set(expandedApis)
    if (newExpanded.has(apiName)) {
      newExpanded.delete(apiName)
    } else {
      newExpanded.add(apiName)
    }
    setExpandedApis(newExpanded)
  }

  const handleExecuteMethod = async () => {
    if (!client || !selectedApi || !selectedMethod) {
      alert('Por favor selecciona una API e ingresa un método')
      return
    }

    setExecuting(true)
    setExecutionError(null)
    setExecutionResult(null)

    try {
      // Verificar conexión antes de ejecutar
      const provider = (client as any).provider
      if (!provider || (provider.isConnected && !provider.isConnected())) {
        throw new Error('Cliente no conectado')
      }

      const callApi = (client as any).call
      if (!callApi || !callApi[selectedApi]) {
        throw new Error(`Runtime API ${selectedApi} no encontrada`)
      }

      const runtimeApi = callApi[selectedApi]
      if (!runtimeApi || !runtimeApi[selectedMethod]) {
        throw new Error(`Método ${selectedMethod} no encontrado en ${selectedApi}`)
      }

      const method = runtimeApi[selectedMethod]
      
      // Parsear parámetros si se proporcionaron
      let params: any[] = []
      if (methodParams.trim()) {
        try {
          params = JSON.parse(methodParams)
          if (!Array.isArray(params)) {
            params = [params]
          }
        } catch {
          // Si no es JSON válido, tratar como un solo parámetro string
          params = [methodParams]
        }
      }

      // Ejecutar el método
      const result = await method(...params)
      setExecutionResult(result)
    } catch (err: any) {
      setExecutionError(err.message || 'Error al ejecutar el método')
      console.error('Error al ejecutar Runtime API:', err)
    } finally {
      setExecuting(false)
    }
  }

  const filteredApis = runtimeApis.filter((api) =>
    api.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!client) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Code className="h-4 w-4 mr-2" />
          Runtime APIs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95vh] sm:max-h-[80vh] overflow-hidden flex flex-col mx-4 sm:mx-0">
        <DialogHeader>
          <DialogTitle>Explorador de Runtime APIs</DialogTitle>
          <DialogDescription>
            Explora y ejecuta Runtime APIs disponibles según{' '}
            <a
              href="https://docs.dedot.dev/client-api/runtime-apis"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              documentación de Dedot
            </a>
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar Runtime API o método..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
            {/* Lista de APIs */}
            <div className="overflow-y-auto space-y-2">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Cargando Runtime APIs...
                  </span>
                </div>
              )}

              {error && (
                <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {!loading && !error && filteredApis.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No se encontraron Runtime APIs</p>
                </div>
              )}

              {!loading && !error && filteredApis.map((api) => {
                const isExpanded = expandedApis.has(api.name)

                return (
                  <Card key={api.name} className="overflow-hidden">
                    <CardHeader
                      className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
                      onClick={() => toggleApi(api.name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-base">{api.name}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          {api.methods.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {api.methods.length} método{api.methods.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    {isExpanded && (
                      <CardContent className="pt-0">
                        {api.methods.length > 0 ? (
                          <div className="space-y-1">
                            {api.methods.map((method) => (
                              <Button
                                key={method}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-xs font-mono"
                                onClick={() => {
                                  setSelectedApi(api.name)
                                  setSelectedMethod(method)
                                  setMethodParams('')
                                  setExecutionResult(null)
                                  setExecutionError(null)
                                }}
                              >
                                {method}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground p-2">
                            No hay métodos conocidos para esta API. Ingresa el nombre del método manualmente.
                          </p>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>

            {/* Panel de ejecución */}
            <div className="border rounded-lg p-4 space-y-4 overflow-y-auto">
              <div>
                <h3 className="font-semibold mb-2">Ejecutar Runtime API</h3>
                    {selectedApi ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">API:</p>
                      <Badge variant="outline" className="font-mono">
                        {selectedApi}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Seleccionar Método:</p>
                      {(() => {
                        const api = runtimeApis.find(a => a.name === selectedApi)
                        const availableMethods = api?.methods || []
                        
                        if (availableMethods.length > 0) {
                          return (
                            <select
                              value={selectedMethod}
                              onChange={(e) => {
                                setSelectedMethod(e.target.value)
                                setMethodParams('')
                                setExecutionResult(null)
                                setExecutionError(null)
                              }}
                              className="w-full p-2 border rounded-md bg-background font-mono text-xs"
                              disabled={executing}
                            >
                              <option value="">Selecciona un método</option>
                              {availableMethods.map((method) => (
                                <option key={method} value={method}>
                                  {method}
                                </option>
                              ))}
                            </select>
                          )
                        } else {
                          return (
                            <Input
                              placeholder="Nombre del método (ej: version, accountNonce)"
                              value={selectedMethod}
                              onChange={(e) => setSelectedMethod(e.target.value)}
                              className="font-mono text-xs"
                              disabled={executing}
                            />
                          )
                        }
                      })()}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Parámetros (JSON opcional):</p>
                      <Input
                        placeholder='Ej: ["param1", 123] o "singleParam"'
                        value={methodParams}
                        onChange={(e) => setMethodParams(e.target.value)}
                        className="font-mono text-xs"
                        disabled={executing}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Deja vacío si el método no requiere parámetros
                      </p>
                    </div>
                    <Button
                      onClick={handleExecuteMethod}
                      disabled={executing}
                      className="w-full"
                    >
                      {executing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Ejecutando...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Ejecutar
                        </>
                      )}
                    </Button>

                    {executionError && (
                      <div className="p-3 border border-destructive rounded-lg bg-destructive/10">
                        <p className="text-sm text-destructive">{executionError}</p>
                      </div>
                    )}

                    {executionResult !== null && (
                      <div className="p-3 border rounded-lg bg-muted/50">
                        <p className="text-sm font-medium mb-2">Resultado:</p>
                        <pre className="text-xs font-mono overflow-auto max-h-60 bg-background p-2 rounded">
                          {JSON.stringify(executionResult, (key, value) => {
                            // Convertir BigInt a string para JSON
                            if (typeof value === 'bigint') {
                              return value.toString()
                            }
                            return value
                          }, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Selecciona un método de la lista para ejecutarlo</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer con estadísticas */}
          {!loading && !error && (
            <div className="border-t pt-2 text-xs text-muted-foreground">
              <p>
                {filteredApis.length} Runtime API{filteredApis.length !== 1 ? 's' : ''} encontrada{filteredApis.length !== 1 ? 's' : ''}
                {searchQuery && ` (filtrado de ${runtimeApis.length} total)`}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

