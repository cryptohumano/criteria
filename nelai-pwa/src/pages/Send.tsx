import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useNetwork } from '@/contexts/NetworkContext'
import { Send as SendIcon, Loader2, CheckCircle, XCircle, AlertCircle, Copy, Check } from 'lucide-react'
import Identicon from '@polkadot/react-identicon'
import { Avatar } from '@/components/ui/avatar'
import type { TxStatus } from 'dedot/types'
import { saveTransaction, updateTransactionStatus, type StoredTransaction } from '@/utils/transactionStorage'
import { formatBalanceForDisplay } from '@/utils/balance'

type TransactionType = 'transfer' | 'transferKeepAlive'

export default function Send() {
  const { accounts, getAccount, isUnlocked } = useKeyringContext()
  const { client, selectedChain, isConnecting } = useNetwork()
  const [selectedAddress, setSelectedAddress] = useState('')
  const [destAddress, setDestAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [txType, setTxType] = useState<TransactionType>('transferKeepAlive')
  const [nonce, setNonce] = useState<string>('')
  const [tip, setTip] = useState<string>('')
  const [isSending, setIsSending] = useState(false)
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [finalizedBlock, setFinalizedBlock] = useState<{
    blockHash: string
    blockNumber: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<{
    partialFee: bigint
  } | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)

  const handleEstimateFee = async () => {
    if (!client || !selectedAddress || !destAddress || !amount) {
      setError('Por favor completa todos los campos requeridos')
      return
    }

    setIsEstimating(true)
    setError(null)
    setPaymentInfo(null)

    try {
      const account = getAccount(selectedAddress)
      if (!account) {
        throw new Error('Cuenta no encontrada')
      }

      const amountBigInt = BigInt(amount)
      const tx = txType === 'transferKeepAlive'
        ? client.tx.balances.transferKeepAlive(destAddress, amountBigInt)
        : client.tx.balances.transfer(destAddress, amountBigInt)

      const info = await tx.paymentInfo(account.address)
      setPaymentInfo(info)
    } catch (err: any) {
      setError(err.message || 'Error al estimar el fee')
    } finally {
      setIsEstimating(false)
    }
  }

  const handleSendTransaction = async () => {
    if (!client || !selectedAddress || !destAddress || !amount) {
      setError('Por favor completa todos los campos requeridos')
      return
    }

    setIsSending(true)
    setError(null)
    setTxStatus(null)
    setTxHash(null)
    setFinalizedBlock(null)

    try {
      const account = getAccount(selectedAddress)
      if (!account) {
        throw new Error('Cuenta no encontrada')
      }

      const amountBigInt = BigInt(amount)
      
      const signerOptions: any = {}
      if (nonce) {
        signerOptions.nonce = parseInt(nonce, 10)
      }
      if (tip) {
        signerOptions.tip = BigInt(tip)
      }

      const tx = txType === 'transferKeepAlive'
        ? client.tx.balances.transferKeepAlive(destAddress, amountBigInt)
        : client.tx.balances.transfer(destAddress, amountBigInt)

      // Guardar transacción inicial (pending)
      const storedTx: StoredTransaction = {
        id: '', // Se establecerá cuando tengamos el hash
        accountAddress: selectedAddress,
        toAddress: destAddress,
        amount: amountBigInt.toString(),
        chain: selectedChain.name,
        chainEndpoint: selectedChain.endpoint,
        type: txType,
        status: 'pending',
        txHash: '', // Se establecerá cuando tengamos el hash
        nonce: nonce ? parseInt(nonce, 10) : undefined,
        tip: tip ? BigInt(tip).toString() : undefined,
        fee: paymentInfo ? paymentInfo.partialFee.toString() : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const result = await tx.signAndSend(
        account.pair,
        signerOptions,
        async (result) => {
          const { status } = result
          setTxStatus(status)
          setTxHash(result.txHash)
          
          // Actualizar transacción guardada
          if (result.txHash && storedTx.id === '') {
            storedTx.id = result.txHash
            storedTx.txHash = result.txHash
            try {
              await saveTransaction(storedTx)
            } catch (err) {
              console.error('Error al guardar transacción inicial:', err)
            }
          }
          
          // Actualizar estado de la transacción
          let newStatus: StoredTransaction['status'] = 'pending'
          if (status.type === 'BestChainBlockIncluded') {
            newStatus = 'inBlock'
          } else if (status.type === 'Finalized') {
            newStatus = 'finalized'
            setFinalizedBlock({
              blockHash: status.value.blockHash,
              blockNumber: status.value.blockNumber,
            })
          } else if (status.type === 'Invalid') {
            newStatus = 'invalid'
            setError(status.value.error)
          } else if (status.type === 'Drop') {
            newStatus = 'dropped'
            setError('Transacción descartada')
          }

          if (result.txHash && newStatus !== 'pending') {
            try {
              await updateTransactionStatus(
                result.txHash,
                newStatus,
                status.type === 'Finalized' || status.type === 'BestChainBlockIncluded' 
                  ? status.value.blockHash 
                  : undefined,
                status.type === 'Finalized' || status.type === 'BestChainBlockIncluded' 
                  ? status.value.blockNumber 
                  : undefined,
                status.type === 'Invalid' ? status.value.error : undefined
              )
            } catch (err) {
              console.error('Error al actualizar estado de transacción:', err)
            }
          }
        }
      ).untilFinalized()
      
      setTxHash(result.txHash)
      setFinalizedBlock({
        blockHash: result.status.value.blockHash,
        blockNumber: result.status.value.blockNumber,
      })
      setTxStatus(result.status)

      // Guardar/actualizar transacción finalizada
      if (result.txHash) {
        storedTx.id = result.txHash
        storedTx.txHash = result.txHash
        storedTx.status = 'finalized'
        storedTx.blockHash = result.status.value.blockHash
        storedTx.blockNumber = result.status.value.blockNumber
        storedTx.finalizedAt = Date.now()
        storedTx.updatedAt = Date.now()
        
        try {
          await saveTransaction(storedTx)
          console.log('[Send] ✅ Transacción guardada en IndexedDB:', result.txHash)
        } catch (err) {
          console.error('[Send] ❌ Error al guardar transacción finalizada:', err)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error al enviar la transacción')
    } finally {
      setIsSending(false)
    }
  }

  const handleCopyHash = async () => {
    if (txHash) {
      await navigator.clipboard.writeText(txHash)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  if (!isUnlocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Enviar</h1>
          <p className="text-muted-foreground mt-2">
            El wallet debe estar desbloqueado para enviar transacciones
          </p>
        </div>
      </div>
    )
  }

  if (!selectedChain) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Enviar</h1>
          <p className="text-muted-foreground mt-2">
            Selecciona una red en el navbar para enviar transacciones
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Enviar</h1>
        <p className="text-muted-foreground mt-2">
          Envía tokens desde tu cuenta a otra dirección
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle>Nueva Transacción</CardTitle>
            <CardDescription>
              Red: {selectedChain.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selección de cuenta */}
            <div className="space-y-2">
              <Label>Cuenta Origen</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedAddress}
                onChange={(e) => setSelectedAddress(e.target.value)}
              >
                <option value="">Selecciona una cuenta</option>
                {accounts.map((account) => (
                  <option key={account.address} value={account.address}>
                    {account.meta.name || 'Sin nombre'} - {formatAddress(account.address)}
                  </option>
                ))}
              </select>
              {selectedAddress && (
                <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                  <Avatar className="h-8 w-8">
                    <Identicon value={selectedAddress} size={32} theme="polkadot" />
                  </Avatar>
                  <code className="text-xs font-mono">{selectedAddress}</code>
                </div>
              )}
            </div>

            {/* Dirección destino */}
            <div className="space-y-2">
              <Label htmlFor="destAddress">Dirección Destino</Label>
              <Input
                id="destAddress"
                value={destAddress}
                onChange={(e) => setDestAddress(e.target.value)}
                placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
              />
            </div>

            {/* Cantidad */}
            <div className="space-y-2">
              <Label htmlFor="amount">Cantidad</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000000000000"
              />
              <p className="text-xs text-muted-foreground">
                Ingresa la cantidad en la unidad más pequeña (Planck para DOT)
              </p>
            </div>

            {/* Tipo de transacción */}
            <div className="space-y-2">
              <Label>Tipo de Transacción</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={txType === 'transferKeepAlive' ? 'default' : 'outline'}
                  onClick={() => setTxType('transferKeepAlive')}
                  className="flex-1"
                >
                  Transfer Keep Alive
                </Button>
                <Button
                  type="button"
                  variant={txType === 'transfer' ? 'default' : 'outline'}
                  onClick={() => setTxType('transfer')}
                  className="flex-1"
                >
                  Transfer
                </Button>
              </div>
            </div>

            {/* Opciones avanzadas */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm font-medium">Opciones Avanzadas (Opcional)</Label>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="nonce" className="text-xs">Nonce</Label>
                  <Input
                    id="nonce"
                    type="number"
                    value={nonce}
                    onChange={(e) => setNonce(e.target.value)}
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <Label htmlFor="tip" className="text-xs">Tip</Label>
                  <Input
                    id="tip"
                    type="number"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Estimación de fee */}
            {paymentInfo && (
              <Alert>
                <AlertDescription>
                  <strong>Fee estimado:</strong> {paymentInfo.partialFee.toString()}
                </AlertDescription>
              </Alert>
            )}

            {/* Errores */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Botones */}
            <div className="flex gap-2">
              <Button
                onClick={handleEstimateFee}
                disabled={!client || !selectedAddress || !destAddress || !amount || isEstimating || isSending}
                variant="outline"
                className="flex-1"
              >
                {isEstimating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Estimando...
                  </>
                ) : (
                  'Estimar Fee'
                )}
              </Button>
              <Button
                onClick={handleSendTransaction}
                disabled={!client || !selectedAddress || !destAddress || !amount || isSending || isEstimating}
                className="flex-1"
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <SendIcon className="mr-2 h-4 w-4" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estado de la transacción */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de la Transacción</CardTitle>
            <CardDescription>
              Información sobre la última transacción enviada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!txHash && !txStatus && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay transacciones enviadas aún</p>
              </div>
            )}

            {txHash && (
              <div className="space-y-2">
                <Label>Hash de Transacción</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all p-2 bg-muted rounded">
                    {txHash}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyHash}
                  >
                    {copiedHash ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {txStatus && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <div>
                  {txStatus.type === 'Finalized' ? (
                    <Badge className="gap-2 bg-green-500">
                      <CheckCircle className="h-3 w-3" />
                      Finalizada
                    </Badge>
                  ) : txStatus.type === 'Invalid' || txStatus.type === 'Drop' ? (
                    <Badge variant="destructive" className="gap-2">
                      <XCircle className="h-3 w-3" />
                      {txStatus.type === 'Invalid' ? 'Inválida' : 'Descartada'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {txStatus.type}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {finalizedBlock && (
              <div className="space-y-2">
                <Label>Bloque Finalizado</Label>
                <div className="space-y-1">
                  <p className="text-sm">
                    <strong>Número:</strong> {finalizedBlock.blockNumber}
                  </p>
                  <code className="text-xs font-mono break-all p-2 bg-muted rounded block">
                    {finalizedBlock.blockHash}
                  </code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
