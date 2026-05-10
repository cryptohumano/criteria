/**
 * Página para generar bitácoras de ejemplo (seed)
 * Solo para desarrollo/testing
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, AlertCircle, Mountain } from 'lucide-react'
import { seedMountainLogs } from '@/utils/seedMountainLogs'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { toast } from 'sonner'

export default function SeedMountainLogs() {
  const { activeAccount } = useActiveAccount()
  const [count, setCount] = useState(10)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (count < 1 || count > 50) {
      setError('El número debe estar entre 1 y 50')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGenerated(false)

    try {
      const logs = await seedMountainLogs(count, activeAccount)
      setGenerated(true)
      toast.success(`${logs.length} bitácoras generadas exitosamente`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      toast.error(`Error al generar bitácoras: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Mountain className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          Generar Bitácoras de Ejemplo
        </h1>
        <p className="text-muted-foreground mt-2">
          Genera bitácoras de ejemplo con ubicaciones variadas en Chile para testing
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración del Seed</CardTitle>
          <CardDescription>
            Genera bitácoras con datos realistas incluyendo rutas GPS, milestones y avisos de salida
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="count">Número de bitácoras a generar</Label>
            <Input
              id="count"
              type="number"
              min="1"
              max="50"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              Entre 1 y 50 bitácoras. Se distribuirán entre 10 montañas diferentes de Chile.
            </p>
          </div>

          {activeAccount && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Las bitácoras se asociarán a la cuenta activa: {activeAccount.substring(0, 10)}...
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {generated && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Bitácoras generadas exitosamente. Puedes verlas en el mapa del Home.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generando bitácoras...
              </>
            ) : (
              <>
                <Mountain className="mr-2 h-4 w-4" />
                Generar Bitácoras
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Las bitácoras generadas incluyen:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Ubicaciones GPS reales de montañas en Chile</li>
            <li>Rutas con puntos GPS simulados</li>
            <li>Milestones (inicio, campamento, cumbre)</li>
            <li>Avisos de salida completos</li>
            <li>Estadísticas de distancia y elevación</li>
            <li>Diferentes estados (borrador, en progreso, completada)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
