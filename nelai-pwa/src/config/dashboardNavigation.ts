import type { LucideIcon } from 'lucide-react'
import {
  Wallet,
  Send,
  QrCode,
  History,
  Network,
  Users,
  Home,
  FileText,
  ShieldCheck,
  Building2,
  Settings,
} from 'lucide-react'
import { isSaaSWorkspaceMode } from '@/config/appMode'

/** Sub-rutas Polkadot / Substrate agrupadas bajo «Wallet». */
export const WALLET_NAV: Array<{
  name: string
  href: string
  description: string
  icon: LucideIcon
}> = [
  { name: 'Cuentas', href: '/accounts', description: 'Gestionar cuentas y firmas', icon: Wallet },
  { name: 'Enviar', href: '/send', description: 'Transferir tokens', icon: Send },
  { name: 'Recibir', href: '/receive', description: 'Dirección y QR', icon: QrCode },
  { name: 'Transacciones', href: '/transactions', description: 'Historial en cadena', icon: History },
  { name: 'Redes', href: '/networks', description: 'RPC y cadenas', icon: Network },
  { name: 'Contactos', href: '/contacts', description: 'Libreta de direcciones', icon: Users },
]

const WALLET_PREFIXES = ['/accounts', '/send', '/receive', '/transactions', '/networks', '/contacts']

export function isWalletNavActive(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/'
  return WALLET_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))
}

/** Rutas principales fuera de Wallet (orden visual). */
export function getPrimaryNavItems(): Array<{
  name: string
  href: string
  icon: LucideIcon
  match: (pathname: string) => boolean
}> {
  const items: Array<{
    name: string
    href: string
    icon: LucideIcon
    match: (pathname: string) => boolean
  }> = [
    {
      name: isSaaSWorkspaceMode() ? 'Inicio' : 'Home',
      href: '/',
      icon: Home,
      match: (p: string) => p === '/' || p === '',
    },
    {
      name: 'Documentos',
      href: '/documents',
      icon: FileText,
      match: (p: string) => p.startsWith('/documents'),
    },
    {
      name: 'Verificar',
      href: '/verify',
      icon: ShieldCheck,
      match: (p: string) => p.startsWith('/verify'),
    },
  ]
  if (isSaaSWorkspaceMode()) {
    items.push({
      name: 'Organización',
      href: '/organization',
      icon: Building2,
      match: (p: string) => p.startsWith('/organization'),
    })
  }
  return items
}

export function getSettingsNavItem() {
  return {
    name: 'Configuración',
    href: '/settings',
    icon: Settings,
    match: (p: string) => p.startsWith('/settings'),
  }
}
