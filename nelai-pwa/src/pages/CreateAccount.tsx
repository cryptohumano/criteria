import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Unlock } from '@/components/auth/Unlock'

type CryptoType = 'sr25519' | 'ed25519' | 'ecdsa'

export default function CreateAccount() {
  const navigate = useNavigate()
  const { generateMnemonic, addFromMnemonic, isUnlocked, hasStoredAccounts } = useKeyringContext()
  const [step, setStep] = useState<'form' | 'backup' | 'password'>('form')
  const [name, setName] = useState('')
  const [type, setType] = useState<CryptoType>('sr25519')
  const [mnemonic, setMnemonic] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Solo pedir desbloqueo si ya hay cuentas en el dispositivo; la primera cuenta usa la contraseña del flujo de creación.
  if (hasStoredAccounts && !isUnlocked) {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Crear cuenta</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Desbloquea el almacén local de firmas (Substrate) para añadir otra llave en este dispositivo.
          </p>
        </div>
        <Unlock />
        <Button variant="ghost" asChild>
          <Link to="/accounts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a cuentas
          </Link>
        </Button>
      </div>
    )
  }

  const handleGenerate = () => {
    const newMnemonic = generateMnemonic()
    setMnemonic(newMnemonic)
    setStep('backup')
  }

  const handleCopyMnemonic = async () => {
    await navigator.clipboard.writeText(mnemonic)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBackupConfirmed = () => {
    setStep('password')
  }

  const handleCreate = async () => {
    setError('')

    if (!name.trim()) {
      setError('El nombre de la cuenta es requerido')
      return
    }

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
      const account = await addFromMnemonic(mnemonic, name, type, password)
      if (account) {
        navigate('/accounts')
      } else {
        setError('Error al crear la cuenta. Por favor intenta de nuevo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'form') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/accounts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Crear Nueva Cuenta</h1>
            <p className="text-muted-foreground mt-1">
              Genera una nueva cuenta con una frase de recuperación
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuración de la Cuenta</CardTitle>
            <CardDescription>
              Configura los detalles básicos de tu nueva cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Cuenta</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mi Cuenta"
              />
            </div>

            <div className="space-y-3">
              <Label>Tipo de Criptografía</Label>
              <RadioGroup value={type} onValueChange={(v) => setType(v as CryptoType)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sr25519" id="sr25519" />
                  <Label htmlFor="sr25519" className="font-normal cursor-pointer">
                    sr25519 (Schnorrkel) - Recomendado para Substrate
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ed25519" id="ed25519" />
                  <Label htmlFor="ed25519" className="font-normal cursor-pointer">
                    ed25519 (Edwards) - Alternativa común
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ecdsa" id="ecdsa" />
                  <Label htmlFor="ecdsa" className="font-normal cursor-pointer">
                    ecdsa - Compatible con Ethereum
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button onClick={handleGenerate} className="w-full" size="lg">
              Generar Nueva Cuenta
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'backup') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setStep('form')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Guarda tu Frase de Recuperación</h1>
            <p className="text-muted-foreground mt-1">
              Esta frase es la única forma de recuperar tu cuenta
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Frase de Recuperación (Mnemonic)</CardTitle>
            <CardDescription>
              Guarda estas 12 palabras en un lugar seguro. Sin esta frase, no podrás
              recuperar tu cuenta si pierdes acceso a este dispositivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 bg-muted rounded-lg border-2 border-dashed">
              {showMnemonic ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {mnemonic.split(' ').map((word, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-6">{index + 1}.</span>
                        <span className="font-mono">{word}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleCopyMnemonic}
                    variant="outline"
                    className="w-full"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar al Portapapeles
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Button onClick={() => setShowMnemonic(true)} variant="outline" size="lg">
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
                  Guárdala en un lugar seguro y nunca la compartas.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => setStep('form')}
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
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setStep('backup')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Configurar Contraseña</h1>
            <p className="text-muted-foreground mt-1">
              Protege tu cuenta con una contraseña segura
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Contraseña de Seguridad</CardTitle>
            <CardDescription>
              {hasStoredAccounts
                ? 'Usa la contraseña de tu wallet (vault). Debe ser la misma que usas para desbloquear.'
                : 'Esta contraseña se usará para encriptar y proteger tu cuenta en este dispositivo'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasStoredAccounts && (
              <Alert>
                <AlertDescription>
                  <strong>Importante:</strong> En Nelai, todas las cuentas guardadas comparten una sola contraseña de wallet. Esto evita
                  inconsistencias donde “solo funciona la última contraseña”.
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">{hasStoredAccounts ? 'Contraseña del wallet' : 'Contraseña'}</Label>
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
                onClick={() => setStep('backup')}
                variant="outline"
                className="flex-1"
              >
                Atrás
              </Button>
              <Button
                onClick={handleCreate}
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

