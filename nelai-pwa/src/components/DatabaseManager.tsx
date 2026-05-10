import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Database, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { deleteAllAppData, getStorageInfo } from '@/utils/dataCleanup'
import { useNavigate } from 'react-router-dom'
import { useKeyringContext } from '@/contexts/KeyringContext'

export function DatabaseManager() {
  const navigate = useNavigate()
  const { lock } = useKeyringContext()
  const [storageInfo, setStorageInfo] = useState<{
    databases: Array<{ name: string; version: number }>
    localStorageKeys: string[]
    sessionStorageKeys: string[]
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const CONFIRM_TEXT = 'ELIMINAR TODO'

  const loadStorageInfo = async () => {
    setIsRefreshing(true)
    try {
      const info = await getStorageInfo()
      setStorageInfo(info)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar información')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadStorageInfo()
  }, [])

  const handleDeleteAll = async () => {
    if (confirmText !== CONFIRM_TEXT) {
      setError(`Por favor escribe "${CONFIRM_TEXT}" para confirmar`)
      return
    }

    setIsDeleting(true)
    setError(null)
    setSuccess(null)

    try {
      // Bloquear el keyring primero para limpiar el estado
      lock()

      // Eliminar todos los datos
      await deleteAllAppData()

      setSuccess('Todos los datos han sido eliminados exitosamente')
      setIsDialogOpen(false)
      setConfirmText('')

      // Redirigir al onboarding después de 2 segundos
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar los datos')
    } finally {
      setIsDeleting(false)
    }
  }

  const totalItems = 
    (storageInfo?.databases.length || 0) +
    (storageInfo?.localStorageKeys.length || 0) +
    (storageInfo?.sessionStorageKeys.length || 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Datos Almacenados</h3>
          <p className="text-sm text-muted-foreground">
            Información sobre los datos almacenados localmente
          </p>
        </div>
        <Button variant="outline" onClick={loadStorageInfo} disabled={isRefreshing}>
          {isRefreshing ? 'Actualizando...' : 'Actualizar'}
        </Button>
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

      {storageInfo && (
        <div className="space-y-3">
          {/* Bases de datos IndexedDB */}
          {storageInfo.databases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Bases de Datos IndexedDB ({storageInfo.databases.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {storageInfo.databases.map((db, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="text-sm font-medium">{db.name}</p>
                        <p className="text-xs text-muted-foreground">Versión: {db.version}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* localStorage */}
          {storageInfo.localStorageKeys.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">localStorage ({storageInfo.localStorageKeys.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {storageInfo.localStorageKeys.map((key, index) => (
                    <p key={index} className="text-xs text-muted-foreground font-mono">
                      {key}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* sessionStorage */}
          {storageInfo.sessionStorageKeys.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">sessionStorage ({storageInfo.sessionStorageKeys.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {storageInfo.sessionStorageKeys.map((key, index) => (
                    <p key={index} className="text-xs text-muted-foreground font-mono">
                      {key}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {totalItems === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No hay datos almacenados localmente
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Botón para eliminar todo */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Zona de Peligro
          </CardTitle>
          <CardDescription>
            Eliminar todos los datos almacenados localmente. Esta acción es IRREVERSIBLE.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Advertencia:</strong> Esta acción eliminará:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Todas tus cuentas y claves privadas</li>
                <li>Todas las credenciales WebAuthn</li>
                <li>Todos los contactos</li>
                <li>Todas las configuraciones de APIs</li>
                <li>Todos los datos almacenados en IndexedDB</li>
                <li>Todos los datos en localStorage y sessionStorage</li>
              </ul>
              <p className="mt-2">
                <strong>No podrás recuperar estos datos a menos que tengas tus frases de recuperación (mnemonic).</strong>
              </p>
            </AlertDescription>
          </Alert>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Todos los Datos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto mx-4 sm:mx-0">
              <DialogHeader>
                <DialogTitle className="text-destructive">Confirmar Eliminación</DialogTitle>
                <DialogDescription>
                  Esta acción es IRREVERSIBLE. Todos tus datos serán eliminados permanentemente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Última advertencia:</strong> Esta acción eliminará todos tus datos
                    y te redirigirá al onboarding. Solo hazlo si estás seguro.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="confirm">
                    Escribe <strong>{CONFIRM_TEXT}</strong> para confirmar:
                  </Label>
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRM_TEXT}
                    className="font-mono"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setConfirmText('')
                    setError(null)
                  }}
                  disabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAll}
                  disabled={isDeleting || confirmText !== CONFIRM_TEXT}
                >
                  {isDeleting ? (
                    <>
                      <Trash2 className="mr-2 h-4 w-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Todo
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}

