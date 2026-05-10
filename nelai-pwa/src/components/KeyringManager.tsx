import { useState, useMemo } from 'react'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Key, Plus, Trash2, Copy, Check, ExternalLink } from 'lucide-react'
import type { KeyringAccount } from '@/hooks/useKeyring'
import Identicon from '@polkadot/react-identicon'
import { deriveEthereumAddressFromPair } from '@/utils/ethereum'

type CryptoType = 'sr25519' | 'ed25519' | 'ecdsa'

export function KeyringManager() {
  const { keyring, isReady, accounts, isUnlocked, generateMnemonic, addFromMnemonic, addFromUri, removeAccount } = useKeyringContext()
  const [mnemonic, setMnemonic] = useState('')
  const [uri, setUri] = useState('')
  const [accountName, setAccountName] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [generatedMnemonic, setGeneratedMnemonic] = useState('')
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [cryptoType, setCryptoType] = useState<CryptoType>('sr25519')
  const [ethereumAddresses, setEthereumAddresses] = useState<Record<string, string | null>>({})

  const handleGenerateMnemonic = () => {
    const newMnemonic = generateMnemonic()
    setGeneratedMnemonic(newMnemonic)
    setMnemonic(newMnemonic) // Pasar automáticamente al campo de mnemonic
    setShowMnemonic(true)
  }

  const [password, setPassword] = useState('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)

  const handleAddFromMnemonic = async () => {
    if (!mnemonic.trim()) return
    if (!isUnlocked) {
      alert('Por favor desbloquea el keyring primero')
      return
    }
    
    await addFromMnemonic(mnemonic.trim(), accountName || undefined, cryptoType, password || undefined)
    setMnemonic('')
    setAccountName('')
    setPassword('')
    setShowPasswordInput(false)
  }

  const handleAddFromUri = async () => {
    if (!uri.trim()) return
    if (!isUnlocked) {
      alert('Por favor desbloquea el keyring primero')
      return
    }
    
    const name = accountName.trim() || undefined
    await addFromUri(uri.trim(), name, cryptoType, password || undefined)
    setUri('')
    if (name) setAccountName('')
    setPassword('')
    setShowPasswordInput(false)
  }

  const handleCopyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  // Derivar direcciones Ethereum para todas las cuentas
  useMemo(() => {
    if (!keyring || accounts.length === 0) return

    const derived: Record<string, string | null> = {}
    accounts.forEach((account) => {
      try {
        const pair = keyring.getPair(account.address)
        // Intentar derivar desde el pair (funciona si es ECDSA)
        const ethAddress = deriveEthereumAddressFromPair(pair)
        derived[account.address] = ethAddress
      } catch (error) {
        console.debug(`No se pudo derivar dirección Ethereum para ${account.address}:`, error)
        derived[account.address] = null
      }
    })
    setEthereumAddresses(derived)
  }, [accounts, keyring])

  if (!isReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Inicializando keyring...</p>
        </CardContent>
      </Card>
    )
  }

  // Permitir generar mnemonics incluso si no está desbloqueado
  // Pero mostrar advertencia si no está desbloqueado
  if (!isUnlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cuentas</CardTitle>
          <CardDescription>
            Genera mnemonics o desbloquea el keyring para gestionar tus cuentas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Permitir generar mnemonic incluso sin desbloquear */}
          <div className="space-y-2">
            <Button onClick={handleGenerateMnemonic} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Generar Nuevo Mnemonic
            </Button>
            {showMnemonic && generatedMnemonic && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Mnemonic generado (guárdalo de forma segura):</p>
                <p className="text-sm font-mono break-all mb-2">{generatedMnemonic}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                  ⚠️ Desbloquea el keyring primero para poder crear una cuenta con este mnemonic
                </p>
              </div>
            )}
          </div>
          
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Para crear cuentas:</strong> Desbloquea el keyring usando el componente "Desbloquear Keyring" arriba.
              Si no tienes cuentas almacenadas, puedes desbloquear con cualquier contraseña (se creará una nueva sesión).
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cuentas (Keyring)</CardTitle>
          <CardDescription>
            Crea y gestiona cuentas usando @polkadot/keyring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selector de Tipo de Criptografía */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Criptografía</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={cryptoType === 'sr25519' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCryptoType('sr25519')}
                className="flex-1"
              >
                sr25519
              </Button>
              <Button
                type="button"
                variant={cryptoType === 'ed25519' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCryptoType('ed25519')}
                className="flex-1"
              >
                ed25519
              </Button>
              <Button
                type="button"
                variant={cryptoType === 'ecdsa' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCryptoType('ecdsa')}
                className="flex-1"
              >
                ecdsa
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {cryptoType === 'sr25519' && 'Schnorrkel - Recomendado para Substrate'}
              {cryptoType === 'ed25519' && 'Edwards - Alternativa común'}
              {cryptoType === 'ecdsa' && 'ECDSA - Compatible con Ethereum (Moonbeam, etc.)'}
            </p>
          </div>

          {/* Generar Mnemonic */}
          <div className="space-y-2">
            <Button onClick={handleGenerateMnemonic} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Generar Nuevo Mnemonic
            </Button>
            {showMnemonic && generatedMnemonic && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Mnemonic generado (guárdalo de forma segura):</p>
                <p className="text-sm font-mono break-all mb-2">{generatedMnemonic}</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setMnemonic(generatedMnemonic)
                    setShowMnemonic(false)
                  }}
                  variant="outline"
                >
                  Usar este mnemonic
                </Button>
                <Button
                  size="sm"
                  className="ml-2"
                  onClick={async () => {
                    if (!isUnlocked) {
                      alert('Por favor desbloquea el keyring primero')
                      return
                    }
                    setMnemonic(generatedMnemonic)
                    setShowMnemonic(false)
                    // Crear la cuenta automáticamente
                    await addFromMnemonic(generatedMnemonic, accountName.trim() || undefined, cryptoType, password || undefined)
                    setMnemonic('')
                    setAccountName('')
                    setGeneratedMnemonic('')
                    setShowMnemonic(false)
                    setPassword('')
                  }}
                  disabled={!isUnlocked}
                >
                  Usar y crear cuenta
                </Button>
              </div>
            )}
          </div>

          {/* Agregar desde Mnemonic */}
          <div className="space-y-2">
            <Input
              placeholder="Mnemonic (12, 15, 18, 21 o 24 palabras)"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              disabled={!isUnlocked}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Nombre de la cuenta (opcional)"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="flex-1"
                disabled={!isUnlocked}
              />
              <Button onClick={handleAddFromMnemonic} disabled={!mnemonic.trim() || !isUnlocked}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            </div>
            {isUnlocked && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Contraseña para encriptar (opcional, se guardará encriptada)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si proporcionas una contraseña, la cuenta se guardará encriptada en IndexedDB
                </p>
              </div>
            )}
          </div>

          {/* Agregar desde URI (Substrate URI) */}
          <div className="space-y-2">
            <Input
              placeholder="Substrate URI (ej: //Alice, //Bob, o mnemonic con derivación)"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              disabled={!isUnlocked}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Nombre de la cuenta (opcional)"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="flex-1"
                disabled={!isUnlocked}
              />
              <Button onClick={handleAddFromUri} disabled={!uri.trim() || !isUnlocked} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Agregar desde URI
              </Button>
            </div>
            {isUnlocked && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Contraseña para encriptar (opcional, se guardará encriptada)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si proporcionas una contraseña, la cuenta se guardará encriptada en IndexedDB
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Cuentas */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cuentas ({accounts.length})</CardTitle>
            <CardDescription>
              Cuentas agregadas al keyring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accounts.map((account: KeyringAccount) => (
                <div
                  key={account.address}
                  className="p-4 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Identicon
                        value={account.address}
                        size={24}
                        theme="polkadot"
                      />
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium truncate">
                        {account.meta.name || 'Sin nombre'}
                      </p>
                    </div>
                    <p className="text-sm font-mono break-all text-muted-foreground">
                      {account.address}
                    </p>
                    {ethereumAddresses[account.address] && (
                      <div className="mt-1">
                        <p className="text-xs text-muted-foreground mb-1">Dirección Ethereum:</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono break-all text-blue-600 dark:text-blue-400">
                            {ethereumAddresses[account.address]}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              if (ethereumAddresses[account.address]) {
                                handleCopyAddress(ethereumAddresses[account.address]!)
                                setCopiedAddress(`eth-${account.address}`)
                                setTimeout(() => setCopiedAddress(null), 2000)
                              }
                            }}
                          >
                            {copiedAddress === `eth-${account.address}` ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              if (ethereumAddresses[account.address]) {
                                window.open(`https://etherscan.io/address/${ethereumAddresses[account.address]}`, '_blank')
                              }
                            }}
                            title="Ver en Etherscan"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {keyring?.getPair(account.address).type || 'sr25519'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {account.publicKey.length * 8} bits
                      </Badge>
                      {ethereumAddresses[account.address] && (
                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          Ethereum
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyAddress(account.address)}
                    >
                      {copiedAddress === account.address ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeAccount(account.address)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

