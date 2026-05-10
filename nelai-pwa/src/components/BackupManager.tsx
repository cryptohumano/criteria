import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Download, Upload, AlertTriangle, CheckCircle, Info, FileText, Eye, EyeOff } from 'lucide-react'
import { downloadBackup, readBackupFile, importBackup, type BackupData } from '@/utils/backup'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useNavigate } from 'react-router-dom'
import { decrypt } from '@/utils/encryption'

interface BackupManagerProps {
  onImportComplete?: () => void
}

export function BackupManager({ onImportComplete }: BackupManagerProps = {}) {
  const navigate = useNavigate()
  const { refreshStoredAccounts, refreshWebAuthnCredentials, unlock } = useKeyringContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [exportOptions, setExportOptions] = useState({
    includeImages: false, // Por defecto no incluir imágenes (backup más pequeño)
    includePDFs: false, // Por defecto no incluir PDFs (backup más pequeño)
  })
  const [importOptions, setImportOptions] = useState({
    overwriteAccounts: false,
    overwriteContacts: false,
    overwriteApiConfigs: false,
    overwriteWebAuthn: false,
    overwriteMountainLogs: false,
    overwriteDocuments: false,
  })
  const [importPassword, setImportPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{
    accountsImported: number
    contactsImported: number
    apiConfigsImported: number
    webauthnImported: number
    transactionsImported: number
    mountainLogsImported: number
    documentsImported: number
    errors: string[]
  } | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('[BackupManager] Iniciando descarga de backup...', exportOptions)
      await downloadBackup(exportOptions)
      console.log('[BackupManager] ✅ Backup descargado exitosamente')
      const sizeInfo = exportOptions.includeImages || exportOptions.includePDFs
        ? ' (incluye imágenes/PDFs - archivo más grande)'
        : ' (solo metadata - archivo más pequeño)'
      setSuccess(`Backup exportado exitosamente${sizeInfo}. El archivo debería descargarse automáticamente.`)
      
      // Mostrar información adicional en consola para debugging
      console.log('[BackupManager] Si no se descargó el archivo, verifica:')
      console.log('  1. Que tu navegador permita descargas automáticas')
      console.log('  2. Que no haya bloqueadores de pop-ups activos')
      console.log('  3. La consola del navegador para más detalles')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al exportar backup'
      console.error('[BackupManager] ❌ Error:', err)
      console.error('[BackupManager] Detalles:', {
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined
      })
      setError(`Error al exportar backup: ${errorMessage}. Revisa la consola para más detalles.`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setSuccess(null)
    setImportResult(null)
    setImportPassword('') // Limpiar contraseña anterior
    setPasswordError(null)

    try {
      // Leer y validar el archivo (esto puede tomar tiempo, mostrar loading)
      setIsImporting(true)
      const backup = await readBackupFile(file)
      setIsImporting(false) // Ya leímos el archivo, ahora esperamos confirmación
      
      // Mostrar información del backup
      const backupDate = new Date(backup.createdAt).toLocaleString()
      const accountsCount = backup.accounts?.length || 0
      const contactsCount = backup.contacts?.length || 0
      const apiConfigsCount = backup.apiConfigs?.length || 0
      const webauthnCount = backup.webauthnCredentials?.length || 0

      // Abrir diálogo de confirmación con opciones
      setIsDialogOpen(true)
      
      // Guardar el backup en el estado para importarlo después
      ;(window as any).__pendingBackup = backup
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al leer el archivo de backup')
      setIsImporting(false)
    }

    // Limpiar el input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImport = async () => {
    // Prevenir múltiples ejecuciones simultáneas
    if (isImporting) {
      console.log('[BackupManager] ⚠️ Importación ya en progreso, ignorando llamada duplicada')
      return
    }

    const backup = (window as any).__pendingBackup as BackupData | undefined
    if (!backup) {
      setError('No hay backup pendiente para importar')
      return
    }

    // Si hay cuentas en el backup, verificar la contraseña
    if (backup.accounts && backup.accounts.length > 0) {
      if (!importPassword) {
        setPasswordError('La contraseña es requerida para importar cuentas encriptadas')
        return
      }

      // Verificar que la contraseña sea correcta intentando desencriptar la primera cuenta
      try {
        const testAccount = backup.accounts[0]
        await decrypt(testAccount.encryptedData, importPassword)
        setPasswordError(null)
      } catch (err) {
        setPasswordError('Contraseña incorrecta. Por favor verifica la contraseña que usaste al exportar el backup.')
        return
      }
    }

    setIsImporting(true)
    setError(null)
    setSuccess(null)
    setPasswordError(null)

    try {
      console.log('[BackupManager] Iniciando importación...')
      const result = await importBackup(backup, importOptions)
      console.log('[BackupManager] Importación completada:', result)
      setImportResult(result)

      // Si la contraseña es correcta y hay cuentas, desbloquear el keyring
      // Nota: No desbloquear aquí porque las cuentas ya están en IndexedDB
      // El usuario puede desbloquear después desde la pantalla de unlock
      // Solo refrescar el estado
      console.log('[BackupManager] Cuentas importadas, el usuario deberá desbloquear el keyring después')

      // Esperar un momento para asegurar que IndexedDB se haya actualizado completamente
      // después de que todas las transacciones se completen
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Refrescar datos en el keyring para actualizar el estado de React
      console.log('[BackupManager] Refrescando datos del keyring...')
      const hasAccounts = await refreshStoredAccounts()
      const hasWebAuthn = await refreshWebAuthnCredentials()
      console.log(`[BackupManager] Datos refrescados - hasAccounts: ${hasAccounts}, hasWebAuthn: ${hasWebAuthn}`)

      // Mostrar resumen
          const totalImported = 
            result.accountsImported +
            result.contactsImported +
            result.apiConfigsImported +
            result.webauthnImported +
            result.transactionsImported

          if (totalImported > 0) {
            const parts = [
              `${result.accountsImported} cuenta(s)`,
              `${result.contactsImported} contacto(s)`,
              `${result.apiConfigsImported} configuración(es) de API`,
              `${result.webauthnImported} credencial(es) WebAuthn`,
              `${result.transactionsImported} transacción(es)`,
            ]
            if (result.mountainLogsImported > 0) {
              parts.push(`${result.mountainLogsImported} bitácora(s)`)
            }
            if (result.documentsImported > 0) {
              parts.push(`${result.documentsImported} documento(s)`)
            }
            setSuccess(`Importación completada: ${parts.join(', ')}`)
      } else {
        setSuccess('No se importaron nuevos datos (puede que ya existan)')
      }

      if (result.errors.length > 0) {
        console.warn('[Backup] Errores durante la importación:', result.errors)
      }

      setIsDialogOpen(false)
      ;(window as any).__pendingBackup = undefined

      // Si se importaron cuentas, notificar al componente padre
      if (result.accountsImported > 0) {
        // Notificar al componente padre (si existe callback)
        if (onImportComplete) {
          onImportComplete()
        }
        
        // Esperar un poco más para asegurar que el estado se haya actualizado
        // y luego recargar la página para que el AuthGuard detecte las nuevas cuentas
        // y muestre automáticamente la pantalla de unlock
        setTimeout(() => {
          console.log('[BackupManager] Recargando página para que AuthGuard detecte las nuevas cuentas...')
          window.location.reload()
        }, 2000)
      }
    } catch (err) {
      console.error('[BackupManager] Error durante importación:', err)
      setError(err instanceof Error ? err.message : 'Error al importar backup')
    } finally {
      console.log('[BackupManager] Finalizando importación...')
      setIsImporting(false)
      setImportPassword('') // Limpiar contraseña después de importar
    }
  }

  const backup = (window as any).__pendingBackup as BackupData | undefined
  const backupDate = backup ? new Date(backup.createdAt).toLocaleString() : ''
  const accountsCount = backup?.accounts?.length || 0
  const contactsCount = backup?.contacts?.length || 0
  const apiConfigsCount = backup?.apiConfigs?.length || 0
  const webauthnCount = backup?.webauthnCredentials?.length || 0
  const mountainLogsCount = backup?.mountainLogs?.length || 0
  const documentsCount = backup?.documents?.length || 0
  const includesImages = backup?.metadata?.includesImages || false
  const includesPDFs = backup?.metadata?.includesPDFs || false

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Backup e Importación</h3>
        <p className="text-sm text-muted-foreground">
          Exporta o importa todos tus datos (cuentas, contactos, configuraciones)
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {importResult && importResult.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Errores durante la importación:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {importResult.errors.map((err, idx) => (
                <li key={idx} className="text-sm">{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Exportar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exportar Backup
            </CardTitle>
            <CardDescription>
              Descarga un archivo JSON con todos tus datos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Opciones de exportación</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeImages"
                    checked={exportOptions.includeImages}
                    onCheckedChange={(checked) =>
                      setExportOptions({ ...exportOptions, includeImages: checked === true })
                    }
                  />
                  <Label htmlFor="includeImages" className="text-sm font-normal cursor-pointer">
                    Incluir imágenes completas (base64)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includePDFs"
                    checked={exportOptions.includePDFs}
                    onCheckedChange={(checked) =>
                      setExportOptions({ ...exportOptions, includePDFs: checked === true })
                    }
                  />
                  <Label htmlFor="includePDFs" className="text-sm font-normal cursor-pointer">
                    Incluir PDFs completos (base64)
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Por defecto solo se incluye metadata (archivo más pequeño). 
                Marca estas opciones para incluir imágenes y PDFs completos (archivo más grande).
              </p>
            </div>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <Download className="mr-2 h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Backup
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              El archivo incluirá: cuentas, credenciales WebAuthn, contactos, configuraciones de API, 
              bitácoras y documentos {exportOptions.includeImages || exportOptions.includePDFs ? '(con imágenes/PDFs)' : '(solo metadata)'}
            </p>
          </CardContent>
        </Card>

        {/* Importar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Backup
            </CardTitle>
            <CardDescription>
              Restaura datos desde un archivo de backup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              variant="outline"
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar Archivo
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Selecciona un archivo JSON de backup para restaurar tus datos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Diálogo de confirmación de importación */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto mx-4 sm:mx-0">
          <DialogHeader>
            <DialogTitle>Confirmar Importación</DialogTitle>
            <DialogDescription>
              Revisa los datos que se importarán y selecciona las opciones
            </DialogDescription>
          </DialogHeader>

          {backup && (
            <div className="space-y-4 py-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Información del Backup:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Fecha de creación: {backupDate}</li>
                    <li>Versión: {backup.version}</li>
                    <li>Cuentas: {accountsCount}</li>
                    <li>Contactos: {contactsCount}</li>
                    <li>Configuraciones de API: {apiConfigsCount}</li>
                    <li>Credenciales WebAuthn: {webauthnCount}</li>
                    {mountainLogsCount > 0 && (
                      <li>Bitácoras: {mountainLogsCount} {includesImages ? '(con imágenes)' : '(solo metadata)'}</li>
                    )}
                    {documentsCount > 0 && (
                      <li>Documentos: {documentsCount} {includesPDFs ? '(con PDFs)' : '(solo metadata)'}</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Opciones de Importación</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Selecciona qué datos sobrescribir si ya existen
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="overwriteAccounts"
                      checked={importOptions.overwriteAccounts}
                      onCheckedChange={(checked) =>
                        setImportOptions({ ...importOptions, overwriteAccounts: checked === true })
                      }
                    />
                    <Label htmlFor="overwriteAccounts" className="cursor-pointer">
                      Sobrescribir cuentas existentes ({accountsCount} cuenta(s))
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="overwriteContacts"
                      checked={importOptions.overwriteContacts}
                      onCheckedChange={(checked) =>
                        setImportOptions({ ...importOptions, overwriteContacts: checked === true })
                      }
                    />
                    <Label htmlFor="overwriteContacts" className="cursor-pointer">
                      Sobrescribir contactos existentes ({contactsCount} contacto(s))
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="overwriteApiConfigs"
                      checked={importOptions.overwriteApiConfigs}
                      onCheckedChange={(checked) =>
                        setImportOptions({ ...importOptions, overwriteApiConfigs: checked === true })
                      }
                    />
                    <Label htmlFor="overwriteApiConfigs" className="cursor-pointer">
                      Sobrescribir configuraciones de API ({apiConfigsCount} configuración(es))
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="overwriteWebAuthn"
                      checked={importOptions.overwriteWebAuthn}
                      onCheckedChange={(checked) =>
                        setImportOptions({ ...importOptions, overwriteWebAuthn: checked === true })
                      }
                    />
                    <Label htmlFor="overwriteWebAuthn" className="cursor-pointer">
                      Sobrescribir credenciales WebAuthn ({webauthnCount} credencial(es))
                    </Label>
                  </div>

                  {mountainLogsCount > 0 && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="overwriteMountainLogs"
                        checked={importOptions.overwriteMountainLogs}
                        onCheckedChange={(checked) =>
                          setImportOptions({ ...importOptions, overwriteMountainLogs: checked === true })
                        }
                      />
                      <Label htmlFor="overwriteMountainLogs" className="cursor-pointer">
                        Sobrescribir bitácoras existentes ({mountainLogsCount} bitácora(s))
                      </Label>
                    </div>
                  )}

                  {documentsCount > 0 && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="overwriteDocuments"
                        checked={importOptions.overwriteDocuments}
                        onCheckedChange={(checked) =>
                          setImportOptions({ ...importOptions, overwriteDocuments: checked === true })
                        }
                      />
                      <Label htmlFor="overwriteDocuments" className="cursor-pointer">
                        Sobrescribir documentos existentes ({documentsCount} documento(s))
                      </Label>
                    </div>
                  )}
                </div>

                {/* Campo de contraseña si hay cuentas en el backup */}
                {backup.accounts && backup.accounts.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="importPassword">Contraseña del Backup *</Label>
                    <div className="relative">
                      <Input
                        id="importPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={importPassword}
                        onChange={(e) => {
                          setImportPassword(e.target.value)
                          setPasswordError(null)
                        }}
                        placeholder="Contraseña usada al exportar el backup"
                        className={passwordError ? 'border-destructive' : ''}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {passwordError && (
                      <p className="text-sm text-destructive">{passwordError}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Esta es la contraseña que usaste para proteger tus cuentas cuando las creaste o exportaste.
                      Se necesita para desencriptar y usar las cuentas importadas.
                    </p>
                  </div>
                )}

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Advertencia:</strong> Si no seleccionas "Sobrescribir", los datos existentes
                    se mantendrán y solo se importarán los nuevos. Si seleccionas "Sobrescribir", los datos
                    del backup reemplazarán los existentes.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                ;(window as any).__pendingBackup = undefined
                setIsImporting(false)
              }}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                isImporting || 
                (backup?.accounts && backup.accounts.length > 0 && !importPassword)
              }
            >
              {isImporting ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

