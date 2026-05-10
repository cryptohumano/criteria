import { Outlet } from 'react-router-dom'
import { WorkspaceSessionProvider } from '@/contexts/WorkspaceSessionContext'
import { KeyringProvider } from '@/contexts/KeyringContext'
import { NetworkProvider } from '@/contexts/NetworkContext'
import { ActiveAccountProvider } from '@/contexts/ActiveAccountContext'
import { DocumentEditorLayoutProvider } from '@/contexts/DocumentEditorLayoutContext'
import { Toaster } from '@/components/ui/sonner'

/**
 * Proveedores que deben envolver todas las rutas del data router.
 * Así cualquier pantalla (incl. layouts) usa el mismo React context que el Outlet.
 */
export function AppProviders() {
  return (
    <WorkspaceSessionProvider>
      <KeyringProvider>
        <ActiveAccountProvider>
          <NetworkProvider>
            <DocumentEditorLayoutProvider>
              <Outlet />
              <Toaster />
            </DocumentEditorLayoutProvider>
          </NetworkProvider>
        </ActiveAccountProvider>
      </KeyringProvider>
    </WorkspaceSessionProvider>
  )
}
