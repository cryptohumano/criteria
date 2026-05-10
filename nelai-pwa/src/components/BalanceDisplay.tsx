/**
 * Componente: Display de Balance
 * Muestra el balance de la cuenta activa de forma compacta para el header
 */

import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { useCurrentChainBalance } from '@/hooks/useMultiChainBalances'
import { useNetwork } from '@/contexts/NetworkContext'
import { formatBalanceForDisplay } from '@/utils/balance'
import { Wallet, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BalanceDisplayProps {
  className?: string
  showIcon?: boolean
}

export function BalanceDisplay({ className, showIcon = true }: BalanceDisplayProps) {
  const { activeAccount } = useActiveAccount()
  const { selectedChain } = useNetwork()
  const { balance, isLoading } = useCurrentChainBalance(activeAccount)

  if (!activeAccount || !selectedChain) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && <Wallet className="h-4 w-4 text-muted-foreground" />}
      <div className="flex flex-col items-end">
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : balance ? (
          <span className="text-sm font-semibold">
            {formatBalanceForDisplay(balance.total, selectedChain.name)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </div>
    </div>
  )
}
