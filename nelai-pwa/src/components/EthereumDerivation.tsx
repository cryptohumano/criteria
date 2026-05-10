import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, ExternalLink, Key } from 'lucide-react'
import { deriveEthereumAddress, isValidEthereumAddress } from '@/utils/ethereum'

/**
 * Componente para derivar direcciones Ethereum desde seeds/mnemonics de Substrate
 */
export function EthereumDerivation() {
  const [seed, setSeed] = useState('')
  const [ethereumAddress, setEthereumAddress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleDerive = () => {
    if (!seed.trim()) {
      setError('Por favor ingresa un seed, mnemonic o URI de Substrate')
      return
    }

    try {
      setError(null)
      const address = deriveEthereumAddress(seed.trim())
      setEthereumAddress(address)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      setEthereumAddress(null)
    }
  }

  const handleCopy = async () => {
    if (ethereumAddress) {
      await navigator.clipboard.writeText(ethereumAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Derivación de Direcciones Ethereum
        </CardTitle>
        <CardDescription>
          Deriva direcciones Ethereum (0x...) desde seeds, mnemonics o URIs de Substrate
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Seed / Mnemonic / URI de Substrate
          </label>
          <Input
            placeholder="Ej: //Alice, mnemonic de 12 palabras, o seed hex"
            value={seed}
            onChange={(e) => {
              setSeed(e.target.value)
              setEthereumAddress(null)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleDerive()
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Puedes usar cualquier seed, mnemonic o URI de Substrate (ej: //Alice, //Bob, etc.)
          </p>
        </div>

        <Button onClick={handleDerive} disabled={!seed.trim()} className="w-full">
          Derivar Dirección Ethereum
        </Button>

        {error && (
          <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {ethereumAddress && (
          <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
            <div>
              <p className="text-sm font-medium mb-2">Dirección Ethereum:</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-mono break-all flex-1 text-blue-600 dark:text-blue-400">
                  {ethereumAddress}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`https://etherscan.io/address/${ethereumAddress}`, '_blank')}
                  title="Ver en Etherscan"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {isValidEthereumAddress(ethereumAddress) && (
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
                ✓ Dirección válida
              </Badge>
            )}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Nota:</strong> Esta dirección Ethereum se deriva del mismo seed/mnemonic que tu cuenta Substrate.
                Ambas cuentas comparten la misma clave privada subyacente, pero usan diferentes formatos de dirección.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

