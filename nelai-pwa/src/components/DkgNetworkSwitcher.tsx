import { useState, useEffect } from 'react'
import { DEFAULT_DKG_NETWORKS } from '@/config/dkgNetworks'
import { getDkgConfig, setDkgConfig } from '@/services/criteria/dkgPublish'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Database } from 'lucide-react'

export function DkgNetworkSwitcher() {
  const [networkId, setNetworkId] = useState<string>('neuroweb-testnet')
  const { activeAccount } = useActiveAccount()
  const { getDerivedEthereumAddress } = useKeyringContext()
  const derivedEvmAddress = activeAccount ? getDerivedEthereumAddress(activeAccount) : null

  useEffect(() => {
    const config = getDkgConfig()
    if (config?.networkId) {
      setNetworkId(config.networkId)
    }
  }, [])

  const handleChange = (id: string) => {
    setNetworkId(id)
    setDkgConfig({
      networkId: id,
      useDerivedKey: true,
    })
  }

  const selectedNet = DEFAULT_DKG_NETWORKS.find((n) => n.id === networkId)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground" />
        <Select value={networkId} onValueChange={handleChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Seleccionar red DKG">
              {selectedNet ? selectedNet.name : 'Seleccionar red DKG'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_DKG_NETWORKS.map((net) => (
              <SelectItem key={net.id} value={net.id}>
                {net.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {derivedEvmAddress && (
        <code className="text-xs text-muted-foreground break-all font-mono">
          {derivedEvmAddress}
        </code>
      )}
    </div>
  )
}
