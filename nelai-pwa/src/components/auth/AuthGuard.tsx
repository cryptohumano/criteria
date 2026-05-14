import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import Onboarding from '@/pages/Onboarding'
import { Unlock } from './Unlock'

interface AuthGuardProps {
  children: ReactNode
}

/**
 * Componente que protege las rutas y muestra onboarding o unlock según sea necesario
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isReady, isUnlocked, storedAccountsStatus } = useKeyringContext()
  const { session, isHydrated: workspaceHydrated, isSessionSynced } = useWorkspaceSession()
  const location = useLocation()

  if (isSaaSWorkspaceMode() && !workspaceHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando sesión…</p>
        </div>
      </div>
    )
  }

  if (isSaaSWorkspaceMode() && !isSessionSynced) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Sincronizando credenciales de plataforma…</p>
        </div>
      </div>
    )
  }

  if (isSaaSWorkspaceMode() && !session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Esperar a que el keyring esté listo (cripto en segundo plano; en SaaS no bloquea el acceso a la app)
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isSaaSWorkspaceMode() && session ? 'Preparando aplicación…' : 'Inicializando wallet…'}
          </p>
        </div>
      </div>
    )
  }

  /** SaaS con sesión de plataforma: el keyring local es opcional hasta firmar en cadena o documentos. */
  if (isSaaSWorkspaceMode() && session) {
    return <>{children}</>
  }

  // Si confirmamos que NO hay cuentas almacenadas, mostrar onboarding (primera vez).
  // Si hay error/unknown leyendo storage, NO forzar onboarding: mostrar Unlock (o permitir rutas de cuenta).
  if (storedAccountsStatus === 'none') {
    const currentPath = location.pathname
    
    // Permitir crear/importar la primera cuenta sin pasar por onboarding (enlaces directos o SaaS + keyring vacío)
    const isImportRoute = currentPath === '/accounts/import' || currentPath.startsWith('/accounts/import?')
    const isCreateRoute = currentPath === '/accounts/create' || currentPath.startsWith('/accounts/create?')

    if (isImportRoute || isCreateRoute) {
      return <>{children}</>
    }
    
    // Para todas las demás rutas (incluyendo /, /accounts, /settings, etc.), mostrar onboarding
    return <Onboarding />
  }

  // Si hay cuentas (o no pudimos determinarlo por error) pero no está desbloqueado, mostrar unlock.
  if (!isUnlocked) {
    return <Unlock />
  }

  // Si está desbloqueado, mostrar el contenido protegido
  return <>{children}</>
}

