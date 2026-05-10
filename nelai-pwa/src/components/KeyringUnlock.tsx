import { useState, useEffect, useCallback } from 'react'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Unlock, AlertCircle, Fingerprint, User } from 'lucide-react'
import { getAllWebAuthnCredentials } from '@/utils/webauthnStorage'
import { getAllEncryptedAccounts, type EncryptedAccount } from '@/utils/secureStorage'
import type { WebAuthnCredential } from '@/utils/webauthn'

export function KeyringUnlock() {
  const { isUnlocked, hasStoredAccounts, hasWebAuthnCredentials, unlock, unlockWithWebAuthn, lock, isReady } = useKeyringContext()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [webauthnCredentials, setWebauthnCredentials] = useState<WebAuthnCredential[]>([])
  const [storedAccounts, setStoredAccounts] = useState<EncryptedAccount[]>([])
  const [isWebAuthnLoading, setIsWebAuthnLoading] = useState(false)

  const loadMetadata = useCallback(async () => {
    try {
      const [creds, stored] = await Promise.all([
        getAllWebAuthnCredentials(),
        getAllEncryptedAccounts()
      ])
      setWebauthnCredentials(creds)
      setStoredAccounts(stored)
    } catch (err) {
      console.error('[KeyringUnlock] Error al cargar metadatos:', err)
    }
  }, [])

  useEffect(() => {
    if (isReady) {
      loadMetadata()
    }
  }, [loadMetadata, isReady, isUnlocked])

  const handleWebAuthnUnlock = async (credentialId: string) => {
    setIsWebAuthnLoading(true)
    setError(null)

    try {
      const success = await unlockWithWebAuthn(credentialId)
      if (!success) {
        setError('Error al autenticar con WebAuthn')
      }
    } catch (err: any) {
      setError(err.message || 'Error al desbloquear con WebAuthn')
    } finally {
      setIsWebAuthnLoading(false)
    }
  }

  // Si el keyring no está listo, mostrar un mensaje
  if (!isReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Estado del Keyring
          </CardTitle>
          <CardDescription>
            Inicializando keyring...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError('Por favor ingresa una contraseña')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const success = await unlock(password)
      if (!success) {
        setError('Contraseña incorrecta')
        setPassword('')
      } else {
        setPassword('')
      }
    } catch (err: any) {
      setError(err.message || 'Error al desbloquear el keyring')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLock = () => {
    lock()
    setPassword('')
    setError(null)
  }

  if (isUnlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-green-600" />
            Keyring Desbloqueado
          </CardTitle>
          <CardDescription>
            Tus cuentas están cargadas y disponibles para operaciones criptográficas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLock} variant="outline" className="w-full">
            <Lock className="h-4 w-4 mr-2" />
            Bloquear Keyring
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Al bloquear, las claves privadas se eliminarán de la memoria
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!hasStoredAccounts) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Estado del Keyring
          </CardTitle>
          <CardDescription>
            No hay cuentas almacenadas. Desbloquea el keyring para crear tu primera cuenta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Contraseña (cualquiera, para desbloquear y crear tu primera cuenta)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUnlock()
                }
              }}
              disabled={isLoading}
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>

          <Button 
            onClick={handleUnlock} 
            disabled={isLoading || !password.trim()} 
            className="w-full"
          >
            {isLoading ? 'Desbloqueando...' : 'Desbloquear para Crear Primera Cuenta'}
          </Button>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Nota:</strong> Como no hay cuentas almacenadas, puedes usar cualquier contraseña para desbloquear.
              Esta contraseña se usará para encriptar tu primera cuenta cuando la crees.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-yellow-200 dark:border-yellow-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Desbloquear Keyring
        </CardTitle>
        <CardDescription>
          {webauthnCredentials.length > 0 
            ? 'Usa autenticación biométrica o contraseña para cargar tus cuentas almacenadas'
            : 'Ingresa tu contraseña para cargar tus cuentas almacenadas'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mostrar WebAuthn primero si hay credenciales disponibles */}
        {webauthnCredentials.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Autenticación Biométrica
            </div>
            {webauthnCredentials.map((credential) => (
              <Button
                key={credential.id}
                onClick={() => handleWebAuthnUnlock(credential.id)}
                disabled={isWebAuthnLoading || isLoading}
                variant="outline"
                className="w-full"
              >
                <Fingerprint className="h-4 w-4 mr-2" />
                {isWebAuthnLoading ? 'Autenticando...' : `Desbloquear con ${credential.name || 'WebAuthn'}`}
              </Button>
            ))}
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">O</span>
              </div>
            </div>
          </div>
        )}

        {/* Opción con contraseña */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleUnlock()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                {webauthnCredentials.length > 0 ? 'Contraseña' : 'Desbloquear con Contraseña'}
              </label>
              {hasStoredAccounts && storedAccounts.length > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {storedAccounts[0].meta.name || 'Cuenta Principal'}
                  {storedAccounts.length > 1 && ` (+${storedAccounts.length - 1})`}
                </span>
              )}
            </div>

            {/* Hidden username to satisfy accessibility and password managers */}
            <input 
              type="text" 
              name="username" 
              autoComplete="username" 
              defaultValue="wallet-user" 
              className="sr-only" 
              tabIndex={-1}
            />

            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              disabled={isLoading || isWebAuthnLoading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <Button 
            type="submit"
            disabled={isLoading || isWebAuthnLoading || !password.trim()} 
            className="w-full"
          >
            {isLoading ? 'Desbloqueando...' : 'Desbloquear'}
          </Button>
        </form>

        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Seguridad:</strong> Las claves privadas están encriptadas y almacenadas localmente en IndexedDB.
            Puedes usar contraseña o autenticación biométrica (WebAuthn) para desbloquear.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

