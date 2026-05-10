/**
 * Componente para cambiar la cuenta activa en la sesión
 */

import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { useKeyringContext } from '@/contexts/KeyringContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Identicon from '@polkadot/react-identicon'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ActiveAccountSwitcherProps {
  /** Por ejemplo `w-full min-w-0` en el sidebar ancho fijo. */
  triggerClassName?: string
}

export function ActiveAccountSwitcher({ triggerClassName }: ActiveAccountSwitcherProps) {
  const { accounts } = useKeyringContext()
  const { activeAccount, switchAccount, activeAccountData } = useActiveAccount()

  if (accounts.length === 0) {
    return null
  }

  // Si solo hay una cuenta, mostrar solo el badge
  if (accounts.length === 1) {
    const account = accounts[0]
    return (
      <Badge variant="outline" className="gap-2 px-3 py-1.5">
        <Identicon
          value={account.address}
          size={16}
          theme="polkadot"
        />
        <span className="text-xs font-medium">
          {account.meta.name || 'Cuenta'}
        </span>
      </Badge>
    )
  }

  return (
    <Select
      value={activeAccount || ''}
      onValueChange={switchAccount}
    >
      <SelectTrigger
        className={cn('w-auto min-w-[140px] max-w-[200px] h-8 sm:h-9', triggerClassName)}
      >
        <SelectValue>
          {activeAccountData ? (
            <div className="flex items-center gap-2">
              <Identicon
                value={activeAccountData.address}
                size={14}
                theme="polkadot"
              />
              <span className="text-xs sm:text-sm font-medium truncate">
                {activeAccountData.meta.name || 'Sin nombre'}
              </span>
            </div>
          ) : (
            <span className="text-xs sm:text-sm">Seleccionar cuenta</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.address} value={account.address}>
            <div className="flex items-center gap-2">
              <Identicon
                value={account.address}
                size={16}
                theme="polkadot"
              />
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  {account.meta.name || 'Sin nombre'}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {account.address.substring(0, 8)}...{account.address.slice(-6)}
                </span>
              </div>
              {activeAccount === account.address && (
                <Badge variant="default" className="ml-auto text-xs">
                  Activa
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
