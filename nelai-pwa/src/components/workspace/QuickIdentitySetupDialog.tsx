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
import { Copy, Check, Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'

type QuickIdentityProps = {
  /** Mientras sea true, el modal no se cierra con Escape ni clic fuera. */
  open: boolean
}

/**
 * Primera identidad criptográfica en el dispositivo o desbloqueo del vault antes de editar.
 * Pensado para no desviar al usuario a Cuentas antes de analizar o crear un documento.
 */
export function QuickIdentitySetupDialog({ open }: QuickIdentityProps) {
  const {
    isReady,
    accounts,
    hasStoredAccounts,
    isUnlocked,
    generateMnemonic,
    addFromMnemonic,
  } = useKeyringContext()

  const [consentInfo, setConsentInfo] = useState(false)
  const [consentPhrase, setConsentPhrase] = useState(false)
  const [mnemonic, setMnemonic] = useState('')
  const [phraseRevealed, setPhraseRevealed] = useState(false)
  const [displayName, setDisplayName] = useState('Mi identidad')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) {
      setConsentInfo(false)
      setConsentPhrase(false)
      setMnemonic('')
      setPhraseRevealed(false)
      setDisplayName('Mi identidad')
      setPassword('')
      setConfirmPassword('')
      setError('')
      setLoading(false)
      setCopied(false)
    }
  }, [open])

  const needsUnlock = hasStoredAccounts && !isUnlocked && accounts.length === 0
  const needsCreate = !hasStoredAccounts && accounts.length === 0

  const handleRevealPhrase = () => {
    setError('')
    if (!consentInfo) {
      setError('Marca la casilla de información y enlaces leídos para continuar.')
      return
    }
    const phrase = generateMnemonic()
    setMnemonic(phrase)
    setPhraseRevealed(true)
  }

  const handleCopy = async () => {
    if (!mnemonic) return
    try {
      await navigator.clipboard.writeText(mnemonic)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Frase copiada al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const handleCreate = async () => {
    setError('')
    if (!phraseRevealed || !mnemonic) {
      setError('Genera y revisa la frase de recuperación primero.')
      return
    }
    if (!consentPhrase) {
      setError('Confirma que guardaste la frase de recuperación.')
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
      const name = displayName.trim() || 'Mi identidad'
      const acc = await addFromMnemonic(mnemonic, name, 'sr25519', password)
      if (acc) {
        toast.success('Identidad lista', {
          description: 'Ya puedes trabajar con el documento. La frase solo está en tu dispositivo.',
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
              Identidad en este dispositivo
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed sm:text-sm">
              Una llave local (Substrate) vincula la autoría al guardar PDFs, separa documentos por titular y prepara
              firmas. criterIA no almacena tu frase de recuperación ni tu contraseña en sus servidores: solo en este
              navegador, cifrado.
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
                <AlertTitle className="text-sm">Por qué ahora</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed">
                  Así el asistente y el guardado respetan tu titularidad criptográfica y las políticas de datos
                  personales del editor. Tardas unos minutos; puedes cancelar cerrando la pestaña si no deseas
                  continuar.
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
                  Entiendo que la frase de recuperación es la única forma de recuperar esta identidad en otro equipo,
                  que criterIA no la guarda en la nube y que puedo gestionar exportación o borrado desde Configuración. He
                  revisado la{' '}
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

              {!phraseRevealed ? (
                <Button type="button" className="w-full" onClick={handleRevealPhrase} disabled={!consentInfo}>
                  Generar frase de recuperación
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Frase de recuperación (guárdala fuera de esta pantalla)</Label>
                      <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={handleCopy}>
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copiar
                      </Button>
                    </div>
                    <div className="rounded-md border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed break-words">
                      {mnemonic}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
                    <Checkbox
                      id="qi-consent-phrase"
                      checked={consentPhrase}
                      onCheckedChange={(v) => setConsentPhrase(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="qi-consent-phrase" className="cursor-pointer text-xs font-normal leading-relaxed">
                      Declaro haber copiado o archivado la frase en un lugar seguro. Entiendo que si la pierdo, no
                      podré recuperar la llave.
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
                  <div className="space-y-2">
                    <Label htmlFor="qi-pw">Contraseña del almacén en este dispositivo</Label>
                    <Input
                      id="qi-pw"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qi-pw2">Confirmar contraseña</Label>
                    <Input
                      id="qi-pw2"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
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

        {needsCreate && phraseRevealed ? (
          <DialogFooter className="border-t bg-muted/20 px-4 py-3 sm:px-6">
            <Button type="button" className="w-full sm:w-auto" disabled={loading} onClick={handleCreate}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando…
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
