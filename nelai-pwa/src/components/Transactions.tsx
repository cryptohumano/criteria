import { useState } from 'react'
import { DedotClient } from 'dedot'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import Identicon from '@polkadot/react-identicon'
import type { TxStatus } from 'dedot/types'

/**
 * Componente para enviar transacciones usando la API de Dedot
 * Basado en: https://docs.dedot.dev/client-api/transactions
 */
interface TransactionsProps {
  client: DedotClient | null
}

type TransactionType = 'transfer' | 'transferKeepAlive'

export function Transactions({ client }: TransactionsProps) {
  const { accounts, getAccount, isUnlocked } = useKeyringContext()
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

  const handleEstimateFee = async () => {
    if (!client || !selectedAddress || !destAddress || !amount) {
      alert('Por favor completa todos los campos requeridos')
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
      setError(err.message || 'Error al estimar la tarifa')
    } finally {
      setIsEstimating(false)
    }
  }

  const handleSendTransaction = async () => {
    if (!client || !selectedAddress || !destAddress || !amount) {
      alert('Por favor completa todos los campos requeridos')
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
      
      // Construir opciones del signer
      const signerOptions: any = {}
      if (nonce) {
        signerOptions.nonce = parseInt(nonce, 10)
      }
      if (tip) {
        signerOptions.tip = BigInt(tip)
      }

      // Crear la transacción
      const tx = txType === 'transferKeepAlive'
        ? client.tx.balances.transferKeepAlive(destAddress, amountBigInt)
        : client.tx.balances.transfer(destAddress, amountBigInt)

      // Firmar y enviar la transacción, esperando hasta que se finalice
      const result = await tx.signAndSend(
        account.pair,
        signerOptions,
        (result) => {
          const { status } = result
          setTxStatus(status)
          setTxHash(result.txHash)
          
          if (status.type === 'BestChainBlockIncluded' || status.type === 'Finalized') {
            if (status.type === 'Finalized') {
              setFinalizedBlock({
                blockHash: status.value.blockHash,
                blockNumber: status.value.blockNumber,
              })
            }
          } else if (status.type === 'Invalid' || status.type === 'Drop') {
            setError(status.value.error)
          }
        }
      ).untilFinalized()
      
      // Actualizar estado final
      setTxHash(result.txHash)
      setFinalizedBlock({
        blockHash: result.status.value.blockHash,
        blockNumber: result.status.value.blockNumber,
      })
      setTxStatus(result.status)
    } catch (err: any) {
      setError(err.message || 'Error al enviar la transacción')
    } finally {
      setIsSending(false)
    }
  }

  const formatBalance = (value: bigint | string) => {
    const num = typeof value === 'string' ? BigInt(value) : value
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  if (!client) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Transacciones
          </CardTitle>
          <CardDescription>
            Conecta a una red para enviar transacciones
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!isUnlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Transacciones
          </CardTitle>
          <CardDescription>
            Desbloquea el keyring para enviar transacciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Usa el componente "Desbloquear Keyring" para cargar tus cuentas
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Enviar Transacción
        </CardTitle>
        <CardDescription>
          Envía transacciones usando la{' '}
          <a
            href="https://docs.dedot.dev/client-api/transactions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            API de Transacciones de Dedot
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selección de cuenta */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Cuenta Remitente</p>
          <select
            value={selectedAddress}
            onChange={(e) => setSelectedAddress(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
            disabled={isSending}
          >
            <option value="">Selecciona una cuenta</option>
            {accounts.map((account) => (
              <option key={account.address} value={account.address}>
                {account.meta.name || 'Sin nombre'} - {account.address.substring(0, 16)}...
              </option>
            ))}
          </select>
          {selectedAddress && (
            <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
              <Identicon
                value={selectedAddress}
                size={32}
                theme="polkadot"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono truncate">
                  {selectedAddress}
                  </p>
              </div>
            </div>
          )}
        </div>

        {/* Tipo de transacción */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Tipo de Transacción</p>
          <select
            value={txType}
            onChange={(e) => setTxType(e.target.value as TransactionType)}
            className="w-full p-2 border rounded-md bg-background"
            disabled={isSending}
          >
            <option value="transferKeepAlive">Transfer Keep Alive (mantiene la cuenta viva)</option>
            <option value="transfer">Transfer (puede eliminar la cuenta si queda sin fondos)</option>
          </select>
        </div>

        {/* Dirección destino */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Dirección Destino</p>
          <Input
            placeholder="Dirección SS58 del destinatario"
            value={destAddress}
            onChange={(e) => setDestAddress(e.target.value)}
            disabled={isSending}
          />
        </div>

        {/* Cantidad */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Cantidad (en unidades más pequeñas)</p>
          <Input
            type="text"
            placeholder="Ej: 1000000000000 (1 DOT = 10^12 unidades)"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            disabled={isSending}
          />
          <p className="text-xs text-muted-foreground">
            Ingresa la cantidad en la unidad más pequeña de la cadena (ej: 1 DOT = 1,000,000,000,000 unidades)
          </p>
        </div>

        {/* Opciones avanzadas */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Opciones Avanzadas (opcional)</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Nonce (personalizado)</label>
              <Input
                type="number"
                placeholder="Auto"
                value={nonce}
                onChange={(e) => setNonce(e.target.value)}
                disabled={isSending}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tip (opcional)</label>
              <Input
                type="text"
                placeholder="0"
                value={tip}
                onChange={(e) => setTip(e.target.value.replace(/\D/g, ''))}
                disabled={isSending}
              />
            </div>
          </div>
        </div>

        {/* Estimar tarifa */}
        <div className="flex gap-2">
          <Button
            onClick={handleEstimateFee}
            variant="outline"
            disabled={!selectedAddress || !destAddress || !amount || isEstimating || isSending}
          >
            {isEstimating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Estimando...
              </>
            ) : (
              'Estimar Tarifa'
            )}
          </Button>
        </div>

        {/* Información de pago */}
        {paymentInfo && (
          <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-sm font-medium mb-1 text-blue-800 dark:text-blue-200">
              Tarifa Estimada:
            </p>
            <p className="text-lg font-mono">
              {formatBalance(paymentInfo.partialFee)} unidades
            </p>
          </div>
        )}

        {/* Enviar transacción */}
        <Button
          onClick={handleSendTransaction}
          disabled={!selectedAddress || !destAddress || !amount || isSending}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar Transacción
            </>
          )}
        </Button>

        {/* Estado de la transacción */}
        {txStatus && (
          <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-2">
              {txStatus.type === 'Finalized' ? (
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : txStatus.type === 'Invalid' || txStatus.type === 'Drop' ? (
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              )}
              <p className="font-medium">
                Estado: {txStatus.type}
              </p>
            </div>
            
            {txStatus.type === 'BestChainBlockIncluded' && txStatus.value && (
              <div className="text-sm space-y-1">
                <p>Bloque: {txStatus.value.blockNumber}</p>
                <p className="text-xs font-mono break-all">
                  Hash: {txStatus.value.blockHash}
                </p>
              </div>
            )}

            {txStatus.type === 'Finalized' && txStatus.value && (
              <div className="text-sm space-y-1">
                <Badge variant="default" className="bg-green-600">
                  ✓ Finalizada
                </Badge>
                <p>Bloque: {txStatus.value.blockNumber}</p>
                <p className="text-xs font-mono break-all">
                  Hash: {txStatus.value.blockHash}
                </p>
              </div>
            )}

            {txStatus.type === 'Invalid' && (
              <div className="text-sm text-red-600 dark:text-red-400">
                Error: {txStatus.value.error}
              </div>
            )}

            {txStatus.type === 'Drop' && (
              <div className="text-sm text-red-600 dark:text-red-400">
                Error: {txStatus.value.error}
              </div>
            )}
          </div>
        )}

        {/* Hash de la transacción */}
        {txHash && (
          <div className="p-3 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-1">Hash de la Transacción:</p>
            <p className="text-xs font-mono break-all">{txHash}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

