import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { ThemeToggle } from '@/components/ThemeToggle'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { getGoogleOAuthStartUrl, resendVerificationEmail } from '@/services/workspace/workspaceAuthApi'
import { fetchInvitePreview, acceptOrgInviteWithSession, type InvitePreview } from '@/services/workspace/orgInviteApi'
import { refreshSessionFromServer } from '@/services/workspace/refreshSessionFromServer'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = (searchParams.get('invite') || '').trim()
  const { session, signUp, signOut, applySession, isHydrated } = useWorkspaceSession()
  const [accountKind, setAccountKind] = useState<'personal' | 'team'>('personal')
  const [organizationName, setOrganizationName] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)
  const [inviteErr, setInviteErr] = useState<string | null>(null)
  const [inviteResolved, setInviteResolved] = useState(() => !inviteToken)
  const [joining, setJoining] = useState(false)
  const [joinErr, setJoinErr] = useState('')

  useEffect(() => {
    if (!inviteToken) return
    let cancel = false
    ;(async () => {
      try {
        const p = await fetchInvitePreview(inviteToken)
        if (!cancel) {
          setInvitePreview(p)
          setAccountKind('team')
        }
      } catch (e) {
        if (!cancel) setInviteErr(e instanceof Error ? e.message : 'Invitación no válida')
      } finally {
        if (!cancel) setInviteResolved(true)
      }
    })()
    return () => {
      cancel = true
    }
  }, [inviteToken])

  useEffect(() => {
    if (!isSaaSWorkspaceMode()) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    if (isHydrated && session && !inviteToken) {
      navigate('/', { replace: true })
    }
  }, [isHydrated, session, inviteToken, navigate])

  const handleJoinWithCurrentSession = async () => {
    if (!inviteToken) return
    setJoinErr('')
    setJoining(true)
    try {
      await acceptOrgInviteWithSession(inviteToken)
      const next = await refreshSessionFromServer()
      if (next) applySession(next)
      navigate('/', { replace: true })
    } catch (e) {
      setJoinErr(e instanceof Error ? e.message : 'No se pudo aceptar la invitación')
    } finally {
      setJoining(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!inviteToken && accountKind === 'team' && !organizationName.trim()) {
        setError('Indica el nombre de la organización o equipo (B2B).')
        setLoading(false)
        return
      }
      const result = await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        accountKind: inviteToken ? 'team' : accountKind,
        organizationName: inviteToken ? undefined : accountKind === 'team' ? organizationName.trim() : undefined,
        inviteToken: inviteToken || undefined,
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
            <CardTitle>{inviteToken ? 'Unirse al equipo' : 'Crear cuenta'}</CardTitle>
            <CardDescription>
              {inviteToken ? (
                <>
                  Si aún no tienes cuenta, crea una aquí; si ya usas CriterIA con este correo, inicia sesión con la
                  misma contraseña o con Google (el enlace sirve en ambos casos).
                </>
              ) : (
                <>
                  Cuenta personal (B2C) o equipo / empresa (B2B). Mismo modelo de datos: la cuenta personal vive en
                  una organización de tipo <span className="whitespace-nowrap">«personal»</span>.
                </>
              )}
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
                  <Link
                    to={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login'}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Ir a iniciar sesión
                  </Link>
                </p>
              </div>
            ) : null}
            {!pendingEmail && session && inviteToken ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ya tienes sesión en la plataforma. Usa el botón inferior para pasar a la organización de la
                  invitación, o cierra sesión si esta invitación era para otro correo.
                </p>
                {inviteErr ? (
                  <p className="text-sm text-destructive" role="alert">
                    {inviteErr}
                  </p>
                ) : !inviteResolved ? (
                  <p className="text-sm text-muted-foreground">Validando invitación…</p>
                ) : invitePreview ? (
                  <>
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
                      <p className="font-medium text-foreground">{invitePreview.organizationName}</p>
                      <p className="text-muted-foreground">
                        Rol asignado: <span className="text-foreground">{invitePreview.role}</span> · caduca el{' '}
                        {new Date(invitePreview.expiresAt).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sesión actual: <strong className="text-foreground">{session.user.email}</strong>
                    </p>
                    {joinErr ? <p className="text-sm text-destructive">{joinErr}</p> : null}
                    <Button
                      type="button"
                      className="w-full"
                      disabled={joining}
                      onClick={() => void handleJoinWithCurrentSession()}
                    >
                      {joining ? 'Uniendo…' : `Unirme a ${invitePreview.organizationName}`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={joining}
                      onClick={() => signOut()}
                    >
                      Cerrar sesión y usar otro correo
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Invitación no disponible.</p>
                )}
                <nav
                  className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-center text-xs text-muted-foreground"
                  aria-label="Información legal y producto"
                >
                  <Link to="/producto" className="text-primary underline-offset-4 hover:underline">
                    Qué es CriterIA
                  </Link>
                  <span aria-hidden>·</span>
                  <Link to="/legal/terminos" className="underline-offset-4 hover:underline">
                    Términos
                  </Link>
                  <span aria-hidden>·</span>
                  <Link to="/legal/privacidad" className="underline-offset-4 hover:underline">
                    Privacidad
                  </Link>
                </nav>
              </div>
            ) : !pendingEmail ? (
            <>
            {inviteErr ? (
              <p className="text-sm text-destructive mb-3" role="alert">
                {inviteErr}
              </p>
            ) : null}
            {invitePreview ? (
              <div className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
                <p className="font-medium text-foreground">{invitePreview.organizationName}</p>
                <p className="text-muted-foreground">
                  Rol asignado: <span className="text-foreground">{invitePreview.role}</span> · caduca el{' '}
                  {new Date(invitePreview.expiresAt).toLocaleString('es-ES')}
                </p>
              </div>
            ) : null}
            {(() => {
              const googleUrl = getGoogleOAuthStartUrl(inviteToken || undefined)
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
                  disabled={Boolean(inviteToken)}
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
                  {inviteToken && invitePreview ? (
                    <Input id="org" value={invitePreview.organizationName} readOnly className="bg-muted/50" />
                  ) : (
                    <Input
                      id="org"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="Ej. Estudio Jurídico (demo)"
                      required={accountKind === 'team'}
                      autoComplete="organization"
                    />
                  )}
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
              <Button
                type="submit"
                className="w-full"
                disabled={loading || (Boolean(inviteToken) && (!inviteResolved || !invitePreview))}
              >
                {loading ? 'Creando…' : 'Crear y entrar'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <Link
                  to={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login'}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Iniciar sesión
                </Link>
              </p>
            </form>
            <nav
              className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-center text-xs text-muted-foreground"
              aria-label="Información legal y producto"
            >
              <Link to="/producto" className="text-primary underline-offset-4 hover:underline">
                Qué es CriterIA
              </Link>
              <span aria-hidden>·</span>
              <Link to="/legal/terminos" className="underline-offset-4 hover:underline">
                Términos
              </Link>
              <span aria-hidden>·</span>
              <Link to="/legal/privacidad" className="underline-offset-4 hover:underline">
                Privacidad
              </Link>
            </nav>
            </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
