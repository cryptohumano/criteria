/**
 * Metadatos del chrome superior (título de ruta) para rutas bajo MainLayout.
 * Debe mantenerse alineado con `router/index.tsx`.
 */
export function normalizeLayoutPath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/'
}

/** Título corto para la barra superior en escritorio. */
export function getLayoutRouteTitle(pathname: string): string {
  const p = normalizeLayoutPath(pathname)

  // Alineado con `WorkspaceHome`: el nav sigue pudiendo decir «Inicio»; el chrome describe la vista.
  if (p === '/' || p === '') return 'Espacio de trabajo'

  if (p === '/organization' || p.startsWith('/organization/')) return 'Organización'

  if (p === '/documents') return 'Documentos'
  if (p === '/documents/new') return 'Nuevo documento'
  if (p === '/documents/new-etherpad' || p === '/documents/new-local') return 'Editor'
  if (/\/documents\/[^/]+\/edit(-quill)?$/.test(p)) return 'Editor'
  if (/^\/documents\/[^/]+$/.test(p)) return 'Detalle del documento'

  if (p === '/verify' || p.startsWith('/verify/')) return 'Verificar procedencia'

  if (p === '/accounts') return 'Cuentas'
  if (p === '/accounts/create') return 'Crear cuenta'
  if (p === '/accounts/import') return 'Importar cuenta'
  if (p.startsWith('/accounts/')) return 'Cuenta'

  if (p === '/send') return 'Enviar'
  if (p === '/receive') return 'Recibir'
  if (p === '/transactions') return 'Transacciones'
  if (p.startsWith('/transactions/')) return 'Transacción'
  if (p === '/networks') return 'Redes'
  if (p === '/contacts') return 'Contactos'

  if (p === '/emergencies') return 'Emergencias'
  if (p === '/settings') return 'Configuración'
  if (p === '/identity') return 'Identidad'

  return 'CriterIA'
}
