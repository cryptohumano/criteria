/**
 * Componente: Card de Balance Compacto
 * Muestra balance de forma compacta y secundaria
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wallet, ArrowRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBalanceForDisplay } from '@/utils/balance'
import { useNetwork } from '@/contexts/NetworkContext'

interface CompactBalanceCardProps {
  balance: bigint
  isLoading?: boolean
}

export function CompactBalanceCard({ balance, isLoading }: CompactBalanceCardProps) {
  const { selectedChain } = useNetwork()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Cargando...</span>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">
              {selectedChain 
                ? formatBalanceForDisplay(balance, selectedChain.name)
                : '0.00'}
            </div>
            {selectedChain && (
              <p className="text-xs text-muted-foreground">
                En {selectedChain.name}
              </p>
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/transactions">
                Ver Transacciones
                <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
