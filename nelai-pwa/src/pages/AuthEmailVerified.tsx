import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWorkspaceSession } from '@/contexts/WorkspaceSessionContext'
import { fetchWorkspaceSessionWithAccessToken } from '@/services/workspace/workspaceAuthApi'
import { isSaaSWorkspaceMode } from '@/config/appMode'
import { Button } from '@/components/ui/button'

/**
 * Tras enlace mágico: el API redirige aquí con `#access_token=...` o `#error=...`.
 */
export default function AuthEmailVerified() {
  const navigate = useNavigate()
  const { applySession } = useWorkspaceSession()
  const [message, setMessage] = useState('Completando verificación…')

  useEffect(() => {
    if (!isSaaSWorkspaceMode()) {
      navigate('/', { replace: true })
      return
    }

    const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(raw)
    const err = params.get('error')
    const token = params.get('access_token')

    if (err) {
      setMessage(
        err === 'invalid_token'
          ? 'El enlace no es válido o ha caducado. Pide un nuevo correo desde iniciar sesión.'
          : decodeURIComponent(err.replace(/\+/g, ' '))
      )
      return
    }

    if (!token) {
      setMessage('No se recibió confirmación. Abre el enlace del último correo o pide uno nuevo.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const session = await fetchWorkspaceSessionWithAccessToken(token)
        if (cancelled) return
        applySession(session)
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        navigate('/', { replace: true })
      } catch (e) {
        if (!cancelled) {
          setMessage(e instanceof Error ? e.message : 'No se pudo validar la sesión')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applySession, navigate])

  const showLogin = message.includes('caducado') || message.includes('No se recibió') || message.includes('válido')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 gap-4">
      <p className="text-sm text-muted-foreground text-center max-w-md">{message}</p>
      {showLogin ? (
        <Button asChild variant="outline">
          <Link to="/login">Ir a iniciar sesión</Link>
        </Button>
      ) : null}
    </div>
  )
}
