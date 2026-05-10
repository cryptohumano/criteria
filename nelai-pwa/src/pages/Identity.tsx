import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { usePeopleChainIdentity, useMultiPeopleChainIdentity } from '@/hooks/usePeopleChainIdentity'
import { useMultiChainBalances } from '@/hooks/useMultiChainBalances'
import { formatBalanceForDisplay } from '@/utils/balance'
import { Loader2, Shield, User, Globe, Mail, Twitter, Link as LinkIcon, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import Identicon from '@polkadot/react-identicon'
import { Avatar } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function Identity() {
  const { accounts } = useKeyringContext()
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [selectedNetwork, setSelectedNetwork] = useState<'polkadot' | 'kusama' | 'paseo'>('polkadot')

  const { identity, isLoading, error, hasIdentity } = usePeopleChainIdentity(
    selectedAddress || null,
    selectedNetwork
  )

  const { identities: multiIdentities, isLoading: isLoadingMulti } = useMultiPeopleChainIdentity(
    selectedAddress || null
  )

  const { balances, isLoading: isLoadingBalances, lastUpdate, error: balanceError } = useMultiChainBalances(
    selectedAddress || null
  )

  // Usar la utilidad de formateo de balances
  const formatBalance = (value: bigint, chainName: string) => {
    return formatBalanceForDisplay(value, chainName)
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Identidad y Privacidad</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona tu identidad en People Chain y visualiza tus balances en múltiples cadenas
        </p>
      </div>

      {/* Selección de cuenta */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Cuenta</CardTitle>
          <CardDescription>
            Elige una cuenta para ver su identidad y balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedAddress} onValueChange={setSelectedAddress}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una cuenta">
                {selectedAddress && accounts.find(a => a.address === selectedAddress)?.meta.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.address} value={account.address}>
                  <div className="flex items-center gap-2">
                    <Identicon value={account.address} size={20} theme="polkadot" />
                    <span>{account.meta.name || 'Sin nombre'}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatAddress(account.address)})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedAddress && (
        <>
          <Tabs defaultValue="identity" className="space-y-4">
            <TabsList>
              <TabsTrigger value="identity">Identidad</TabsTrigger>
              <TabsTrigger value="balances">Balances Multi-Cadena</TabsTrigger>
              <TabsTrigger value="privacy">Privacidad</TabsTrigger>
            </TabsList>

            {/* Identidad */}
            <TabsContent value="identity" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Identidad en People Chain</CardTitle>
                      <CardDescription>
                        Información de identidad registrada en la cadena
                      </CardDescription>
                    </div>
                    <Select value={selectedNetwork} onValueChange={(v: any) => setSelectedNetwork(v)}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="polkadot">Polkadot</SelectItem>
                        <SelectItem value="kusama">Kusama</SelectItem>
                        <SelectItem value="paseo">Paseo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Cargando identidad...</span>
                    </div>
                  ) : error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : !hasIdentity ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="mb-2">No hay identidad registrada en esta cadena</p>
                      <p className="text-sm">
                        Puedes registrar una identidad usando el pallet de identidad de People Chain
                      </p>
                    </div>
                  ) : identity ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <Avatar className="h-16 w-16">
                          <Identicon value={selectedAddress} size={64} theme="polkadot" />
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold mb-1">
                            {identity.display || 'Sin nombre'}
                          </h3>
                          <code className="text-xs text-muted-foreground font-mono">
                            {selectedAddress}
                          </code>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {identity.legal && (
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              <Label className="text-sm font-medium">Nombre Legal</Label>
                            </div>
                            <p className="text-sm">{identity.legal}</p>
                          </div>
                        )}

                        {identity.email && (
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <Label className="text-sm font-medium">Email</Label>
                            </div>
                            <p className="text-sm">{identity.email}</p>
                          </div>
                        )}

                        {identity.web && (
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <LinkIcon className="h-4 w-4 text-muted-foreground" />
                              <Label className="text-sm font-medium">Web</Label>
                            </div>
                            <a href={identity.web} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                              {identity.web}
                            </a>
                          </div>
                        )}

                        {identity.twitter && (
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Twitter className="h-4 w-4 text-muted-foreground" />
                              <Label className="text-sm font-medium">Twitter</Label>
                            </div>
                            <p className="text-sm">{identity.twitter}</p>
                          </div>
                        )}

                        {identity.riot && (
                          <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <Label className="text-sm font-medium">Riot/Matrix</Label>
                            </div>
                            <p className="text-sm">{identity.riot}</p>
                          </div>
                        )}
                      </div>

                      {identity.additional && identity.additional.length > 0 && (
                        <div className="p-4 border rounded-lg">
                          <Label className="text-sm font-medium mb-2 block">Información Adicional</Label>
                          <div className="space-y-2">
                            {identity.additional.map((item, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{item.key}:</span>
                                <span>{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {identity.judgements && identity.judgements.length > 0 && (
                        <div className="p-4 border rounded-lg">
                          <Label className="text-sm font-medium mb-2 block">Juicios</Label>
                          <div className="flex flex-wrap gap-2">
                            {identity.judgements.map((judgement, index) => (
                              <Badge key={index} variant="outline">
                                {judgement.judgement}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {identity.deposit && (
                        <Alert>
                          <AlertDescription>
                            <strong>Depósito:</strong> {formatBalance(identity.deposit, `people-${selectedNetwork}`)}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Identidades en múltiples redes */}
              {!isLoadingMulti && Object.keys(multiIdentities).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Identidades en Otras Redes</CardTitle>
                    <CardDescription>
                      Compara tu identidad en diferentes redes de People Chain
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(multiIdentities).map(([network, identity]) => (
                        <div key={network} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="capitalize">{network}</Badge>
                            {identity ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          {identity && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">{identity.display || 'Sin nombre'}</p>
                              {identity.legal && (
                                <p className="text-xs text-muted-foreground mt-1">{identity.legal}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Balances Multi-Cadena */}
            <TabsContent value="balances" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Balances Multi-Cadena</CardTitle>
                      <CardDescription>
                        Saldos de tu cuenta en todas las cadenas registradas
                      </CardDescription>
                    </div>
                    {lastUpdate && (
                      <span className="text-xs text-muted-foreground">
                        Actualizado: {new Date(lastUpdate).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingBalances ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Cargando balances...</span>
                    </div>
                  ) : balanceError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{balanceError}</AlertDescription>
                    </Alert>
                  ) : balances.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No se encontraron balances</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {balances.map((balance) => (
                        <div key={balance.chain} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">{balance.chainName}</h3>
                            <Badge variant="outline">{balance.chain}</Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Libre:</span>
                              <span className="font-medium">{formatBalance(balance.free, balance.chainName)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Reservado:</span>
                              <span>{formatBalance(balance.reserved, balance.chainName)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Congelado:</span>
                              <span>{formatBalance(balance.frozen, balance.chainName)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                              <span className="font-medium">Total:</span>
                              <span className="font-bold">{formatBalance(balance.total, balance.chainName)}</span>
                            </div>
                            {balance.nonce !== undefined && (
                              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                                <span>Nonce:</span>
                                <span>{balance.nonce}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacidad */}
            <TabsContent value="privacy" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de Privacidad</CardTitle>
                  <CardDescription>
                    Gestiona la privacidad de tu identidad y datos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Privacidad en People Chain:</strong> La información de identidad
                      que registres en People Chain es pública y verificable. Considera cuidadosamente
                      qué información compartir.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Información Pública</h3>
                      <p className="text-sm text-muted-foreground">
                        Toda la información registrada en People Chain es pública y puede ser
                        consultada por cualquiera que conozca tu dirección.
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Verificación</h3>
                      <p className="text-sm text-muted-foreground">
                        Los juicios (judgements) son emitidos por registradores verificados y
                        ayudan a establecer la confiabilidad de tu identidad.
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Depósito</h3>
                      <p className="text-sm text-muted-foreground">
                        Registrar una identidad requiere un depósito que se devuelve cuando
                        cancelas tu identidad.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!selectedAddress && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Selecciona una cuenta para ver su identidad y balances</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Importar Label
import { Label } from '@/components/ui/label'

