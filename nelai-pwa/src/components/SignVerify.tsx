import { useState, useMemo } from 'react'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileText, CheckCircle, XCircle } from 'lucide-react'
import { stringToU8a, u8aToHex } from '@polkadot/util'
import { signatureVerify } from '@polkadot/util-crypto'
import Identicon from '@polkadot/react-identicon'
import type { KeyringAccount } from '@/hooks/useKeyring'

type CryptoType = 'sr25519' | 'ed25519' | 'ecdsa' | 'all'

export function SignVerify() {
  const { accounts, getAccount, keyring } = useKeyringContext()
  const [selectedAddress, setSelectedAddress] = useState('')
  const [message, setMessage] = useState('')
  const [signature, setSignature] = useState('')
  const [cryptoTypeFilter, setCryptoTypeFilter] = useState<CryptoType>('all')
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean
    address?: string
  } | null>(null)

  // Filtrar cuentas por tipo de criptografía
  const filteredAccounts = useMemo(() => {
    if (cryptoTypeFilter === 'all' || !keyring) return accounts
    return accounts.filter((account) => {
      try {
        const pair = keyring.getPair(account.address)
        return pair.type === cryptoTypeFilter
      } catch {
        return false
      }
    })
  }, [accounts, cryptoTypeFilter, keyring])

  // Obtener el tipo de criptografía de la cuenta seleccionada
  const selectedAccountType = useMemo(() => {
    if (!selectedAddress || !keyring) return null
    try {
      const pair = keyring.getPair(selectedAddress)
      return pair.type
    } catch {
      return null
    }
  }, [selectedAddress, keyring])

  const handleSign = () => {
    if (!selectedAddress || !message.trim()) return

    const account = getAccount(selectedAddress)
    if (!account) {
      alert('Cuenta no encontrada')
      return
    }

    try {
      const messageBytes = stringToU8a(message)
      const sig = account.pair.sign(messageBytes)
      setSignature(u8aToHex(sig))
      setVerificationResult(null)
    } catch (error: any) {
      alert(`Error al firmar: ${error.message}`)
    }
  }

  const handleVerify = () => {
    if (!message.trim() || !signature.trim()) {
      alert('Por favor completa el mensaje y la firma')
      return
    }

    try {
      const messageBytes = stringToU8a(message)
      const sigHex = signature.startsWith('0x') ? signature : `0x${signature}`
      
      // Intentar verificar con cada cuenta
      for (const account of accounts) {
        const { isValid } = signatureVerify(messageBytes, sigHex, account.address)
        if (isValid) {
          setVerificationResult({ isValid: true, address: account.address })
          return
        }
      }

      // Si no coincide con ninguna cuenta, verificar con la dirección seleccionada
      if (selectedAddress) {
        const { isValid } = signatureVerify(messageBytes, sigHex, selectedAddress)
        setVerificationResult({ isValid, address: selectedAddress })
      } else {
        setVerificationResult({ isValid: false })
      }
    } catch (error: any) {
      alert(`Error al verificar: ${error.message}`)
      setVerificationResult({ isValid: false })
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Firmar Mensaje */}
      <Card>
        <CardHeader>
          <CardTitle>Firmar Mensaje</CardTitle>
          <CardDescription>
            Firma un mensaje con una de tus cuentas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                No hay cuentas disponibles. Crea una cuenta primero en la sección "Gestión de Cuentas" arriba.
              </p>
            </div>
          ) : (
            <>
              {/* Filtro de tipo de criptografía */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Filtrar por Tipo de Criptografía</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={cryptoTypeFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCryptoTypeFilter('all')}
                    className="flex-1"
                  >
                    Todas
                  </Button>
                  <Button
                    type="button"
                    variant={cryptoTypeFilter === 'sr25519' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCryptoTypeFilter('sr25519')}
                    className="flex-1"
                  >
                    sr25519
                  </Button>
                  <Button
                    type="button"
                    variant={cryptoTypeFilter === 'ed25519' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCryptoTypeFilter('ed25519')}
                    className="flex-1"
                  >
                    ed25519
                  </Button>
                  <Button
                    type="button"
                    variant={cryptoTypeFilter === 'ecdsa' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCryptoTypeFilter('ecdsa')}
                    className="flex-1"
                  >
                    ecdsa
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Seleccionar Cuenta ({filteredAccounts.length} disponible{filteredAccounts.length !== 1 ? 's' : ''})
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedAddress}
                  onChange={(e) => setSelectedAddress(e.target.value)}
                >
                  <option value="">Selecciona una cuenta</option>
                  {filteredAccounts.map((account) => {
                    let accountType = 'unknown'
                    try {
                      if (keyring) {
                        accountType = keyring.getPair(account.address).type
                      }
                    } catch {}
                    return (
                      <option key={account.address} value={account.address}>
                        {account.meta.name || 'Sin nombre'} ({accountType}) - {account.address.substring(0, 20)}...
                      </option>
                    )
                  })}
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
                      {selectedAccountType && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {selectedAccountType}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mensaje</label>
                <Input
                  placeholder="Mensaje a firmar"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <Button onClick={handleSign} disabled={!selectedAddress || !message.trim()} className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Firmar Mensaje
              </Button>

              {signature && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Firma (hex):</p>
                  <p className="text-xs font-mono break-all">{signature}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Verificar Firma */}
      <Card>
        <CardHeader>
          <CardTitle>Verificar Firma</CardTitle>
          <CardDescription>
            Verifica la autenticidad de una firma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mensaje Original</label>
            <Input
              placeholder="Mensaje que fue firmado"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Firma (hex)</label>
            <Input
              placeholder="0x..."
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Dirección del Firmante (opcional)</label>
            <Input
              placeholder="Dirección SS58"
              value={selectedAddress}
              onChange={(e) => setSelectedAddress(e.target.value)}
            />
          </div>

          <Button onClick={handleVerify} disabled={!message.trim() || !signature.trim()} className="w-full">
            Verificar Firma
          </Button>

          {verificationResult && (
            <div className={`p-4 border rounded-lg ${
              verificationResult.isValid ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'
            }`}>
              <div className="flex items-center gap-2">
                {verificationResult.isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <div>
                  <p className={`font-medium ${
                    verificationResult.isValid ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
                  }`}>
                    {verificationResult.isValid ? 'Firma válida' : 'Firma inválida'}
                  </p>
                  {verificationResult.address && (
                    <div className="flex items-center gap-2 mt-2">
                      <Identicon
                        value={verificationResult.address}
                        size={24}
                        theme="polkadot"
                      />
                      <p className="text-xs text-muted-foreground">
                        Verificada con: {verificationResult.address.substring(0, 20)}...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

