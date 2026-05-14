import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useActiveEmergencies } from '@/hooks/useActiveEmergencies'
import { ActiveEmergenciesCard } from '@/components/home/ActiveEmergenciesCard'
import { QuickActionsGrid } from '@/components/home/QuickActionsGrid'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import WorkspaceHome from '@/pages/WorkspaceHome'

export default function Home() {
  if (isSaaSWorkspaceMode()) {
    return <WorkspaceHome />
  }
  return <WalletModeHomeDashboard />
}

function WalletModeHomeDashboard() {
  const { activeEmergencies, isLoading: isLoadingEmergencies } = useActiveEmergencies()

  return (
    <div className="space-y-6 xl:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight xl:text-3xl">Inicio</h1>
        <p className="mt-1 text-sm text-muted-foreground xl:text-base">
          Documentos y wallet Polkadot / Substrate.
        </p>
      </div>

      <QuickActionsGrid />

      {isLoadingEmergencies ? (
        <Card>
          <CardContent className="py-6 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Cargando emergencias…</span>
          </CardContent>
        </Card>
      ) : activeEmergencies.length > 0 ? (
        <ActiveEmergenciesCard emergencies={activeEmergencies} />
      ) : null}
    </div>
  )
}
