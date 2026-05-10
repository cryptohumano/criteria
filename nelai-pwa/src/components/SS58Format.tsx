import { useState } from 'react'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Hash } from 'lucide-react'

const SS58_FORMATS = [
  { value: 0, name: 'Polkadot', description: 'Red principal de Polkadot' },
  { value: 2, name: 'Kusama', description: 'Red canary de Polkadot' },
  { value: 42, name: 'Substrate Generic', description: 'Formato genérico de Substrate' },
  { value: 7, name: 'Acala', description: 'Parachain Acala' },
  { value: 16, name: 'Moonbeam', description: 'Parachain Moonbeam' },
]

export function SS58Format() {
  const { keyring, accounts, setSS58Format } = useKeyringContext()
  const [currentFormat, setCurrentFormat] = useState(42)

  const handleFormatChange = (format: number) => {
    setSS58Format(format)
    setCurrentFormat(format)
  }

  if (!keyring) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formato SS58</CardTitle>
        <CardDescription>
          Cambia el formato de direcciones SS58. Las direcciones se codifican diferente según la red.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SS58_FORMATS.map((format) => (
            <Button
              key={format.value}
              variant={currentFormat === format.value ? 'default' : 'outline'}
              onClick={() => handleFormatChange(format.value)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold">{format.name}</span>
                {currentFormat === format.value && (
                  <Badge variant="secondary">Activo</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground mt-1 text-left">
                {format.description} (Formato: {format.value})
              </span>
            </Button>
          ))}
        </div>

        {accounts.length > 0 && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/50">
            <p className="text-sm font-medium mb-2">Direcciones con formato actual ({currentFormat}):</p>
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.address} className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {account.meta.name || 'Sin nombre'}
                    </p>
                    <p className="text-xs font-mono break-all text-muted-foreground">
                      {account.address}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Nota:</strong> El cambio de formato SS58 solo afecta la visualización de las direcciones.
            La clave pública subyacente permanece igual. Diferentes formatos son necesarios para diferentes redes.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

