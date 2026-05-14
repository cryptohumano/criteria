import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspaceSession } from '@/contexts/useWorkspaceSession'
import { fetchWorkspaceSessionWithAccessToken } from '@/services/workspace/workspaceAuthApi'
import { isSaaSWorkspaceMode } from '@/config/appMode'

/**
 * Google redirige aquí con `#access_token=...` (fragmento no enviado al servidor).
 */
export default function AuthGoogleCallback() {
  const navigate = useNavigate()
  const { applySession } = useWorkspaceSession()
  const [message, setMessage] = useState('Completando inicio de sesión…')

  useEffect(() => {
    if (!isSaaSWorkspaceMode()) {
      navigate('/', { replace: true })
      return
    }

    const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(raw)
    const err = params.get('error')
    const errDesc = params.get('error_description')
    const token = params.get('access_token')

    if (err) {
      setMessage(errDesc || err || 'Error de autenticación')
      return
    }

    if (!token) {
      setMessage('No se recibió token. Vuelve a intentar desde Iniciar sesión.')
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <p className="text-sm text-muted-foreground text-center max-w-md">{message}</p>
    </div>
  )
}
