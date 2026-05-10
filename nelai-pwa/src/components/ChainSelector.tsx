import { DEFAULT_CHAINS, type ChainInfo } from '@/hooks/useDedotClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ChainSelectorProps {
  selectedChain: ChainInfo | null
  onSelectChain: (chain: ChainInfo) => void
  isConnecting: boolean
}

export function ChainSelector({ selectedChain, onSelectChain, isConnecting }: ChainSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seleccionar Red</CardTitle>
        <CardDescription>
          Elige una red de Polkadot para explorar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEFAULT_CHAINS.map((chain) => (
            <Button
              key={chain.endpoint}
              variant={selectedChain?.endpoint === chain.endpoint ? "default" : "outline"}
              onClick={() => onSelectChain(chain)}
              disabled={isConnecting}
              className="h-auto py-4 flex flex-col items-start"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold">{chain.name}</span>
                {selectedChain?.endpoint === chain.endpoint && (
                  <Badge variant="secondary">Conectado</Badge>
                )}
              </div>
              {chain.description && (
                <span className="text-xs text-muted-foreground mt-1 text-left">
                  {chain.description}
                </span>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

