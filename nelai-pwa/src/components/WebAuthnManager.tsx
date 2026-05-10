import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Fingerprint, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useKeyringContext } from '@/contexts/KeyringContext'
import {
  isWebAuthnAvailable,
  isBiometricAvailable,
  registerWebAuthnCredential,
  type WebAuthnCredential
} from '@/utils/webauthn'
import {
  getAllWebAuthnCredentials,
  saveWebAuthnCredential,
  deleteWebAuthnCredential
} from '@/utils/webauthnStorage'

export function WebAuthnManager() {
  const { refreshWebAuthnCredentials } = useKeyringContext()
  const [isAvailable, setIsAvailable] = useState(false)
  const [isBiometricSupported, setIsBiometricSupported] = useState(false)
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [credentialName, setCredentialName] = useState('')
  const [userName, setUserName] = useState('Usuario')

  useEffect(() => {
    const checkAvailability = async () => {
      const available = isWebAuthnAvailable()
      setIsAvailable(available)
      
      if (available) {
        const biometric = await isBiometricAvailable()
        setIsBiometricSupported(biometric)
        await loadCredentials()
      }
    }
    
    checkAvailability()
  }, [])

  const loadCredentials = async () => {
    try {
      const creds = await getAllWebAuthnCredentials()
      setCredentials(creds)
    } catch (err) {
      console.error('Error al cargar credenciales:', err)
    }
  }

  const handleRegister = async () => {
    if (!isAvailable) {
      setError('WebAuthn no está disponible en este navegador')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Generar un ID único para el usuario
      const userId = crypto.getRandomValues(new Uint8Array(16))
      const userIdHex = Array.from(userId)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const credential = await registerWebAuthnCredential(
        userIdHex,
        userName || 'Usuario',
        userName || 'Usuario de PWA Substrate',
        credentialName || undefined
      )

      await saveWebAuthnCredential(credential)
      await loadCredentials()
      
      // Actualizar el estado del keyring para reflejar la nueva credencial
      await refreshWebAuthnCredentials()
      
      setSuccess('Credencial WebAuthn registrada exitosamente. Usa "Desbloquear con WebAuthn" en la sección de desbloqueo para desbloquear el keyring.')
      setCredentialName('')
    } catch (err: any) {
      setError(err.message || 'Error al registrar credencial WebAuthn')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (credentialId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta credencial?')) {
      return
    }

    try {
      await deleteWebAuthnCredential(credentialId)
      await loadCredentials()
      
      // Actualizar el estado del keyring para reflejar la eliminación
      await refreshWebAuthnCredentials()
      
      setSuccess('Credencial eliminada exitosamente')
    } catch (err: any) {
      setError(err.message || 'Error al eliminar credencial')
    }
  }

  if (!isAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            WebAuthn
          </CardTitle>
          <CardDescription>
            Autenticación biométrica y con claves de seguridad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <p>WebAuthn no está disponible en este navegador o dispositivo.</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              WebAuthn requiere un navegador moderno con soporte para la Web Authentication API.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Gestión de WebAuthn
        </CardTitle>
        <CardDescription>
          Registra credenciales biométricas o claves de seguridad para autenticación sin contraseña
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 border rounded-lg bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </div>
        )}

        {success && (
          <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
              <CheckCircle className="h-4 w-4" />
              {success}
            </div>
          </div>
        )}

        {isBiometricSupported && (
          <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
              <CheckCircle className="h-4 w-4" />
              <p>Tu dispositivo soporta autenticación biométrica (huella dactilar, reconocimiento facial, etc.)</p>
            </div>
          </div>
        )}

        {/* Registrar nueva credencial */}
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-medium">Registrar Nueva Credencial</h3>
          <Input
            placeholder="Nombre de usuario (opcional)"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <Input
            placeholder="Nombre para esta credencial (opcional)"
            value={credentialName}
            onChange={(e) => setCredentialName(e.target.value)}
          />
          <Button
            onClick={handleRegister}
            disabled={isLoading}
            className="w-full"
          >
            <Fingerprint className="h-4 w-4 mr-2" />
            {isLoading ? 'Registrando...' : 'Registrar Credencial WebAuthn'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Se te pedirá que uses tu huella dactilar, reconocimiento facial, o clave de seguridad para completar el registro.
          </p>
        </div>

        {/* Lista de credenciales */}
        {credentials.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">Credenciales Registradas ({credentials.length})</h3>
            <div className="space-y-2">
              {credentials.map((credential) => (
                <div
                  key={credential.id}
                  className="p-3 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {credential.name || 'Credencial sin nombre'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      ID: {credential.id.substring(0, 20)}...
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        Usada {credential.counter} vez{credential.counter !== 1 ? 'es' : ''}
                      </Badge>
                      {credential.lastUsedAt && (
                        <Badge variant="secondary" className="text-xs">
                          Último uso: {new Date(credential.lastUsedAt).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(credential.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Las credenciales WebAuthn se almacenan localmente en tu dispositivo.
            Puedes usar múltiples credenciales (diferentes dispositivos, métodos biométricos, etc.).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

