import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { Copy, Eye, Fingerprint, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Permite ver la frase de recuperación (o URI) descifrando el almacén local.
 * Vault WebAuthn: pide verificación biométrica. Vault por contraseña: pide la contraseña del almacén.
 */
export function RecoveryPhraseRevealSection() {
  const { hasStoredAccounts, vaultCipherSummary, exportMnemonicForAccount } = useKeyringContext()
  const { activeAccount } = useActiveAccount()

  const [vaultPassword, setVaultPassword] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [revealKind, setRevealKind] = useState<'mnemonic' | 'uri' | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const webauthnVault = vaultCipherSummary === 'webauthn'

  const handleReveal = async () => {
    if (!activeAccount) {
      setError('No hay cuenta activa seleccionada.')
      return
    }
    setError('')
    setInfo(null)
    setLoading(true)
    setRevealed(null)
    setRevealKind(null)
    try {
      const res = await exportMnemonicForAccount(
        activeAccount,
        webauthnVault ? undefined : vaultPassword.trim() || undefined,
      )
      if (res.kind === 'mnemonic' && res.secret) {
        setRevealed(res.secret)
        setRevealKind('mnemonic')
        toast.message('Frase mostrada', { description: 'No la compartas ni la guardes en sitios inseguros.' })
      } else if (res.kind === 'uri' && res.secret) {
        setRevealed(res.secret)
        setRevealKind('uri')
        toast.message('URI / semilla mostrada', { description: 'Trátala como material sensible.' })
      } else {
        setInfo(res.reason || 'No hay frase disponible para esta cuenta.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descifrar')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!revealed) return
    try {
      await navigator.clipboard.writeText(revealed)
      toast.success('Copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  if (!hasStoredAccounts) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Eye className="h-5 w-5 text-primary" />
          Frase de recuperación
        </CardTitle>
        <CardDescription>
          {webauthnVault
            ? 'Verificación con huella, rostro o PIN del dispositivo. La frase no sale de tu equipo.'
            : 'Necesitas la contraseña del almacén local (no es la de la plataforma).'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!activeAccount ? (
          <Alert>
            <AlertDescription>Selecciona una cuenta activa en la app para revelar su respaldo.</AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="text-xs text-muted-foreground break-all">
              Cuenta activa: <span className="font-mono">{activeAccount}</span>
            </p>

            {!webauthnVault && (
              <div className="space-y-2">
                <Label htmlFor="vault-pw-reveal">Contraseña del almacén local</Label>
                <Input
                  id="vault-pw-reveal"
                  type="password"
                  value={vaultPassword}
                  onChange={(e) => setVaultPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            )}

            {webauthnVault && (
              <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span>Al continuar se usará WebAuthn (Windows Hello, Touch ID, etc.).</span>
              </div>
            )}

            <Button type="button" onClick={handleReveal} disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando…
                </>
              ) : webauthnVault ? (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Mostrar frase con este dispositivo
                </>
              ) : (
                'Mostrar frase'
              )}
            </Button>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {info ? (
              <Alert>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            ) : null}

            {revealed ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">
                    {revealKind === 'uri' ? 'URI / semilla (sensible)' : 'Frase de recuperación'}
                  </Label>
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleCopy}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copiar
                  </Button>
                </div>
                <div className="rounded-md border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed break-words">
                  {revealed}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
