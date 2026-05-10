import { useState } from 'react'
import { DedotClient } from 'dedot'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getTypedQuery } from '@/types/dedot'
import Identicon from '@polkadot/react-identicon'

interface AccountInfoProps {
  client: DedotClient | null
}

export function AccountInfo({ client }: AccountInfoProps) {
  const [address, setAddress] = useState('')
  const [accountData, setAccountData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAccount = async () => {
    if (!client || !address) return

    setLoading(true)
    setError(null)

    try {
      // Usar client.query según la documentación de Dedot
      // https://docs.dedot.dev/client-api/storage-queries
      // Tipos: https://github.com/dedotdev/chaintypes/blob/main/packages/chaintypes/src/polkadot/query.d.ts
      const query = getTypedQuery(client)
      if (!query) {
        throw new Error('Query API no disponible')
      }
      
      const accountInfo = await query.system.account(address)
      setAccountData(accountInfo)
    } catch (err: any) {
      setError(err.message || 'Error al obtener información de la cuenta')
      setAccountData(null)
    } finally {
      setLoading(false)
    }
  }

  if (!client) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de Cuenta</CardTitle>
        <CardDescription>
          Consulta el balance y datos de una cuenta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Dirección SS58 (ej: 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <Button onClick={fetchAccount} disabled={loading || !address}>
            Consultar
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}

        {accountData && !loading && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            {address && (
              <div className="flex items-center gap-3 mb-3 pb-3 border-b">
                <Identicon
                  value={address}
                  size={48}
                  theme="polkadot"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1">Dirección</p>
                  <p className="text-xs font-mono break-all text-muted-foreground">
                    {address}
                  </p>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-1">Nonce</p>
              <Badge variant="outline">
                {accountData.nonce.toString()}
              </Badge>
            </div>
            {accountData.data && (
              <>
                <div>
                  <p className="text-sm font-medium mb-1">Balance Libre</p>
                  <p className="text-sm text-muted-foreground">
                    {accountData.data.free?.toString() || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Balance Reservado</p>
                  <p className="text-sm text-muted-foreground">
                    {accountData.data.reserved?.toString() || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Balance Total</p>
                  <p className="text-sm font-medium">
                    {accountData.data.free && accountData.data.reserved
                      ? (BigInt(accountData.data.free) + BigInt(accountData.data.reserved)).toString()
                      : 'N/A'}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

