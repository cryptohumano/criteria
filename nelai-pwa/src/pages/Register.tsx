import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useWorkspaceSession } from '@/contexts/WorkspaceSessionContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { getGoogleOAuthStartUrl, resendVerificationEmail } from '@/services/workspace/workspaceAuthApi'

export default function Register() {
  const navigate = useNavigate()
  const { session, signUp, isHydrated } = useWorkspaceSession()
  const [accountKind, setAccountKind] = useState<'personal' | 'team'>('personal')
  const [organizationName, setOrganizationName] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!isSaaSWorkspaceMode()) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    if (isHydrated && session) {
      navigate('/', { replace: true })
    }
  }, [isHydrated, session, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (accountKind === 'team' && !organizationName.trim()) {
        setError('Indica el nombre de la organización o equipo (B2B).')
        setLoading(false)
        return
      }
      const result = await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        accountKind,
        organizationName: accountKind === 'team' ? organizationName.trim() : undefined,
      })
      if ('pendingVerification' in result && result.pendingVerification) {
        setPendingEmail(result.email)
        return
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center p-4 pb-12">
        <Card className="w-full max-w-md border shadow-sm">
          <CardHeader>
            <CardTitle>Crear cuenta</CardTitle>
            <CardDescription>
              Cuenta personal (B2C) o equipo / empresa (B2B). Mismo modelo de datos: la cuenta personal
              vive en una organización de tipo <span className="whitespace-nowrap">«personal»</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingEmail ? (
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground leading-relaxed">
                  Hemos enviado un enlace de verificación a <strong className="text-foreground">{pendingEmail}</strong>.
                  Ábrelo en las próximas 24 h para activar la cuenta. Revisa también la carpeta de spam.
                </p>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    setError('')
                    try {
                      await resendVerificationEmail(pendingEmail)
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'No se pudo reenviar')
                    }
                  }}
                >
                  Reenviar correo
                </Button>
                <p className="text-center text-muted-foreground">
                  <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                    Ir a iniciar sesión
                  </Link>
                </p>
              </div>
            ) : null}
            {!pendingEmail ? (
            <>
            {(() => {
              const googleUrl = getGoogleOAuthStartUrl()
              return googleUrl ? (
                <div className="mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={() => {
                      window.location.href = googleUrl
                    }}
                  >
                    Registrarse con Google
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-2">o registro con correo</p>
                </div>
              ) : null
            })()}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label className="text-foreground">Tipo de cuenta</Label>
                <RadioGroup
                  value={accountKind}
                  onValueChange={(v) => setAccountKind(v as 'personal' | 'team')}
                  className="grid gap-2"
                >
                  <label className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="personal" id="acct-personal" />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium leading-none">Personal (B2C)</span>
                      <span className="text-xs text-muted-foreground">Un solo titular, sin nombre de empresa obligatorio</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="team" id="acct-team" />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium leading-none">Equipo o empresa (B2B)</span>
                      <span className="text-xs text-muted-foreground">Requiere nombre de organización</span>
                    </div>
                  </label>
                </RadioGroup>
              </div>
              {accountKind === 'team' ? (
                <div className="space-y-2">
                  <Label htmlFor="org">Nombre de la organización</Label>
                  <Input
                    id="org"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Ej. Estudio Jurídico (demo)"
                    required={accountKind === 'team'}
                    autoComplete="organization"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="name">Tu nombre (opcional)</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creando…' : 'Crear y entrar'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                  Iniciar sesión
                </Link>
              </p>
            </form>
            </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
