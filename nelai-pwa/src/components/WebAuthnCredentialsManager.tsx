import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trash2, Shield, AlertCircle, CheckCircle, Fingerprint, Plus } from 'lucide-react'
import { getAllWebAuthnCredentials, deleteWebAuthnCredential, saveWebAuthnCredential } from '@/utils/webauthnStorage'
import { 
  isWebAuthnAvailable, 
  isBiometricAvailable, 
  registerWebAuthnCredential 
} from '@/utils/webauthn'
import { useKeyringContext } from '@/contexts/KeyringContext'
import type { WebAuthnCredential } from '@/utils/webauthn'

export function WebAuthnCredentialsManager() {
  const { refreshWebAuthnCredentials } = useKeyringContext()
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [isBiometricSupported, setIsBiometricSupported] = useState(false)
  const [credentialName, setCredentialName] = useState('')
  const [userName, setUserName] = useState('Usuario')

  const loadCredentials = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const creds = await getAllWebAuthnCredentials()
      setCredentials(creds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar credenciales')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const checkAvailability = async () => {
      const available = isWebAuthnAvailable()
      setIsAvailable(available)
      
      if (available) {
        const biometric = await isBiometricAvailable()
        setIsBiometricSupported(biometric)
      }
      
      await loadCredentials()
    }
    
    checkAvailability()
  }, [])

  const handleDelete = async (credentialId: string, credentialName?: string) => {
    if (!confirm(`¿Estás seguro de eliminar la credencial "${credentialName || credentialId}"?`)) {
      return
    }

    setDeletingId(credentialId)
    setError(null)
    setSuccess(null)

    try {
      await deleteWebAuthnCredential(credentialId)
      await loadCredentials()
      
      // Actualizar el estado del keyring
      await refreshWebAuthnCredentials()
      
      setSuccess('Credencial eliminada exitosamente')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la credencial')
    } finally {
      setDeletingId(null)
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    }
  }

  const handleRegister = async () => {
    if (!isAvailable) {
      setError('WebAuthn no está disponible en este navegador')
      return
    }

    setIsRegistering(true)
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
        userName || 'Usuario de Nelai',
        credentialName || undefined
      )

      await saveWebAuthnCredential(credential)
      await loadCredentials()
      
      // Actualizar el estado del keyring
      await refreshWebAuthnCredentials()
      
      setSuccess('Credencial WebAuthn registrada exitosamente. Ahora puedes usarla para desbloquear tu wallet.')
      setCredentialName('')
      setUserName('Usuario')
    } catch (err: any) {
      setError(err.message || 'Error al registrar credencial WebAuthn')
    } finally {
      setIsRegistering(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  if (!isAvailable) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          WebAuthn no está disponible en este navegador o dispositivo.
          WebAuthn requiere un navegador moderno con soporte para la Web Authentication API.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Credenciales WebAuthn</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona tus credenciales de autenticación biométrica o PIN
          </p>
        </div>
        <Button variant="outline" onClick={loadCredentials} disabled={isLoading}>
          {isLoading ? 'Cargando...' : 'Actualizar'}
        </Button>
      </div>

      {isBiometricSupported && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Tu dispositivo soporta autenticación biométrica (huella dactilar, reconocimiento facial, PIN, etc.)
          </AlertDescription>
        </Alert>
      )}

      {/* Formulario para registrar nueva credencial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Registrar Nueva Credencial
          </CardTitle>
          <CardDescription>
            Registra una nueva credencial WebAuthn para desbloquear tu wallet sin contraseña
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userName">Nombre de Usuario (Opcional)</Label>
            <Input
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Usuario"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credentialName">Nombre de la Credencial (Opcional)</Label>
            <Input
              id="credentialName"
              value={credentialName}
              onChange={(e) => setCredentialName(e.target.value)}
              placeholder="Mi Huella Dactilar / PIN"
            />
            <p className="text-xs text-muted-foreground">
              Un nombre descriptivo para identificar esta credencial (ej: "Huella Dactilar", "PIN Windows Hello")
            </p>
          </div>
          <Button
            onClick={handleRegister}
            disabled={isRegistering}
            className="w-full"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            {isRegistering ? 'Registrando...' : 'Registrar Credencial WebAuthn'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Se te pedirá que uses tu huella dactilar, reconocimiento facial, PIN, o clave de seguridad
            para completar el registro. En Windows Hello, puedes usar PIN sin hardware USB.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>Cargando credenciales...</p>
        </div>
      ) : credentials.length === 0 ? (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            No hay credenciales WebAuthn registradas. Puedes registrar una desde el
            componente de desbloqueo del wallet.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {credentials.map((credential) => (
            <Card key={credential.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">
                        {credential.name || 'Credencial sin nombre'}
                      </h4>
                      <Badge variant="outline">WebAuthn</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        <strong>ID:</strong> {credential.id.substring(0, 20)}...
                      </p>
                      <p>
                        <strong>Creada:</strong> {formatDate(credential.createdAt)}
                      </p>
                      {credential.lastUsedAt && (
                        <p>
                          <strong>Último uso:</strong> {formatDate(credential.lastUsedAt)}
                        </p>
                      )}
                      <p>
                        <strong>Usos:</strong> {credential.counter}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(credential.id, credential.name)}
                    disabled={deletingId === credential.id}
                  >
                    {deletingId === credential.id ? (
                      'Eliminando...'
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Nota:</strong> Eliminar una credencial WebAuthn no afecta tus cuentas.
          Solo eliminará la opción de desbloquear usando esa credencial. Siempre podrás
          desbloquear usando tu contraseña o registrar una nueva credencial WebAuthn.
        </AlertDescription>
      </Alert>
    </div>
  )
}

