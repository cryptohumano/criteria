import { useState } from 'react'
import { useDedotClient, type ChainInfo } from '@/hooks/useDedotClient'
import { ChainSelector } from '@/components/ChainSelector'
import { ChainInfo as ChainInfoDisplay } from '@/components/ChainInfo'
import { BlockExplorer } from '@/components/BlockExplorer'
import { AccountInfo } from '@/components/AccountInfo'
import { KeyringManager } from '@/components/KeyringManager'
import { KeyringUnlock } from '@/components/KeyringUnlock'
import { WebAuthnManager } from '@/components/WebAuthnManager'
import { SignVerify } from '@/components/SignVerify'
import { EncryptDecrypt } from '@/components/EncryptDecrypt'
import { EthereumDerivation } from '@/components/EthereumDerivation'
import { Transactions } from '@/components/Transactions'
import { SS58Format } from '@/components/SS58Format'
import { StorageQueries } from '@/components/StorageQueries'
import { PalletsExplorer } from '@/components/PalletsExplorer'
import { RuntimeApisExplorer } from '@/components/RuntimeApisExplorer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Wifi, WifiOff } from 'lucide-react'

function App() {
  const [selectedChain, setSelectedChain] = useState<ChainInfo | null>(null)
  const { client, isConnecting, error } = useDedotClient(selectedChain?.endpoint || null)

  return (
    <div className="min-h-screen bg-background">
        <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">CriterIA</h1>
              <p className="text-muted-foreground mt-1">
                Explora las capacidades de Dedot y Polkadot SDK
              </p>
            </div>
            <div className="flex items-center gap-2">
              {client ? (
                <Badge variant="default" className="gap-2">
                  <Wifi className="h-3 w-3" />
                  Conectado
                </Badge>
              ) : isConnecting ? (
                <Badge variant="secondary">Conectando...</Badge>
              ) : (
                <Badge variant="outline" className="gap-2">
                  <WifiOff className="h-3 w-3" />
                  Desconectado
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Sección 1: Estado de la Cadena */}
          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">Estado de la Cadena</h2>
              <p className="text-muted-foreground">
                Selecciona una red y explora información de la cadena
              </p>
            </div>
            
            <ChainSelector
              selectedChain={selectedChain}
              onSelectChain={setSelectedChain}
              isConnecting={isConnecting}
            />

            {error && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Error de Conexión</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{error}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setSelectedChain(null)}
                  >
                    Desconectar
                  </Button>
                </CardContent>
              </Card>
            )}

            {client && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChainInfoDisplay client={client} />
                <BlockExplorer client={client} />
              </div>
            )}

            {client && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <AccountInfo client={client} />
                <Card>
                  <CardHeader>
                    <CardTitle>Explorar Pallets</CardTitle>
                    <CardDescription>
                      Consulta todas las pallets disponibles en esta cadena
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PalletsExplorer client={client} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Runtime APIs</CardTitle>
                    <CardDescription>
                      Explora y ejecuta Runtime APIs disponibles
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RuntimeApisExplorer client={client} />
                  </CardContent>
                </Card>
              </div>
            )}

            {client && (
              <StorageQueries client={client} />
            )}
          </section>

          {/* Sección 2: Funciones Criptográficas */}
          <section className="space-y-4 border-t pt-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">Funciones Criptográficas</h2>
              <p className="text-muted-foreground">
                Gestión de cuentas, firmas, verificación y encriptación de mensajes
              </p>
            </div>

            <KeyringUnlock />
            <WebAuthnManager />
            <KeyringManager />
            {client && <Transactions client={client} />}
            <SignVerify />
            <EncryptDecrypt />
            <EthereumDerivation />
            <SS58Format />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Características de Dedot</CardTitle>
              <CardDescription>
                Funcionalidades disponibles en esta aplicación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Conexión a Redes</h3>
                  <p className="text-sm text-muted-foreground">
                    Conecta a múltiples redes de Polkadot simultáneamente usando WebSocket providers
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Información de Cadena</h3>
                  <p className="text-sm text-muted-foreground">
                    Obtén metadata, versión de runtime, propiedades y más información de la cadena
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Exploración de Bloques</h3>
                  <p className="text-sm text-muted-foreground">
                    Consulta bloques específicos, extrinsics y headers de la cadena
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Información de Cuentas</h3>
                  <p className="text-sm text-muted-foreground">
                    Consulta balances, nonces y datos de cuentas en la cadena
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">TypeScript Tipado</h3>
                  <p className="text-sm text-muted-foreground">
                    APIs completamente tipadas con autocompletado y validación en tiempo de desarrollo
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">PWA Ready</h3>
                  <p className="text-sm text-muted-foreground">
                    Aplicación web progresiva que funciona offline y se puede instalar
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-6">
          <p className="text-sm text-muted-foreground text-center">
            Construido con Dedot, Vite 7, shadcn/ui y Tailwind CSS 4
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App

