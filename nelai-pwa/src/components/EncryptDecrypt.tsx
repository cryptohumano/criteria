import { useState, useMemo } from 'react'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Lock, Unlock, Copy, Check } from 'lucide-react'
import { naclEncrypt, naclDecrypt, randomAsU8a } from '@polkadot/util-crypto'
import { stringToU8a, u8aToString, u8aToHex, hexToU8a } from '@polkadot/util'
import Identicon from '@polkadot/react-identicon'

type CryptoType = 'sr25519' | 'ed25519' | 'ecdsa' | 'all'

/**
 * Componente para encriptar y desencriptar mensajes usando NaCl
 * Basado en: https://polkadot.js.org/docs/util-crypto/examples/encrypt-decrypt
 */
export function EncryptDecrypt() {
  const { accounts, isUnlocked, keyring } = useKeyringContext()
  const [selectedAddress, setSelectedAddress] = useState('')
  const [message, setMessage] = useState('')
  const [cryptoTypeFilter, setCryptoTypeFilter] = useState<CryptoType>('all')
  const [encryptedData, setEncryptedData] = useState<{
    encrypted: Uint8Array
    nonce: Uint8Array
  } | null>(null)
  const [decryptedMessage, setDecryptedMessage] = useState<string | null>(null)
  const [secretKey, setSecretKey] = useState<string>('')
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [copiedItem, setCopiedItem] = useState<string | null>(null)

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

  const handleEncrypt = () => {
    if (!message.trim() || !selectedAddress) {
      alert('Por favor selecciona una cuenta e ingresa un mensaje')
      return
    }

    try {
      const account = accounts.find((acc) => acc.address === selectedAddress)
      if (!account) {
        alert('Cuenta no encontrada')
        return
      }

      // Generar una clave secreta aleatoria
      const secret = randomAsU8a()
      const secretHex = u8aToHex(secret)
      setSecretKey(secretHex)

      // Convertir el mensaje a Uint8Array
      const messageBytes = stringToU8a(message)

      // Encriptar el mensaje usando NaCl
      const { encrypted, nonce } = naclEncrypt(messageBytes, secret)

      setEncryptedData({ encrypted, nonce })
      setDecryptedMessage(null)
    } catch (error: any) {
      alert(`Error al encriptar: ${error.message}`)
    }
  }

  const handleDecrypt = () => {
    if (!encryptedData || !secretKey.trim()) {
      alert('Por favor encripta un mensaje primero y proporciona la clave secreta')
      return
    }

    try {
      // Convertir la clave secreta de hex a Uint8Array
      let secret: Uint8Array
      if (secretKey.startsWith('0x')) {
        secret = hexToU8a(secretKey)
      } else {
        // Intentar como hex sin prefijo
        secret = hexToU8a(`0x${secretKey}`)
      }
      
      // Asegurarse de que tenga 32 bytes (tamaño requerido por NaCl)
      if (secret.length !== 32) {
        // Si no es exactamente 32 bytes, crear un array de 32 bytes
        const secret32 = new Uint8Array(32)
        secret32.set(secret.slice(0, Math.min(32, secret.length)))
        secret = secret32
      }

      // Desencriptar el mensaje
      const decrypted = naclDecrypt(encryptedData.encrypted, encryptedData.nonce, secret)

      if (decrypted) {
        const decryptedString = u8aToString(decrypted)
        setDecryptedMessage(decryptedString)
      } else {
        alert('Error al desencriptar. Verifica que la clave secreta sea correcta.')
      }
    } catch (error: any) {
      alert(`Error al desencriptar: ${error.message}`)
    }
  }

  const handleCopy = async (text: string, item: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedItem(item)
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const generateNewSecret = () => {
    const secret = randomAsU8a()
    setSecretKey(u8aToHex(secret))
  }

  if (!isUnlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Encriptar/Desencriptar Mensajes
          </CardTitle>
          <CardDescription>
            Desbloquea el keyring para usar funciones de encriptación
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
          <Lock className="h-5 w-5" />
          Encriptar/Desencriptar Mensajes (NaCl)
        </CardTitle>
        <CardDescription>
          Encripta y desencripta mensajes usando{' '}
          <a
            href="https://polkadot.js.org/docs/util-crypto/examples/encrypt-decrypt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            NaCl de @polkadot/util-crypto
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Selección de cuenta */}
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Seleccionar Cuenta ({filteredAccounts.length} disponible{filteredAccounts.length !== 1 ? 's' : ''})
          </p>
          <select
            value={selectedAddress}
            onChange={(e) => setSelectedAddress(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
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
                  {account.meta.name || 'Sin nombre'} ({accountType}) - {account.address.substring(0, 16)}...
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

        {/* Encriptar */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Encriptar Mensaje</p>
          <Input
            placeholder="Mensaje a encriptar"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button onClick={handleEncrypt} disabled={!message.trim() || !selectedAddress}>
            <Lock className="h-4 w-4 mr-2" />
            Encriptar
          </Button>

          {encryptedData && (
            <div className="p-3 border rounded-lg bg-muted/50 space-y-2">
              <div>
                <p className="text-xs font-medium mb-1">Mensaje Encriptado (hex):</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono break-all flex-1">
                    {u8aToHex(encryptedData.encrypted)}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(u8aToHex(encryptedData.encrypted), 'encrypted')}
                  >
                    {copiedItem === 'encrypted' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Nonce (hex):</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-mono break-all flex-1">
                    {u8aToHex(encryptedData.nonce)}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(u8aToHex(encryptedData.nonce), 'nonce')}
                  >
                    {copiedItem === 'nonce' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {secretKey && (
            <div className="p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                  ⚠️ Clave Secreta (guárdala de forma segura):
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                  >
                    {showSecretKey ? 'Ocultar' : 'Mostrar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={generateNewSecret}
                  >
                    Generar Nueva
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type={showSecretKey ? 'text' : 'password'}
                  value={secretKey}
                  readOnly
                  className="text-xs font-mono"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(secretKey, 'secret')}
                >
                  {copiedItem === 'secret' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Esta clave secreta es necesaria para desencriptar el mensaje. Compártela de forma segura con el destinatario.
              </p>
            </div>
          )}
        </div>

        {/* Desencriptar */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Desencriptar Mensaje</p>
          <Input
            placeholder="Mensaje encriptado (hex)"
            value={encryptedData ? u8aToHex(encryptedData.encrypted) : ''}
            onChange={(e) => {
              // Permitir editar manualmente si no hay datos encriptados
              if (!encryptedData) {
                // Aquí podrías parsear el hex y actualizar encryptedData
                // Por simplicidad, solo permitimos desencriptar lo que se encriptó
              }
            }}
            disabled={!encryptedData}
          />
          <Input
            placeholder="Clave secreta (hex)"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
          <Button onClick={handleDecrypt} disabled={!encryptedData || !secretKey.trim()}>
            <Unlock className="h-4 w-4 mr-2" />
            Desencriptar
          </Button>

          {decryptedMessage && (
            <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-xs font-medium mb-1 text-green-800 dark:text-green-200">
                Mensaje Desencriptado:
              </p>
              <p className="text-sm font-mono break-all">{decryptedMessage}</p>
              <div className="mt-2">
                <Badge variant="outline" className="text-green-700 dark:text-green-300">
                  ✓ Desencriptado exitosamente
                </Badge>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

