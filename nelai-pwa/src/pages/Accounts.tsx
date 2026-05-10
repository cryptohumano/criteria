import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Download, Copy, Check, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useState } from 'react'
import Identicon from '@polkadot/react-identicon'
import { Avatar } from '@/components/ui/avatar'
import { Unlock as UnlockScreen } from '@/components/auth/Unlock'

export default function Accounts() {
  const { accounts, isUnlocked, storedAccountsStatus } = useKeyringContext()
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const handleCopyAddress = async (address: string) => {
    await navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 10)}...${address.slice(-10)}`
  }

  // Si hay cuentas guardadas (o no pudimos determinarlo) y el keyring está bloqueado,
  // esta pantalla debe pedir desbloqueo, no sugerir "crear cuenta".
  if (!isUnlocked && storedAccountsStatus !== 'none') {
    return <UnlockScreen />
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cuentas</h1>
          <p className="text-muted-foreground mt-2">
            Gestiona tus cuentas del keyring
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/accounts/import">
              <Download className="mr-2 h-4 w-4" />
              Importar
            </Link>
          </Button>
          <Button asChild>
            <Link to="/accounts/create">
              <Plus className="mr-2 h-4 w-4" />
              Crear Cuenta
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tus Cuentas</CardTitle>
          <CardDescription>
            {accounts.length > 0 
              ? `${accounts.length} cuenta${accounts.length > 1 ? 's' : ''} configurada${accounts.length > 1 ? 's' : ''}`
              : 'Lista de todas tus cuentas configuradas'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">No hay cuentas configuradas aún</p>
              <Button asChild>
                <Link to="/accounts/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Primera Cuenta
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.address}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <Identicon
                        value={account.address}
                        size={40}
                        theme="polkadot"
                      />
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">
                          {account.meta.name || 'Sin nombre'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground font-mono">
                          {formatAddress(account.address)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleCopyAddress(account.address)}
                          title="Copiar dirección"
                        >
                          {copiedAddress === account.address ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      {account.meta.tags && account.meta.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {account.meta.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 bg-muted rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/accounts/${account.address}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver Detalles
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

