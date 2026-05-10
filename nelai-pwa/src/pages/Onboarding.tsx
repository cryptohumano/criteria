import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { Wallet, Shield, Lock, Sparkles, Key, FileText, Upload } from 'lucide-react'
import { BackupManager } from '@/components/BackupManager'

export default function Onboarding() {
  const navigate = useNavigate()
  const { generateMnemonic, addFromMnemonic, unlock, isUnlocked, hasStoredAccounts } = useKeyringContext()
  const [step, setStep] = useState<'welcome' | 'create' | 'backup' | 'password'>('welcome')
  const [mnemonic, setMnemonic] = useState<string>('')
  const [name, setName] = useState<string>('Mi Primera Cuenta')
  const [password, setPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showBackupDialog, setShowBackupDialog] = useState(false)

  // Si ya está desbloqueado, redirigir a home (usar useEffect para evitar render durante render)
  useEffect(() => {
    if (isUnlocked && hasStoredAccounts && shouldRedirect) {
      navigate('/')
      setShouldRedirect(false)
    }
  }, [isUnlocked, hasStoredAccounts, shouldRedirect, navigate])

  const handleStart = () => {
    setStep('create')
    const newMnemonic = generateMnemonic()
    setMnemonic(newMnemonic)
  }

  const handleBackupConfirmed = () => {
    setStep('password')
  }

  const handleCreateAccount = async () => {
    setError('')
    
    if (!password) {
      setError('La contraseña es requerida para proteger tu cuenta')
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      // Para la primera cuenta, necesitamos desbloquear el keyring primero
      // Como no hay cuentas previas, el unlock retorna true y marca como desbloqueado
      const unlocked = await unlock(password)
      
      if (!unlocked) {
        setError('Error al inicializar el wallet. Por favor intenta de nuevo.')
        setLoading(false)
        return
      }
      
      // Ahora crear la cuenta
      // addFromMnemonic ahora permite crear cuentas cuando no hay cuentas almacenadas
      // incluso si isUnlocked aún no se actualizó en el componente
      const account = await addFromMnemonic(mnemonic, name, 'sr25519', password)
      if (account) {
        // Marcar para redirigir (el useEffect se encargará de la redirección)
        setShouldRedirect(true)
        setLoading(false)
      } else {
        setError('Error al crear la cuenta. Por favor intenta de nuevo.')
        setLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta')
      setLoading(false)
    }
  }

  if (step === 'welcome') {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <Card className="w-full max-w-2xl shadow-xl border-2 border-primary/20">
          <CardHeader className="text-center">
            {/* Logo CriterIA */}
            <div className="mx-auto mb-6 flex flex-col items-center">
              <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-2xl mb-4 ring-4 ring-primary/20">
                <img 
                  src={`${import.meta.env.BASE_URL || '/'}web-app-manifest-192x192.png`} 
                  alt="CriterIA" 
                  className="w-28 h-28 rounded-2xl"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      parent.innerHTML = '<div class="text-white text-4xl font-bold">C</div>'
                    }
                  }}
                />
              </div>
              <div className="text-center">
                <h1 className="text-4xl font-bold text-primary mb-2">
                  CriterIA
                </h1>
                <p className="text-sm text-muted-foreground">
                  Procedencia y autenticidad verificables
                </p>
              </div>
            </div>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl">Bienvenido</CardTitle>
            <CardDescription className="text-lg mt-2">
              Tu wallet criptográfica segura para procedencia y verificación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg border-2 border-primary/30 bg-primary/10">
                <Wallet className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold mb-1 text-primary">Segura</h3>
                <p className="text-sm text-muted-foreground">
                  Tus claves privadas nunca salen de tu dispositivo
                </p>
              </div>
              <div className="text-center p-4 rounded-lg border-2 border-primary/30 bg-primary/10">
                <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold mb-1 text-primary">Encriptada</h3>
                <p className="text-sm text-muted-foreground">
                  Protección con contraseña y WebAuthn
                </p>
              </div>
              <div className="text-center p-4 rounded-lg border-2 border-accent/30 bg-accent/10">
                <Lock className="h-8 w-8 mx-auto mb-2 text-accent" />
                <h3 className="font-semibold mb-1 text-accent">Offline</h3>
                <p className="text-sm text-muted-foreground">
                  Funciona completamente sin conexión
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Button onClick={handleStart} className="w-full" size="lg">
                Crear Mi Primera Cuenta
              </Button>
              <Button
                onClick={() => setShowImportDialog(true)}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Importar Cuenta Existente
              </Button>
            </div>

            {/* Diálogo para elegir método de importación */}
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto mx-4 sm:mx-0">
                <DialogHeader>
                  <DialogTitle>¿Cómo deseas importar tu cuenta?</DialogTitle>
                  <DialogDescription>
                    Selecciona el método que prefieres para importar tu cuenta existente
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Button
                    onClick={() => {
                      navigate('/accounts/import?method=mnemonic')
                      setShowImportDialog(false)
                    }}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-start gap-2"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Key className="h-5 w-5" />
                      <span className="font-semibold">Frase de Recuperación (Mnemonic)</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">
                      Ingresa las 12 o 24 palabras de tu frase de recuperación
                    </p>
                  </Button>
                  <Button
                    onClick={() => {
                      navigate('/accounts/import?method=json')
                      setShowImportDialog(false)
                    }}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-start gap-2"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <FileText className="h-5 w-5" />
                      <span className="font-semibold">Archivo JSON</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">
                      Importa desde un archivo JSON de Polkadot.js o formato compatible
                    </p>
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">O</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setShowImportDialog(false)
                      setShowBackupDialog(true)
                    }}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-start gap-2"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Upload className="h-5 w-5" />
                      <span className="font-semibold">Importar Backup Completo</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-left">
                      Restaura todas tus cuentas, contactos y configuraciones desde un archivo de backup
                    </p>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Diálogo para importar backup completo */}
            <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
              <DialogContent className="max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-4 sm:mx-0">
                <DialogHeader>
                  <DialogTitle>Importar Backup Completo</DialogTitle>
                  <DialogDescription>
                    Restaura todas tus cuentas, contactos y configuraciones desde un archivo de backup
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <BackupManager 
                    onImportComplete={() => {
                      setShowBackupDialog(false)
                      setShowImportDialog(false)
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Importante:</strong> CriterIA es una aplicación no custodial.
                Tú eres el único responsable de tus claves privadas y fondos. 
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Guarda tu frase de recuperación (mnemonic) en un lugar seguro</li>
                  <li>Nunca compartas tu frase de recuperación con nadie</li>
                  <li>Si pierdes tu frase de recuperación, perderás acceso permanente a tus fondos</li>
                  <li>No hay forma de recuperar tu cuenta sin la frase de recuperación</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Tu Frase de Recuperación</CardTitle>
            <CardDescription>
              Guarda estas 12 palabras en un lugar seguro. Necesitarás esta frase para
              recuperar tu cuenta si pierdes acceso a este dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 bg-muted rounded-lg border-2 border-dashed">
              {showMnemonic ? (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {mnemonic.split(' ').map((word, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-6">{index + 1}.</span>
                      <span className="font-mono">{word}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Button onClick={() => setShowMnemonic(true)} variant="outline">
                    Mostrar Frase de Recuperación
                  </Button>
                </div>
              )}
            </div>

            {showMnemonic && (
              <Alert>
                <AlertDescription>
                  <strong>⚠️ Advertencia:</strong> No compartas esta frase con nadie.
                  Cualquiera que tenga acceso a estas palabras puede controlar tu cuenta.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => setStep('welcome')}
                variant="outline"
                className="flex-1"
              >
                Atrás
              </Button>
              <Button
                onClick={handleBackupConfirmed}
                className="flex-1"
                disabled={!showMnemonic}
              >
                He Guardado la Frase
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Configurar Contraseña</CardTitle>
            <CardDescription>
              Crea una contraseña segura para proteger tu cuenta. Esta contraseña se
              usará para desbloquear tu wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Cuenta</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mi Primera Cuenta"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => setStep('create')}
                variant="outline"
                className="flex-1"
              >
                Atrás
              </Button>
              <Button
                onClick={handleCreateAccount}
                className="flex-1"
                disabled={loading || !password || !confirmPassword}
              >
                {loading ? 'Creando...' : 'Crear Cuenta'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

