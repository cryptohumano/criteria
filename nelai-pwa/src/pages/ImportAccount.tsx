import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { AlertCircle, CheckCircle, Copy, Eye, EyeOff, Key, FileText, Users } from 'lucide-react'
import { decryptPolkadotJsBackup, isPolkadotJsBackup } from '@/utils/polkadotJsBackup'
import { getAllEncryptedAccounts } from '@/utils/secureStorage'

type CryptoType = 'sr25519' | 'ed25519' | 'ecdsa'
type ImportMethod = 'mnemonic' | 'uri' | 'json'

export default function ImportAccount() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addFromMnemonic, addFromUri, addFromJson, isUnlocked, unlock } = useKeyringContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Obtener el método desde los query params, por defecto 'mnemonic'
  const methodFromUrl = searchParams.get('method') as ImportMethod | null
  const [method, setMethod] = useState<ImportMethod>(methodFromUrl || 'mnemonic')

  // Actualizar el método si cambia en la URL
  useEffect(() => {
    if (methodFromUrl && ['mnemonic', 'uri', 'json'].includes(methodFromUrl)) {
      setMethod(methodFromUrl)
    }
  }, [methodFromUrl])
  const [mnemonic, setMnemonic] = useState('')
  const [uri, setUri] = useState('')
  const [jsonData, setJsonData] = useState('')
  const [jsonFile, setJsonFile] = useState<File | null>(null)
  const [jsonPassword, setJsonPassword] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<CryptoType>('sr25519')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [importedAddress, setImportedAddress] = useState<string | null>(null)
  const [vaultExists, setVaultExists] = useState<boolean | null>(null)
  
  // Estado para backup completo de Polkadot.js
  const [backupAccounts, setBackupAccounts] = useState<Array<{ address: string; json: any; meta: any }>>([])
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [showAccountSelection, setShowAccountSelection] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const stored = await getAllEncryptedAccounts()
        if (!mounted) return
        setVaultExists(stored.length > 0)
      } catch (e) {
        console.warn('[ImportAccount] no se pudo leer IndexedDB para detectar vault', e)
        if (!mounted) return
        setVaultExists(null)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Validar mnemonic (12 o 24 palabras)
  const validateMnemonic = (mnemonic: string): boolean => {
    const words = mnemonic.trim().split(/\s+/)
    return words.length === 12 || words.length === 24
  }

  const handleImport = async () => {
    setError('')
    setSuccess(false)
    setImportedAddress(null)

    const mustUseVaultPassword = vaultExists === true

    if (mustUseVaultPassword && !password.trim()) {
      setError('Ingresa la contraseña de tu wallet para importar y guardar esta cuenta.')
      return
    }

    // Validar contraseña si se proporciona (o es requerida por vault)
    if (password.trim()) {
      if (password.trim().length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres')
        return
      }
      if (password.trim() !== confirmPassword.trim()) {
        setError('Las contraseñas no coinciden')
        return
      }
    }

    setLoading(true)

    try {
      // Si no está desbloqueado y hay contraseña, intentar desbloquear primero
      if (!isUnlocked && password.trim()) {
        const unlocked = await unlock(password.trim())
        if (!unlocked) {
          setError('Error al desbloquear el wallet. Verifica tu contraseña.')
          setLoading(false)
          return
        }
      }

      let account = null

      switch (method) {
        case 'mnemonic':
          if (!mnemonic.trim()) {
            setError('Por favor ingresa tu frase de recuperación (mnemonic)')
            setLoading(false)
            return
          }

          if (!validateMnemonic(mnemonic)) {
            setError('La frase de recuperación debe tener 12 o 24 palabras')
            setLoading(false)
            return
          }

          account = await addFromMnemonic(
            mnemonic.trim(),
            name.trim() || undefined,
            type,
            password.trim() || undefined
          )
          break

        case 'uri':
          if (!uri.trim()) {
            setError('Por favor ingresa tu URI o seed')
            setLoading(false)
            return
          }

          account = await addFromUri(
            uri.trim(),
            name.trim() || undefined,
            type,
            password.trim() || undefined
          )
          break

        case 'json':
          try {
            let parsed: any

            // Si hay un archivo seleccionado, leerlo
            if (jsonFile) {
              const fileContent = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = (e) => resolve(e.target?.result as string)
                reader.onerror = () => reject(new Error('Error al leer el archivo'))
                reader.readAsText(jsonFile)
              })
              parsed = JSON.parse(fileContent)
            } else if (jsonData) {
              parsed = JSON.parse(jsonData)
            } else {
              setError('Por favor selecciona un archivo JSON o pega el contenido')
              setLoading(false)
              return
            }

            // Verificar si es un archivo de backup de Aura Wallet
            if (parsed.version && parsed.accounts && Array.isArray(parsed.accounts) && !parsed.encoded) {
              // Es un archivo de backup completo de Aura Wallet
              setError('Este es un archivo de backup completo de Aura Wallet. Por favor, usa la opción "Importar Backup Completo" desde la pantalla de inicio (onboarding) o desde Configuración > Seguridad > Backup e Importación.')
              setLoading(false)
              return
            }

            // Verificar si es un backup completo de Polkadot.js (tiene 'encoded' y 'accounts' array)
            if (isPolkadotJsBackup(parsed)) {
              // Es un backup completo de Polkadot.js con múltiples cuentas
              if (!jsonPassword) {
                setError('Se requiere la contraseña del archivo JSON de Polkadot.js para desencriptar el backup completo')
                setLoading(false)
                return
              }

              try {
                // Desencriptar el backup completo
                const accounts = await decryptPolkadotJsBackup(parsed, jsonPassword)
                
                if (accounts.length === 0) {
                  setError('No se encontraron cuentas en el backup')
                  setLoading(false)
                  return
                }
                
                // Mostrar UI de selección de cuentas
                setBackupAccounts(accounts)
                setSelectedAccounts(new Set(accounts.map(acc => acc.address)))
                setShowAccountSelection(true)
                setLoading(false)
                return
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al desencriptar el backup de Polkadot.js')
                setLoading(false)
                return
              }
            }

            // Verificar si es un JSON de Polkadot.js individual (tiene 'address' y 'encoded')
            if (parsed.address && parsed.encoded) {
              // Es un JSON de Polkadot.js
              if (!jsonPassword) {
                setError('Se requiere la contraseña del archivo JSON de Polkadot.js')
                setLoading(false)
                return
              }

              account = await addFromJson(
                parsed,
                jsonPassword,
                password.trim() || undefined
              )
            } else if (parsed.mnemonic) {
              // JSON con mnemonic simple
              if (!validateMnemonic(parsed.mnemonic)) {
                setError('El mnemonic en el JSON debe tener 12 o 24 palabras')
                setLoading(false)
                return
              }
              account = await addFromMnemonic(
                parsed.mnemonic,
                parsed.name || name.trim() || undefined,
                parsed.type || type,
                password.trim() || undefined
              )
            } else if (parsed.uri || parsed.seed) {
              // JSON con URI o seed
              account = await addFromUri(
                parsed.uri || parsed.seed,
                parsed.name || name.trim() || undefined,
                parsed.type || type,
                password.trim() || undefined
              )
            } else {
              // Verificar si podría ser un backup completo de criterIA (nombre anterior del producto)
              if (parsed.version || (parsed.accounts && Array.isArray(parsed.accounts))) {
                setError('Este parece ser un archivo de backup completo de criterIA. Por favor, usa la opción "Importar Backup Completo" desde la pantalla de inicio o desde Configuración > Seguridad > Backup e Importación.')
              } else {
                setError('El JSON debe ser un archivo de Polkadot.js (con address y encoded) o contener "mnemonic", "uri" o "seed"')
              }
              setLoading(false)
              return
            }
          } catch (err) {
            if (err instanceof Error && err.message.includes('Invalid password')) {
              setError('Contraseña incorrecta para el archivo JSON')
            } else {
              setError(err instanceof Error ? err.message : 'JSON inválido. Por favor verifica el formato.')
            }
            setLoading(false)
            return
          }
          break
      }

      if (account) {
        setImportedAddress(account.address)
        setSuccess(true)
        
        // Limpiar formulario
        setMnemonic('')
        setUri('')
        setJsonData('')
        setJsonFile(null)
        setJsonPassword('')
        setName('')
        setPassword('')
        setConfirmPassword('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

        // Redirigir después de 2 segundos
        setTimeout(() => {
          navigate('/accounts')
        }, 2000)
      } else {
        setError('Error al importar la cuenta. Por favor verifica los datos e intenta de nuevo.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar la cuenta')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyAddress = async () => {
    if (importedAddress) {
      await navigator.clipboard.writeText(importedAddress)
    }
  }

  const handleImportSelectedAccounts = async () => {
    if (selectedAccounts.size === 0) {
      setError('Por favor selecciona al menos una cuenta para importar')
      return
    }

    if (!jsonPassword) {
      setError('Se requiere la contraseña del archivo JSON de Polkadot.js')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Verificar si hay cuentas almacenadas
      const storedAccounts = await getAllEncryptedAccounts()
      const hasStoredAccounts = storedAccounts.length > 0

      // Determinar la contraseña final a usar
      let finalPassword: string | undefined = undefined

      // Si hay cuentas almacenadas, requerir contraseña para desbloquear
      if (hasStoredAccounts && !isUnlocked) {
        if (!password || password.trim().length === 0) {
          setError('Se requiere una contraseña para desbloquear el wallet y guardar las cuentas importadas')
          setLoading(false)
          return
        }
        const unlocked = await unlock(password.trim())
        if (!unlocked) {
          setError('Error al desbloquear el wallet. Verifica tu contraseña.')
          setLoading(false)
          return
        }
        // Usar la contraseña que desbloqueó el wallet
        finalPassword = password.trim()
      } else if (hasStoredAccounts && isUnlocked) {
        // Si el wallet ya está desbloqueado, requerir contraseña para guardar las nuevas cuentas
        if (!password || password.trim().length === 0) {
          setError('Se requiere una contraseña para guardar las cuentas importadas. Usa la contraseña de tu wallet.')
          setLoading(false)
          return
        }
        // Validar que la contraseña sea correcta intentando desbloquear (aunque ya esté desbloqueado)
        // O simplemente usar la contraseña proporcionada
        finalPassword = password.trim()
      } else {
        // Si no hay cuentas almacenadas, requerir contraseña para guardar las nuevas cuentas
        if (!password || password.trim().length === 0) {
          setError('Se requiere una contraseña para proteger y guardar las cuentas importadas. Esta será tu contraseña principal del wallet.')
          setLoading(false)
          return
        }

        // Validar longitud mínima
        if (password.trim().length < 8) {
          setError('La contraseña debe tener al menos 8 caracteres')
          setLoading(false)
          return
        }

        // Validar que coincidan
        if (confirmPassword && password.trim() !== confirmPassword.trim()) {
          setError('Las contraseñas no coinciden')
          setLoading(false)
          return
        }

        finalPassword = password.trim()
      }

      // Asegurar que tenemos una contraseña válida antes de importar
      if (!finalPassword || finalPassword.length === 0) {
        setError('Se requiere una contraseña válida para guardar las cuentas importadas')
        setLoading(false)
        return
      }

      const accountsToImport = backupAccounts.filter(acc => selectedAccounts.has(acc.address))
      const imported: string[] = []
      const errors: string[] = []

      for (const accountData of accountsToImport) {
        try {
          // Cada cuenta en el backup desencriptado debería tener formato JSON de Polkadot.js
          // Verificar que tenga address y encoded
          if (!accountData.json || !accountData.json.address || !accountData.json.encoded) {
            const accountName = accountData.meta?.name || accountData.address
            errors.push(`${accountName}: Formato de cuenta inválido (falta address o encoded)`)
            continue
          }
          
          // Usar addFromJson para importar cada cuenta individual
          // La contraseña del JSON es la misma para todas las cuentas del backup
          // Usar finalPassword que ya fue validado arriba
          const account = await addFromJson(
            accountData.json,
            jsonPassword,
            finalPassword
          )
          
          if (account) {
            imported.push(account.address)
            console.log(`[Import] ✅ Cuenta importada: ${account.address} (${accountData.meta?.name || 'Sin nombre'})`)
          }
        } catch (err) {
          const accountName = accountData.meta?.name || accountData.address
          const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
          errors.push(`${accountName}: ${errorMsg}`)
          console.error(`[Import] ❌ Error al importar cuenta ${accountName}:`, err)
        }
      }

      if (imported.length > 0) {
        setSuccess(true)
        setImportedAddress(imported[0])
        setShowAccountSelection(false)
        setBackupAccounts([])
        setSelectedAccounts(new Set())
        
        if (errors.length > 0) {
          setError(`Se importaron ${imported.length} cuenta(s), pero ${errors.length} fallaron: ${errors.join('; ')}`)
        }
        
        // Limpiar formulario
        setJsonData('')
        setJsonFile(null)
        setJsonPassword('')
        setPassword('')
        setConfirmPassword('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

        // Redirigir después de 2 segundos
        setTimeout(() => {
          navigate('/accounts')
        }, 2000)
      } else {
        setError(`No se pudo importar ninguna cuenta. Errores: ${errors.join('; ')}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar las cuentas')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAccount = (address: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(address)) {
        next.delete(address)
      } else {
        next.add(address)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedAccounts.size === backupAccounts.length) {
      setSelectedAccounts(new Set())
    } else {
      setSelectedAccounts(new Set(backupAccounts.map(acc => acc.address)))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recuperar Cuenta</h1>
        <p className="text-muted-foreground mt-2">
          Importa una cuenta existente usando tu frase de recuperación, URI o archivo JSON
        </p>
      </div>

      {!showAccountSelection && (
        <Card>
          <CardHeader>
            <CardTitle>Método de Importación</CardTitle>
            <CardDescription>
              Elige cómo deseas importar tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
          <Tabs value={method} onValueChange={(v) => setMethod(v as ImportMethod)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="mnemonic">
                <Key className="mr-2 h-4 w-4" />
                Frase de Recuperación
              </TabsTrigger>
              <TabsTrigger value="uri">
                <Key className="mr-2 h-4 w-4" />
                URI / Seed
              </TabsTrigger>
              <TabsTrigger value="json">
                <FileText className="mr-2 h-4 w-4" />
                Archivo JSON
              </TabsTrigger>
            </TabsList>

            {/* Frase de Recuperación */}
            <TabsContent value="mnemonic" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mnemonic">Frase de Recuperación (12 o 24 palabras)</Label>
                <div className="relative">
                  <Input
                    id="mnemonic"
                    type={showMnemonic ? 'text' : 'password'}
                    value={mnemonic}
                    onChange={(e) => setMnemonic(e.target.value)}
                    placeholder="palabra1 palabra2 palabra3 ..."
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowMnemonic(!showMnemonic)}
                  >
                    {showMnemonic ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ingresa las 12 o 24 palabras de tu frase de recuperación separadas por espacios
                </p>
              </div>
            </TabsContent>

            {/* URI / Seed */}
            <TabsContent value="uri" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="uri">URI o Seed</Label>
                <Input
                  id="uri"
                  type="text"
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder="//Alice o seed phrase"
                />
                <p className="text-xs text-muted-foreground">
                  Ingresa tu URI (ej: //Alice) o seed phrase
                </p>
              </div>
            </TabsContent>

            {/* Archivo JSON */}
            <TabsContent value="json" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="jsonFile">Seleccionar Archivo JSON</Label>
                  <input
                    ref={fileInputRef}
                    id="jsonFile"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setJsonFile(file)
                        setJsonData('') // Limpiar el campo de texto
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {jsonFile ? jsonFile.name : 'Seleccionar Archivo JSON'}
                  </Button>
                  {jsonFile && (
                    <p className="text-xs text-muted-foreground">
                      Archivo seleccionado: {jsonFile.name}
                    </p>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">O</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="json">Pegar Contenido JSON</Label>
                  <textarea
                    id="json"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    value={jsonData}
                    onChange={(e) => {
                      setJsonData(e.target.value)
                      setJsonFile(null) // Limpiar archivo si se pega contenido
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    placeholder='{"address": "...", "encoded": "...", ...} o {"mnemonic": "palabra1 palabra2 ..."}'
                  />
                  <p className="text-xs text-muted-foreground">
                    Soporta archivos JSON de Polkadot.js o JSON simple con mnemonic/uri/seed
                  </p>
                </div>

                {(jsonFile || (jsonData && JSON.parse(jsonData || '{}').address)) && (
                  <div className="space-y-2">
                    <Label htmlFor="jsonPassword">Contraseña del Archivo JSON (Requerida para archivos de Polkadot.js)</Label>
                    <Input
                      id="jsonPassword"
                      type="password"
                      value={jsonPassword}
                      onChange={(e) => setJsonPassword(e.target.value)}
                      placeholder="Contraseña usada al exportar el JSON"
                    />
                    <p className="text-xs text-muted-foreground">
                      Esta es la contraseña que usaste al exportar la cuenta desde Polkadot.js
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      )}

      {/* Configuración adicional */}
      {!showAccountSelection && (
        <Card>
        <CardHeader>
          <CardTitle>Configuración de la Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Cuenta (Opcional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi Cuenta Recuperada"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Criptografía</Label>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as CryptoType)}
            >
              <option value="sr25519">sr25519 (Schnorrkel - Recomendado)</option>
              <option value="ed25519">ed25519 (Edwards-Curve)</option>
              <option value="ecdsa">ecdsa (ECDSA)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {vaultExists
                ? 'Contraseña del wallet (requerida)'
                : 'Contraseña para proteger la cuenta (opcional)'}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <p className="text-xs text-muted-foreground">
              {vaultExists
                ? 'Esta debe ser la misma contraseña que usas para desbloquear tu wallet. Todas las cuentas guardadas comparten un solo password.'
                : 'Si proporcionas una contraseña, la cuenta se encriptará antes de guardarse. Si no la pones, la cuenta no se guardará y se perderá al bloquear.'}
            </p>
          </div>

          {(vaultExists || password) && (
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
          )}
        </CardContent>
      </Card>
      )}

      {/* Errores y éxito */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* UI de selección de cuentas del backup completo de Polkadot.js */}
      {showAccountSelection && backupAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Seleccionar Cuentas para Importar
            </CardTitle>
            <CardDescription>
              Se encontraron {backupAccounts.length} cuenta(s) en el backup. Selecciona cuáles deseas importar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedAccounts.size === backupAccounts.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedAccounts.size} de {backupAccounts.length} seleccionada(s)
              </span>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {backupAccounts.map((accountData) => {
                const isSelected = selectedAccounts.has(accountData.address)
                return (
                  <div
                    key={accountData.address}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 border-primary' : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => handleToggleAccount(accountData.address)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleAccount(accountData.address)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {accountData.meta?.name || 'Sin nombre'}
                      </div>
                      <div className="text-sm text-muted-foreground font-mono truncate">
                        {accountData.address}
                      </div>
                      {accountData.meta?.genesisHash && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Genesis: {accountData.meta.genesisHash.slice(0, 16)}...
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Campo de contraseña para guardar las cuentas */}
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="backup-password">
                  Contraseña para Proteger las Cuentas {isUnlocked ? '(Opcional)' : '(Requerida)'}
                </Label>
                <Input
                  id="backup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isUnlocked ? "Mínimo 8 caracteres (opcional)" : "Mínimo 8 caracteres (requerida)"}
                />
                <p className="text-xs text-muted-foreground">
                  {isUnlocked 
                    ? "Si proporcionas una contraseña, las cuentas se encriptarán antes de guardarse. Si ya tienes cuentas, usa tu contraseña actual."
                    : "Esta contraseña protegerá y guardará las cuentas importadas. Será tu contraseña principal del wallet."}
                </p>
              </div>

              {password && (
                <div className="space-y-2">
                  <Label htmlFor="backup-confirm-password">Confirmar Contraseña</Label>
                  <Input
                    id="backup-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAccountSelection(false)
                  setBackupAccounts([])
                  setSelectedAccounts(new Set())
                  setPassword('')
                  setConfirmPassword('')
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImportSelectedAccounts}
                disabled={loading || selectedAccounts.size === 0}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Key className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Importar {selectedAccounts.size} Cuenta(s)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {success && importedAddress && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>Cuenta importada exitosamente</strong>
                <p className="text-sm mt-1">Dirección: {importedAddress}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAddress}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Botones de acción */}
      {!showAccountSelection && (
        <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => navigate('/accounts')}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleImport}
          disabled={
            loading || 
            (method === 'mnemonic' && !mnemonic.trim()) ||
            (method === 'uri' && !uri.trim()) ||
            (method === 'json' && !jsonFile && !jsonData.trim())
          }
          className="flex-1"
        >
          {loading ? 'Importando...' : 'Importar Cuenta'}
        </Button>
      </div>
      )}

      {/* Advertencia de seguridad */}
      {!showAccountSelection && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante:</strong> Asegúrate de estar en un entorno seguro al ingresar tu
            frase de recuperación. Nunca compartas tu frase de recuperación con nadie.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
