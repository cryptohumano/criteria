import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  ExternalLink, 
  Loader2,
  AlertTriangle,
  MapPin,
  Calendar,
  User,
  FileText,
  Mountain,
  Route,
  Activity
} from 'lucide-react'
import { getTransaction, type StoredTransaction } from '@/utils/transactionStorage'
import { useNetwork } from '@/contexts/NetworkContext'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { parseEmergencyFromRemark } from '@/types/emergencies'
import type { EmergencyRemarkData } from '@/types/emergencies'
import Identicon from '@polkadot/react-identicon'
import { Avatar } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { formatBalanceForDisplay } from '@/utils/balance'

export default function TransactionDetail() {
  const { hash } = useParams<{ hash: string }>()
  const navigate = useNavigate()
  const { client } = useNetwork()
  const { accounts } = useKeyringContext()
  
  const [transaction, setTransaction] = useState<StoredTransaction | null>(null)
  const [remarkContent, setRemarkContent] = useState<string | null>(null)
  const [parsedEmergency, setParsedEmergency] = useState<EmergencyRemarkData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingRemark, setIsLoadingRemark] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)

  // Cargar transacción desde IndexedDB
  useEffect(() => {
    const loadTransaction = async () => {
      if (!hash) {
        setError('Hash de transacción no proporcionado')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const tx = await getTransaction(hash)
        
        if (!tx) {
          setError('Transacción no encontrada')
          setIsLoading(false)
          return
        }

        setTransaction(tx)
        console.log('[TransactionDetail] Transacción cargada:', {
          id: tx.id,
          txHash: tx.txHash,
          type: tx.type,
          metadata: tx.metadata,
          isEmergency: !!(tx.metadata && tx.metadata.emergencyId),
        })

        // Si es una emergencia y tenemos blockNumber y extrinsicIndex, obtener el remark
        if (tx.metadata && tx.metadata.emergencyId && tx.blockNumber && tx.extrinsicIndex !== undefined) {
          await loadRemarkFromBlockchain(tx)
        }
      } catch (err) {
        console.error('[TransactionDetail] Error al cargar transacción:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
      }
    }

    loadTransaction()
  }, [hash])

  // Obtener el remark desde la blockchain
  const loadRemarkFromBlockchain = async (tx: StoredTransaction) => {
    if (!client || tx.blockNumber === undefined || tx.extrinsicIndex === undefined) {
      console.warn('[TransactionDetail] No se puede obtener remark: falta cliente, blockNumber o extrinsicIndex')
      return
    }

    try {
      setIsLoadingRemark(true)
      console.log('[TransactionDetail] Obteniendo remark desde blockchain:', {
        blockNumber: tx.blockNumber,
        extrinsicIndex: tx.extrinsicIndex,
      })

      // Obtener el bloque
      // Usar provider.send como en BlockExplorer.tsx
      const provider = (client as any).provider
      if (!provider || typeof provider.send !== 'function') {
        throw new Error('Provider no disponible')
      }
      
      const blockHash = await provider.send('chain_getBlockHash', [tx.blockNumber])
      if (!blockHash) {
        throw new Error('No se pudo obtener el hash del bloque')
      }
      
      const blockData = await provider.send('chain_getBlock', [blockHash])
      if (!blockData || !blockData.block) {
        throw new Error('No se pudo obtener el bloque')
      }
      
      const block = blockData
      
      // Obtener la extrinsic
      const extrinsic = block.block.extrinsics[tx.extrinsicIndex]
      
      if (!extrinsic) {
        console.warn('[TransactionDetail] Extrinsic no encontrada en índice:', tx.extrinsicIndex)
        return
      }

      console.log('[TransactionDetail] Extrinsic encontrada:', {
        index: tx.extrinsicIndex,
        extrinsic: JSON.stringify(extrinsic, null, 2).substring(0, 500),
        hasMethod: !!extrinsic.method,
        methodType: typeof extrinsic.method,
        methodKeys: extrinsic.method ? Object.keys(extrinsic.method) : [],
      })

      // El formato puede variar, intentar diferentes formas de acceso
      let pallet: string | undefined
      let methodName: string | undefined
      let args: any[] | undefined

      // Formato 1: extrinsic.method.pallet y extrinsic.method.method
      if (extrinsic.method && typeof extrinsic.method === 'object') {
        pallet = (extrinsic.method as any).pallet || (extrinsic.method as any).section
        methodName = (extrinsic.method as any).method || (extrinsic.method as any).name
        args = (extrinsic.method as any).args || (extrinsic.method as any).arguments
      }

      // Formato 2: Si viene como string codificado, puede necesitar decodificación
      if (!pallet && !methodName) {
        console.warn('[TransactionDetail] No se pudo extraer pallet/method, formato:', typeof extrinsic)
        // Intentar parsear si es string
        if (typeof extrinsic === 'string') {
          try {
            const decoded = JSON.parse(extrinsic)
            pallet = decoded.pallet || decoded.section
            methodName = decoded.method || decoded.name
            args = decoded.args || decoded.arguments
          } catch (e) {
            console.error('[TransactionDetail] Error al parsear extrinsic como string:', e)
          }
        }
      }

      console.log('[TransactionDetail] Pallet/Method extraídos:', {
        pallet,
        methodName,
        hasArgs: !!args,
        argsLength: args?.length,
      })

      // Verificar que es system.remark o system.remarkWithEvent
      if (pallet !== 'System' || (methodName !== 'remark' && methodName !== 'remarkWithEvent')) {
        console.warn('[TransactionDetail] No es system.remark ni system.remarkWithEvent:', { pallet, methodName })
        return
      }

      // Extraer contenido del remark
      if (!args || args.length === 0) {
        console.warn('[TransactionDetail] No hay argumentos en el remark')
        return
      }

      // El contenido puede venir en diferentes formatos
      let content: string
      const firstArg = args[0]
      
      if (typeof firstArg === 'string') {
        content = firstArg
      } else if (firstArg instanceof Uint8Array) {
        content = new TextDecoder().decode(firstArg)
      } else if (typeof firstArg === 'object' && firstArg !== null) {
        // Puede ser un objeto con método toString o toHex
        if ('toString' in firstArg && typeof firstArg.toString === 'function') {
          content = firstArg.toString()
        } else if ('toHex' in firstArg && typeof firstArg.toHex === 'function') {
          const hex = firstArg.toHex()
          // Convertir hex a string (remover 0x si existe)
          const hexStr = hex.startsWith('0x') ? hex.slice(2) : hex
          content = Buffer.from(hexStr, 'hex').toString('utf-8')
        } else {
          content = JSON.stringify(firstArg)
        }
      } else {
        content = String(firstArg)
      }
      setRemarkContent(content)
      console.log('[TransactionDetail] Remark obtenido:', {
        length: content.length,
        preview: content.substring(0, 100) + '...',
        startsWithEmergency: content.startsWith('EMERGENCY:'),
      })

      // Parsear si es emergencia
      const emergencyData = parseEmergencyFromRemark(content)
      if (emergencyData) {
        setParsedEmergency(emergencyData)
        console.log('[TransactionDetail] Emergencia parseada:', emergencyData)
      } else {
        console.warn('[TransactionDetail] No se pudo parsear como emergencia')
      }
    } catch (err) {
      console.error('[TransactionDetail] Error al obtener remark:', err)
      toast.error('Error al obtener contenido del remark', {
        description: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setIsLoadingRemark(false)
    }
  }

  const handleCopyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  const isEmergency = transaction?.metadata && transaction.metadata.emergencyId

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/transactions')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Detalles de Transacción</h1>
        </div>
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando transacción...</p>
        </div>
      </div>
    )
  }

  if (error || !transaction) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/transactions')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Detalles de Transacción</h1>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            {error || 'Transacción no encontrada'}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to="/transactions">Volver a Transacciones</Link>
        </Button>
      </div>
    )
  }

  const account = accounts.find(acc => acc.address === transaction.accountAddress)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/transactions')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Detalles de Transacción</h1>
          <p className="text-muted-foreground mt-1">
            {isEmergency ? 'Emergencia registrada en blockchain' : 'Información completa de la transacción'}
          </p>
        </div>
      </div>

      {/* Información General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isEmergency ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Emergencia
              </>
            ) : (
              <>
                <FileText className="h-5 w-5" />
                Información General
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hash de Transacción */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hash de Transacción</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded break-all">
                {transaction.txHash}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyHash(transaction.txHash)}
              >
                {copiedHash ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Cuenta */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Cuenta</Label>
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <Identicon
                  value={transaction.accountAddress}
                  size={32}
                  theme="polkadot"
                />
              </Avatar>
              <div>
                <p className="font-medium">{account?.meta.name || 'Sin nombre'}</p>
                <code className="text-xs text-muted-foreground">{formatAddress(transaction.accountAddress)}</code>
              </div>
            </div>
          </div>

          {/* Cadena */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Cadena</Label>
            <Badge variant="outline">{transaction.chain}</Badge>
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Estado</Label>
            <Badge variant={transaction.status === 'finalized' ? 'default' : 'secondary'}>
              {transaction.status === 'finalized' ? 'Finalizada' :
               transaction.status === 'inBlock' ? 'En Bloque' :
               transaction.status === 'pending' ? 'Pendiente' :
               transaction.status === 'invalid' ? 'Inválida' :
               transaction.status === 'dropped' ? 'Descartada' : transaction.status}
            </Badge>
          </div>

          {/* Información de Bloque */}
          {transaction.blockNumber && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bloque</Label>
              <p className="text-sm">#{transaction.blockNumber}</p>
              {transaction.extrinsicIndex !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Extrinsic Index: {transaction.extrinsicIndex}
                </p>
              )}
            </div>
          )}

          {/* Fecha */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fecha</Label>
            <p className="text-sm">
              {new Date(transaction.createdAt).toLocaleString('es-ES', {
                dateStyle: 'long',
                timeStyle: 'medium'
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Detalles de Emergencia */}
      {isEmergency && parsedEmergency && (
        <Card className="border-red-300 bg-red-50/30 dark:bg-red-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Detalles de la Emergencia
            </CardTitle>
            <CardDescription>
              Información completa extraída del remark en blockchain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tipo y Severidad */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo</Label>
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {parsedEmergency.type === 'medical' ? 'Médica' :
                   parsedEmergency.type === 'rescue' ? 'Rescate' :
                   parsedEmergency.type === 'weather' ? 'Climática' :
                   parsedEmergency.type === 'equipment' ? 'Equipo' :
                   parsedEmergency.type === 'lost' ? 'Extraviado' :
                   parsedEmergency.type === 'injury' ? 'Lesión' :
                   parsedEmergency.type === 'illness' ? 'Enfermedad' :
                   parsedEmergency.type === 'avalanche' ? 'Avalancha' :
                   parsedEmergency.type === 'rockfall' ? 'Caída de Rocas' :
                   parsedEmergency.type}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Severidad</Label>
                <Badge variant="destructive" className="gap-1">
                  {parsedEmergency.severity === 'critical' ? 'Crítica' :
                   parsedEmergency.severity === 'high' ? 'Alta' :
                   parsedEmergency.severity === 'medium' ? 'Media' : 'Baja'}
                </Badge>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Descripción</Label>
              <p className="text-sm bg-background p-3 rounded border">{parsedEmergency.description}</p>
            </div>

            {/* Ubicación */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Ubicación
              </Label>
              <div className="bg-background p-3 rounded border space-y-1 text-sm">
                <p><strong>Latitud:</strong> {parsedEmergency.location.latitude.toFixed(6)}</p>
                <p><strong>Longitud:</strong> {parsedEmergency.location.longitude.toFixed(6)}</p>
                {parsedEmergency.location.altitude && (
                  <p><strong>Altitud:</strong> {Math.round(parsedEmergency.location.altitude)}m</p>
                )}
                {parsedEmergency.location.accuracy && (
                  <p><strong>Precisión:</strong> ±{Math.round(parsedEmergency.location.accuracy)}m</p>
                )}
                <p className="text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {new Date(parsedEmergency.location.timestamp).toLocaleString('es-ES')}
                </p>
              </div>
            </div>

            {/* Información de Bitácora */}
            {parsedEmergency.metadata && (
              <>
                {(parsedEmergency.metadata.logTitle || parsedEmergency.metadata.mountainName) && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Mountain className="h-4 w-4" />
                      Bitácora
                    </Label>
                    <div className="bg-background p-3 rounded border space-y-1 text-sm">
                      {parsedEmergency.metadata.logTitle && (
                        <p><strong>Título:</strong> {parsedEmergency.metadata.logTitle}</p>
                      )}
                      {parsedEmergency.metadata.mountainName && (
                        <p><strong>Montaña:</strong> {parsedEmergency.metadata.mountainName}</p>
                      )}
                      {parsedEmergency.metadata.logLocation && (
                        <p><strong>Ubicación:</strong> {parsedEmergency.metadata.logLocation}</p>
                      )}
                      {parsedEmergency.metadata.logStartDate && (
                        <p className="text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Inicio: {new Date(parsedEmergency.metadata.logStartDate).toLocaleString('es-ES')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Aviso de Salida */}
                {parsedEmergency.metadata.avisoSalida && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Aviso de Salida
                    </Label>
                    <div className="bg-background p-3 rounded border space-y-1 text-sm">
                      {parsedEmergency.metadata.avisoSalida.guiaNombre && (
                        <p><strong>Guía:</strong> {parsedEmergency.metadata.avisoSalida.guiaNombre}</p>
                      )}
                      {parsedEmergency.metadata.avisoSalida.lugarDestino && (
                        <p><strong>Destino:</strong> {parsedEmergency.metadata.avisoSalida.lugarDestino}</p>
                      )}
                      {parsedEmergency.metadata.avisoSalida.numeroParticipantes && (
                        <p><strong>Participantes:</strong> {parsedEmergency.metadata.avisoSalida.numeroParticipantes}</p>
                      )}
                      {parsedEmergency.metadata.avisoSalida.tipoActividad && (
                        <p><strong>Actividad:</strong> {parsedEmergency.metadata.avisoSalida.tipoActividad}</p>
                      )}
                      {parsedEmergency.metadata.avisoSalida.fechaSalida && (
                        <p className="text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {new Date(parsedEmergency.metadata.avisoSalida.fechaSalida).toLocaleString('es-ES')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Trail/Ruta */}
                {parsedEmergency.metadata.trail && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Route className="h-4 w-4" />
                      Ruta
                    </Label>
                    <div className="bg-background p-3 rounded border space-y-1 text-sm">
                      {parsedEmergency.metadata.trail.name && (
                        <p><strong>Nombre:</strong> {parsedEmergency.metadata.trail.name}</p>
                      )}
                      {parsedEmergency.metadata.trail.distance && (
                        <p><strong>Distancia:</strong> {parsedEmergency.metadata.trail.distance}m</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Milestone */}
                {parsedEmergency.metadata.milestone && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Milestone
                    </Label>
                    <div className="bg-background p-3 rounded border space-y-1 text-sm">
                      {parsedEmergency.metadata.milestone.title && (
                        <p><strong>Título:</strong> {parsedEmergency.metadata.milestone.title}</p>
                      )}
                      {parsedEmergency.metadata.milestone.type && (
                        <p><strong>Tipo:</strong> {parsedEmergency.metadata.milestone.type}</p>
                      )}
                      {parsedEmergency.metadata.milestone.elevation && (
                        <p><strong>Elevación:</strong> {Math.round(parsedEmergency.metadata.milestone.elevation)}m</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* IDs Relacionados */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">IDs Relacionados</Label>
              <div className="bg-background p-3 rounded border space-y-1 text-sm">
                <p><strong>Emergency ID:</strong> <code className="text-xs">{parsedEmergency.emergencyId}</code></p>
                {parsedEmergency.relatedLogId && (
                  <p><strong>Log ID:</strong> <code className="text-xs">{parsedEmergency.relatedLogId}</code></p>
                )}
                {parsedEmergency.relatedMilestoneId && (
                  <p><strong>Milestone ID:</strong> <code className="text-xs">{parsedEmergency.relatedMilestoneId}</code></p>
                )}
                <p><strong>Reporter Account:</strong> <code className="text-xs">{formatAddress(parsedEmergency.reporterAccount)}</code></p>
              </div>
            </div>

            {/* Timestamps */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Timestamps</Label>
              <div className="bg-background p-3 rounded border space-y-1 text-sm">
                <p className="text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Creada: {new Date(parsedEmergency.createdAt).toLocaleString('es-ES')}
                </p>
                <p className="text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Reportada: {new Date(parsedEmergency.reportedAt).toLocaleString('es-ES')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contenido del Remark (Raw) */}
      {isEmergency && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contenido del Remark (Raw)
            </CardTitle>
            <CardDescription>
              Contenido completo del remark extraído desde la blockchain
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRemark ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Obteniendo remark desde blockchain...</p>
              </div>
            ) : remarkContent ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Tamaño: {remarkContent.length} caracteres
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyHash(remarkContent)}
                  >
                    {copiedHash ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
                <pre className="text-xs bg-muted p-4 rounded border overflow-auto max-h-96 font-mono">
                  {remarkContent}
                </pre>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No se pudo obtener el contenido del remark. 
                  {transaction.blockNumber && transaction.extrinsicIndex !== undefined ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => loadRemarkFromBlockchain(transaction)}
                    >
                      Intentar Obtener
                    </Button>
                  ) : (
                    ' La transacción no tiene información de bloque suficiente.'
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metadata Completa (JSON) */}
      {transaction.metadata && (
        <Card>
          <CardHeader>
            <CardTitle>Metadata Completa</CardTitle>
            <CardDescription>
              Todos los datos almacenados en la transacción
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded border overflow-auto max-h-96">
              {JSON.stringify(transaction.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate('/transactions')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Transacciones
        </Button>
        {transaction.blockNumber && (
          <Button variant="outline" asChild>
            <a
              href={`https://polkadot.js.org/apps/?rpc=${encodeURIComponent(transaction.chainEndpoint || '')}#/explorer/query/${transaction.blockNumber}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver en Explorer
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}
