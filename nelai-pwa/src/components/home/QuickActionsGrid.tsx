/**
 * Accesos rápidos desde el inicio (documentos, wallet Substrate, emergencias).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Wallet, Send, ShieldCheck, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function QuickActionsGrid() {
  const actions = [
    {
      title: 'Documentos',
      description: 'Contratos, borradores y firmas',
      icon: FileText,
      href: '/documents',
      variant: 'default' as const,
      primary: true,
    },
    {
      title: 'Wallet — Cuentas',
      description: 'Gestionar cuentas Substrate',
      icon: Wallet,
      href: '/accounts',
      variant: 'outline' as const,
      primary: false,
    },
    {
      title: 'Enviar tokens',
      description: 'Transferencias en cadena',
      icon: Send,
      href: '/send',
      variant: 'outline' as const,
      primary: false,
    },
    {
      title: 'Verificar procedencia',
      description: 'Comprobar documentos y manifiestos',
      icon: ShieldCheck,
      href: '/verify',
      variant: 'outline' as const,
      primary: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-5 xl:gap-6">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Card
            key={action.href}
            className={action.primary ? 'border-primary/20 bg-primary/5' : ''}
            {...(action.href === '/documents' ? { 'data-tour-id': 'tour-home-documents-card' as const } : {})}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className={`h-5 w-5 ${action.primary ? 'text-primary' : ''}`} />
                {action.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{action.description}</p>
              <Button asChild className="w-full" variant={action.variant}>
                <Link to={action.href}>
                  Abrir
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
