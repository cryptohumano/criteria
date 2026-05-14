import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { ThemeToggle } from '@/components/ThemeToggle'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { getGoogleOAuthStartUrl, resendVerificationEmail } from '@/services/workspace/workspaceAuthApi'
import {
  fetchInvitePreview,
  acceptOrgInviteWithSession,
  type InvitePreview,
} from '@/services/workspace/orgInviteApi'
import { refreshSessionFromServer } from '@/services/workspace/refreshSessionFromServer'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const inviteToken = (searchParams.get('invite') || '').trim()
  const { session, signIn, signOut, applySession, isHydrated } = useWorkspaceSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null)
  const [inviteErr, setInviteErr] = useState<string | null>(null)
  const [inviteResolved, setInviteResolved] = useState(() => !inviteToken)
  const [joining, setJoining] = useState(false)
  const [joinErr, setJoinErr] = useState('')

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/'

  useEffect(() => {
    if (!inviteToken) return
    let cancel = false
    ;(async () => {
      try {
        const p = await fetchInvitePreview(inviteToken)
        if (!cancel) setInvitePreview(p)
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
      navigate(from, { replace: true })
    }
  }, [isHydrated, session, inviteToken, navigate, from])

  const handleJoinWithCurrentSession = async () => {
    if (!inviteToken) return
    setJoinErr('')
    setJoining(true)
    try {
      await acceptOrgInviteWithSession(inviteToken)
      const next = await refreshSessionFromServer()
      if (next) applySession(next)
      navigate(from, { replace: true })
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
      setResendMsg('')
      await signIn(email.trim(), password, inviteToken ? { inviteToken } : undefined)
      navigate(from, { replace: true })
    } catch (err) {
      setResendMsg('')
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
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
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border shadow-sm">
            <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>
              {inviteToken ? (
                <>
                  Tienes un enlace de invitación: al entrar (correo/contraseña o Google) te unirás a la organización del
                  enlace si la invitación sigue siendo válida.
                </>
              ) : (
                <>
                  Accede al espacio de trabajo de tu organización. La firma criptográfica de documentos se configura
                  después en esta misma app.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {session && inviteToken ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Ya has iniciado sesión. Puedes unirte a la organización de la invitación con la cuenta actual, o
                  cerrar sesión para entrar con otro correo.
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
              </div>
            ) : (
            <>
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
                    Continuar con Google
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-2">o con correo y contraseña</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mb-4 rounded-md border border-dashed px-3 py-2">
                  Google OAuth requiere API y variables en el servidor (ver <code className="text-[10px]">.env.example</code>).
                </p>
              )
            })()}
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {error.includes('Verifica tu correo') ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={loading || !email.trim()}
                    onClick={async () => {
                      setResendMsg('')
                      setError('')
                      try {
                        await resendVerificationEmail(email.trim())
                        setResendMsg('Si el correo está pendiente de verificación, te hemos enviado un nuevo enlace.')
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'No se pudo reenviar')
                      }
                    }}
                  >
                    Reenviar enlace de verificación
                  </Button>
                  {resendMsg ? <p className="text-xs text-muted-foreground">{resendMsg}</p> : null}
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ¿Nueva organización?{' '}
                <Link
                  to={inviteToken ? `/register?invite=${encodeURIComponent(inviteToken)}` : '/register'}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Crear cuenta
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
