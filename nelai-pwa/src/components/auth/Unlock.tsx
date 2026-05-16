import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Lock, Fingerprint, Eye, EyeOff } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type UnlockVariant = 'page' | 'dialog'

export interface UnlockProps {
  /** `page`: pantalla completa (AuthGuard). `dialog`: modal compacto (banner “Desbloquear”). */
  variant?: UnlockVariant
}

export function Unlock({ variant = 'page' }: UnlockProps) {
  const { unlock, unlockWithWebAuthn, hasWebAuthnCredentials, vaultCipherSummary, hasStoredAccounts } =
    useKeyringContext()
  const isDialog = variant === 'dialog'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const vaultIsWebAuthnOnly = hasStoredAccounts && vaultCipherSummary === 'webauthn'
  const defaultTab = vaultIsWebAuthnOnly && hasWebAuthnCredentials ? 'webauthn' : 'password'

  const handleUnlock = async () => {
    setError('')
    if (!password) {
      setError('Por favor ingresa tu contraseña')
      return
    }

    setLoading(true)
    try {
      const success = await unlock(password)
      if (!success) {
        setError('Contraseña incorrecta. Por favor intenta de nuevo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desbloquear')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlockWithWebAuthn = async () => {
    setError('')
    setLoading(true)
    try {
      const credentials = await import('@/utils/webauthnStorage').then((m) => m.getAllWebAuthnCredentials())
      if (credentials.length === 0) {
        setError('No hay credenciales WebAuthn configuradas')
        setLoading(false)
        return
      }

      const success = await unlockWithWebAuthn(credentials[0].id)
      if (!success) {
        setError(
          'Error al autenticar con WebAuthn. Las cuentas pueden estar encriptadas con contraseña. Por favor, intenta desbloquear con contraseña en su lugar.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desbloquear con WebAuthn')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={cn(
        'flex w-full max-w-full overflow-x-hidden',
        isDialog
          ? 'min-h-0 flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-6'
          : 'min-h-[100dvh] flex-col bg-gradient-to-br from-primary/10 via-background to-accent/10 lg:flex-row lg:items-stretch',
      )}
    >
      {/* Marca */}
      <aside
        className={cn(
          'flex min-w-0 flex-col justify-center',
          !isDialog && 'shrink-0',
          isDialog
            ? 'w-full overflow-x-hidden border-b border-border pb-4 sm:w-[min(240px,34%)] sm:max-w-[280px] sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5'
            : 'w-full border-b border-border bg-background/60 px-5 py-5 sm:px-8 sm:py-6 lg:max-w-[480px] lg:basis-[40%] lg:border-b-0 lg:border-r lg:bg-gradient-to-br lg:from-primary/[0.07] lg:via-background lg:to-accent/[0.06] lg:px-8 lg:py-10 xl:px-10',
        )}
      >
        <div
          className={cn(
            'mx-auto flex w-full min-w-0 flex-col gap-3 sm:gap-4',
            isDialog ? 'max-w-none sm:mx-0' : 'max-w-md lg:mx-0 lg:max-w-none lg:gap-6',
          )}
        >
          <div
            className={cn(
              'flex min-w-0 w-full flex-row gap-3 sm:gap-4',
              isDialog ? 'items-start' : 'items-center',
              !isDialog && 'lg:flex-col lg:items-start lg:gap-5',
            )}
          >
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg ring-2 ring-primary/25',
                isDialog ? 'h-12 w-12' : 'h-14 w-14 sm:h-16 sm:w-16 lg:h-20 lg:w-20',
              )}
            >
              <img
                src={`${import.meta.env.BASE_URL || '/'}web-app-manifest-192x192.png`}
                alt="CriterIA"
                className={cn(
                  'rounded-xl',
                  isDialog ? 'h-9 w-9' : 'h-11 w-11 sm:h-12 sm:w-12 lg:h-16 lg:w-16',
                )}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.innerHTML = '<div class="text-white text-xl font-bold">C</div>'
                  }
                }}
              />
            </div>
            <div
              className={cn(
                'min-w-0 flex-1 text-left lg:flex-none',
                /* basis-0: en fila flex, el texto puede medir su ancho mínimo y desbordar; forzamos reparto correcto */
                isDialog && 'basis-0',
              )}
            >
              <h1
                className={cn(
                  'font-bold tracking-tight text-primary',
                  isDialog ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl',
                )}
              >
                CriterIA
              </h1>
              <p className="mt-0.5 max-w-full whitespace-normal break-words text-xs leading-snug text-muted-foreground sm:text-sm">
                {isDialog ? (
                  <>
                    Procedencia y autenticidad
                    <br />
                    verificables
                  </>
                ) : (
                  'Procedencia y autenticidad verificables'
                )}
              </p>
            </div>
          </div>

          <div className={cn(isDialog ? 'block' : 'hidden lg:block')}>
            <div
              className={cn(
                'flex min-w-0 items-start gap-2 rounded-xl border border-primary/15 bg-muted/30 p-3 sm:gap-3',
                !isDialog && 'max-w-sm bg-background/50 p-4',
              )}
            >
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:h-5 sm:w-5" aria-hidden />
              <p
                className={cn(
                  'min-w-0 max-w-full break-words text-muted-foreground',
                  isDialog ? 'text-xs leading-snug sm:text-sm' : 'text-sm leading-relaxed',
                )}
              >
                Tu almacén cifrado está en este dispositivo. Desbloquéalo para firmar documentos y usar tus cuentas
                Substrate.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Formulario */}
      <main
        className={cn(
          'flex min-w-0 flex-1 flex-col justify-center',
          isDialog ? 'px-0 py-0 sm:min-w-0' : 'w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10',
        )}
      >
        <Card
          className={cn(
            'mx-auto w-full min-w-0 max-w-md lg:max-w-lg',
            isDialog
              ? 'border-0 bg-transparent shadow-none'
              : 'border-2 border-primary/20 shadow-xl',
          )}
        >
          <CardHeader className={cn('space-y-2 text-left', isDialog ? '!p-0' : 'pb-2 pt-6')}>
            {!isDialog && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Lock className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xl font-semibold leading-tight">Desbloquear llave local</CardTitle>
                </div>
              </div>
            )}
            <CardDescription>
              {vaultIsWebAuthnOnly
                ? 'Este almacén está protegido con tu dispositivo (WebAuthn). Usa huella, rostro o PIN; la contraseña no aplica para este vault.'
                : `Introduce tu contraseña para acceder${hasWebAuthnCredentials ? ' o usa WebAuthn.' : '.'}`}
            </CardDescription>
            <Alert className="border-primary/20 bg-muted/40 py-2">
              <AlertDescription className="break-words text-xs leading-snug sm:text-sm">
                <span className="font-medium text-foreground">Copia de seguridad:</span> si importaste un respaldo
                cifrado con contraseña, usa la misma contraseña del almacén local. Los vault solo con WebAuthn no
                usan este campo.
              </AlertDescription>
            </Alert>
          </CardHeader>
          <CardContent className={cn(isDialog ? '!p-0 pt-1' : 'pb-6')}>
            <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
              <TabsList
                className={cn(
                  '!grid h-auto min-h-9 w-full gap-1 p-1',
                  hasWebAuthnCredentials ? 'grid-cols-2' : 'grid-cols-1',
                )}
              >
                <TabsTrigger value="password" className="w-full">
                  Contraseña
                </TabsTrigger>
                {hasWebAuthnCredentials && (
                  <TabsTrigger value="webauthn" className="w-full">
                    WebAuthn
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="password" className="mt-4 space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleUnlock()
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleUnlock()
                          }
                        }}
                        placeholder="Contraseña del almacén local"
                        className="pr-10"
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription className="break-words">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={loading || !password}>
                    {loading ? 'Desbloqueando…' : 'Desbloquear'}
                  </Button>
                </form>
              </TabsContent>

              {hasWebAuthnCredentials && (
                <TabsContent value="webauthn" className="mt-4 space-y-4">
                  <div className="flex min-w-0 flex-col items-center gap-3 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-5 sm:flex-row sm:items-start sm:text-left">
                    <Fingerprint className="h-10 w-10 shrink-0 text-primary sm:h-11 sm:w-11" aria-hidden />
                    <p className="min-w-0 flex-1 text-center text-sm text-muted-foreground sm:text-left">
                      Usa huella, Face ID o una llave de seguridad compatible con WebAuthn.
                    </p>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription className="break-words">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button onClick={handleUnlockWithWebAuthn} className="w-full" disabled={loading}>
                    {loading ? 'Autenticando…' : 'Desbloquear con WebAuthn'}
                  </Button>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
