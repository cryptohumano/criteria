import { DEFAULT_CHAINS, type ChainInfo } from '@/hooks/useDedotClient'
import { encodeAddress, decodeAddress } from '@polkadot/util-crypto'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

interface NetworkSwitcherProps {
  selectedChain: ChainInfo | null
  onSelectChain: (chain: ChainInfo) => void
  isConnecting: boolean
  /** Dirección SS58 de la cuenta activa; se muestra formateada para la red seleccionada */
  activeAccountAddress?: string | null
}

function formatAddressForChain(address: string, ss58Prefix: number): string {
  try {
    const pub = decodeAddress(address, false, -1)
    return encodeAddress(pub, ss58Prefix)
  } catch {
    return address
  }
}

export function NetworkSwitcher({ selectedChain, onSelectChain, isConnecting, activeAccountAddress }: NetworkSwitcherProps) {
  const prefix = selectedChain?.ss58Prefix ?? 42
  const derivedAddress = activeAccountAddress && selectedChain
    ? formatAddressForChain(activeAccountAddress, prefix)
    : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : selectedChain ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        )}
        <Select
          value={selectedChain?.endpoint || ''}
          onValueChange={(endpoint) => {
            const chain = DEFAULT_CHAINS.find(c => c.endpoint === endpoint)
            if (chain) {
              onSelectChain(chain)
            }
          }}
          disabled={isConnecting}
        >
          <SelectTrigger className="w-full min-w-0 max-w-full">
            <SelectValue placeholder="Seleccionar red">
              {selectedChain ? selectedChain.name : 'Seleccionar red'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_CHAINS.map((chain) => (
              <SelectItem key={chain.endpoint} value={chain.endpoint}>
                <div className="flex items-center justify-between w-full">
                  <span>{chain.name}</span>
                  {selectedChain?.endpoint === chain.endpoint && (
                    <Badge variant="secondary" className="ml-2">Activa</Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {derivedAddress && (
        <code className="text-xs text-muted-foreground break-all font-mono">
          {derivedAddress}
        </code>
      )}
    </div>
  )
}

