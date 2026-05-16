import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Unlock } from '@/components/auth/Unlock'
import { Fingerprint, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { isWebAuthnAvailable } from '@/utils/webauthn'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'

type QuickIdentityProps = {
  /** Mientras sea true, el modal no se cierra con Escape ni clic fuera. */
  open: boolean
}

/**
 * Primera identidad criptográfica en el dispositivo o desbloqueo del vault antes de editar.
 * Preferimos WebAuthn (sin frase visible); si no hay soporte, se usa contraseña local sin mostrar mnemónico.
 */
export function QuickIdentitySetupDialog({ open }: QuickIdentityProps) {
  const {
    isReady,
    accounts,
    hasStoredAccounts,
    isUnlocked,
    generateMnemonic,
    addFromMnemonic,
    createIdentityWithWebAuthn,
  } = useKeyringContext()

  const { session } = useWorkspaceSession()

  const [consentInfo, setConsentInfo] = useState(false)
  const [displayName, setDisplayName] = useState('Mi identidad')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const webAuthnUsable = typeof window !== 'undefined' && isWebAuthnAvailable()

  useEffect(() => {
    if (!open) {
      setConsentInfo(false)
      setDisplayName('Mi identidad')
      setPassword('')
      setConfirmPassword('')
      setError('')
      setLoading(false)
    }
  }, [open])

  const needsUnlock = hasStoredAccounts && !isUnlocked && accounts.length === 0
  const needsCreate = !hasStoredAccounts && accounts.length === 0

  const handleWebAuthnCreate = async () => {
    setError('')
    if (!consentInfo) {
      setError('Marca la casilla de información para continuar.')
      return
    }
    setLoading(true)
    try {
      const u = session?.user
      const acc = await createIdentityWithWebAuthn({
        userName: u?.email || u?.displayName,
        displayName: u?.displayName || u?.email,
        accountLabel: displayName.trim() || undefined,
      })
      if (acc) {
        toast.success('Listo', {
          description:
            'Tu llave local quedó protegida con este dispositivo. Puedes ver la frase de recuperación en Configuración → Seguridad.',
        })
      } else {
        setError('No se pudo crear la identidad. Comprueba que WebAuthn esté permitido o intenta de nuevo.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear la identidad')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordCreate = async () => {
    setError('')
    if (!consentInfo) {
      setError('Marca la casilla de información para continuar.')
      return
    }
    if (!password || password.length < 8) {
      setError('Elige una contraseña de al menos 8 caracteres para cifrar la llave en este dispositivo.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      const mnemonic = generateMnemonic()
      const name = displayName.trim() || 'Mi identidad'
      const acc = await addFromMnemonic(mnemonic, name, 'sr25519', password)
      if (acc) {
        toast.success('Identidad lista', {
          description:
            'La frase de recuperación no se mostró aquí; consúltala en Configuración → Seguridad cuando la necesites.',
        })
      } else {
        setError('No se pudo crear la cuenta. Intenta de nuevo.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear la identidad')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !isReady) return null

  return (
    <Dialog open={open}>
      <DialogContent
        hideClose
        className="max-h-[min(90vh,720px)] gap-0 overflow-y-auto p-0 sm:max-w-lg"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="border-b bg-muted/40 px-4 py-3 sm:px-6">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Shield className="h-5 w-5 shrink-0 text-primary" />
              Llave en este dispositivo
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed sm:text-sm">
              Una llave local (Substrate) separa tus documentos por titular y permite firmas verificables. criterIA no
              guarda tu frase ni la contraseña del almacén en sus servidores: solo en este navegador, cifrado.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-6">
          {needsUnlock ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ya tienes un almacén de llaves en este equipo. Desbloquéalo para continuar con el documento.
              </p>
              <Unlock variant="dialog" />
            </>
          ) : needsCreate ? (
            <>
              <Alert>
                <AlertTitle className="text-sm">Un solo paso</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed">
                  {webAuthnUsable
                    ? 'Usa la huella, el rostro o el PIN del sistema para proteger la llave. No hace falta inventar otra contraseña para el almacén.'
                    : 'Este navegador no ofrece WebAuthn fiable; define una contraseña local solo para cifrar la llave en este dispositivo.'}
                </AlertDescription>
              </Alert>

              <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <Checkbox
                  id="qi-consent-info"
                  checked={consentInfo}
                  onCheckedChange={(v) => setConsentInfo(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="qi-consent-info" className="cursor-pointer text-xs font-normal leading-relaxed">
                  Entiendo que la recuperación en otro equipo requiere la frase de respaldo o un export desde
                  Configuración. He revisado la{' '}
                  <Link to="/legal/privacidad" className="font-medium text-primary underline-offset-2 hover:underline">
                    información de privacidad
                  </Link>{' '}
                  y los{' '}
                  <Link to="/legal/terminos" className="font-medium text-primary underline-offset-2 hover:underline">
                    términos
                  </Link>
                  .
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qi-name">Nombre para esta llave (opcional)</Label>
                <Input
                  id="qi-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {webAuthnUsable ? (
                <div className="space-y-3">
                  <div className="flex min-w-0 flex-col items-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-4 sm:flex-row sm:items-start sm:text-left">
                    <Fingerprint className="h-10 w-10 shrink-0 text-primary sm:h-11 sm:w-11" aria-hidden />
                    <p className="min-w-0 flex-1 text-center text-xs text-muted-foreground sm:text-left sm:text-sm">
                      Se registrará una credencial en este dispositivo y se creará la llave de forma automática. La
                      frase de recuperación podrás verla en Configuración → Seguridad, con verificación biométrica.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="qi-pw">Contraseña del almacén en este dispositivo</Label>
                  <Input
                    id="qi-pw"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <Label htmlFor="qi-pw2">Confirmar contraseña</Label>
                  <Input
                    id="qi-pw2"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              )}

              {error ? (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Preparando cuentas…</p>
          )}
        </div>

        {needsCreate ? (
          <DialogFooter className="border-t bg-muted/20 px-4 py-3 sm:px-6">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={loading}
              onClick={webAuthnUsable ? handleWebAuthnCreate : handlePasswordCreate}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando…
                </>
              ) : webAuthnUsable ? (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Activar con este dispositivo
                </>
              ) : (
                'Crear identidad y continuar'
              )}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
