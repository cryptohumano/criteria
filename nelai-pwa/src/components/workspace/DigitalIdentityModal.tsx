import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import Identicon from '@polkadot/react-identicon'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { WorkspaceSession } from '@/types/workspace'
import type { KeyringAccount } from '@/hooks/useKeyring'
import { useNetwork } from '@/contexts/NetworkContext'

function orgRoleLabel(role: string): string {
  const r = role.trim().toLowerCase()
  if (r === 'owner') return 'Propietario'
  if (r === 'admin') return 'Administrador'
  if (r === 'member') return 'Miembro'
  return role
}

function orgKindLabel(kind: string): string {
  const k = kind.trim().toLowerCase()
  if (k === 'personal') return 'Personal'
  if (k === 'team') return 'Equipo'
  return kind
}

export type DigitalIdentityModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: WorkspaceSession
  /** Dirección SS58 de la cuenta activa en el dispositivo, si existe. */
  substrateAddress: string | null
  activeAccountData: KeyringAccount | null
}

export function DigitalIdentityModal({
  open,
  onOpenChange,
  session,
  substrateAddress,
  activeAccountData,
}: DigitalIdentityModalProps) {
  const { selectedChain } = useNetwork()
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    if (!substrateAddress) return
    try {
      await navigator.clipboard.writeText(substrateAddress)
      setCopied(true)
      toast.success('Dirección copiada')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Identidad digital</DialogTitle>
          <DialogDescription>
            Datos de tu sesión en la plataforma y la cuenta Substrate activa en este dispositivo. Los DID
            verificables no están disponibles todavía.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <section className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cuenta plataforma</p>
            <div className="space-y-1">
              <p className="font-medium text-foreground">{session.user.displayName}</p>
              <p className="text-muted-foreground">{session.user.email}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary">{orgRoleLabel(session.user.orgRole)}</Badge>
                {session.user.platformRole === 'superadmin' ? (
                  <Badge variant="outline">Plataforma</Badge>
                ) : null}
              </div>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organización</p>
            <p className="font-medium text-foreground">{session.organization.name}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{session.organization.plan}</Badge>
              <Badge variant="outline">{orgKindLabel(session.organization.kind)}</Badge>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Substrate (este dispositivo)</p>
            {substrateAddress ? (
              <>
                <div className="flex items-start gap-3">
                  <Identicon value={substrateAddress} size={40} theme="polkadot" />
                  <div className="min-w-0 flex-1 space-y-1">
                    {activeAccountData?.meta?.name ? (
                      <p className="font-medium text-foreground">{String(activeAccountData.meta.name)}</p>
                    ) : null}
                    <Label className="text-xs text-muted-foreground">Dirección SS58</Label>
                    <p className="break-all font-mono text-xs leading-relaxed text-foreground">{substrateAddress}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={copyAddress}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar dirección
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">
                No hay cuenta Substrate activa. Crea o importa una cuenta en{' '}
                <span className="font-medium text-foreground">Wallet → Cuentas</span> y desbloquea la billetera si
                aplica.
              </p>
            )}
            {selectedChain ? (
              <p className="text-xs text-muted-foreground">
                Red seleccionada: <span className="font-medium text-foreground">{selectedChain.name}</span>
              </p>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
