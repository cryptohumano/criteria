import { useCallback, useEffect, useState } from 'react'
import { Key, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { describeApiFetchError, hasWorkspaceApiBase } from '@/config/saasConfig'
import {
  deletePlatformGeminiKeyFromDb,
  fetchPlatformLlmCredentials,
  putPlatformGeminiKey,
  type PlatformLlmCredentialsStatus,
} from '@/services/workspace/platformAdminApi'

/**
 * Clave de **plataforma** (Gemini) que usa el servidor para dotar de IA; distinta del BYOK en Ajustes del usuario.
 */
export function PlatformLlmCredentialsCard() {
  const [data, setData] = useState<PlatformLlmCredentialsStatus | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!hasWorkspaceApiBase()) {
      setLoading(false)
      return
    }
    setErr(null)
    try {
      const d = await fetchPlatformLlmCredentials()
      setData(d)
    } catch (e) {
      setErr(describeApiFetchError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    const k = keyInput.trim()
    if (!k) return
    setSaving(true)
    setErr(null)
    try {
      await putPlatformGeminiKey(k)
      setKeyInput('')
      await load()
    } catch (e) {
      setErr(describeApiFetchError(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Quitar la clave Gemini almacenada en la base de datos? Si sigue existiendo GEMINI_API_KEY en el servidor, se usará esa.')) {
      return
    }
    setDeleting(true)
    setErr(null)
    try {
      await deletePlatformGeminiKeyFromDb()
      await load()
    } catch (e) {
      setErr(describeApiFetchError(e))
    } finally {
      setDeleting(false)
    }
  }

  if (!hasWorkspaceApiBase()) {
    return null
  }

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Claves de proveedor (IA de plataforma)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando…</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return err ? (
      <Alert variant="destructive">
        <AlertDescription>{err}</AlertDescription>
      </Alert>
    ) : null
  }

  const { gemini, databaseEncryptionReady } = data
  const sourceLabel =
    gemini.activeSource === 'database'
      ? 'Base de datos (cifrado)'
      : gemini.activeSource === 'environment'
        ? 'Variable de entorno GEMINI_API_KEY'
        : 'Ninguna — configura clave en BD o en el proceso'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Key className="h-4 w-4" />
          Claves de proveedor (IA de plataforma)
        </CardTitle>
        <CardDescription>
          <strong className="text-foreground">No</strong> es lo mismo que «trae tu clave» en Ajustes: el BYOK va en
          el dispositivo. Aquí guardas la clave de **proveedor** que usa el backend para quienes trabajan con el perfil
          automático «CriterIA (plataforma)» (sin API key en el móvil o PC). Requiere{' '}
          <code className="text-xs">CRITERIA_PLATFORM_LLM_SECRET</code>{' '}
          (o legacy <code className="text-xs">NELAI_PLATFORM_LLM_SECRET</code>) y migración de BD; sin eso, sigue valiendo
          solo <code className="text-xs">GEMINI_API_KEY</code> en el entorno.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}

        <div className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Uso activo: </span>
            <span className="font-medium">{sourceLabel}</span>
            {gemini.last4 ? (
              <span className="text-muted-foreground"> · termina en {gemini.last4}</span>
            ) : null}
          </p>
          {gemini.hasEnvFallback && gemini.activeSource === 'database' ? (
            <p className="text-xs text-muted-foreground">
              También existe <code className="text-xs">GEMINI_API_KEY</code> en el proceso; la fila de BD tiene
              prioridad. Si la borras, se usará la variable mientras esté definida.
            </p>
          ) : null}
        </div>

        {!databaseEncryptionReady ? (
          <Alert>
            <AlertDescription>
              Para guardar claves en PostgreSQL, define en el proceso del API{' '}
              <code className="text-xs">CRITERIA_PLATFORM_LLM_SECRET</code>{' '}
              (o legacy <code className="text-xs">NELAI_PLATFORM_LLM_SECRET</code>; mín. 16 caracteres, al azar) y vuelve a
              levantar el servidor. Mientras tanto puedes seguir usando solo{' '}
              <code className="text-xs">GEMINI_API_KEY</code> en el entorno.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2 max-w-lg">
            <Label htmlFor="platform-gemini-key">Nueva clave de API de Google AI (Gemini)</Label>
            <Input
              id="platform-gemini-key"
              type="password"
              autoComplete="off"
              placeholder="Pega la clave y guarda; no se vuelve a mostrar"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saving || !keyInput.trim()} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar en base de datos
              </Button>
              {gemini.activeSource === 'database' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Quitar de la base de datos
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
