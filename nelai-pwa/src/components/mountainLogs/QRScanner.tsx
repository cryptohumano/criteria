/**
 * Componente para escanear QR y importar datos
 */

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { QrCode, Scan, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { parseQRData, applyPersonalDataToAvisoSalida, type QRPersonalData } from '@/utils/qrSharing'
import type { MountainLog } from '@/types/mountainLogs'
import { toast } from 'sonner'

interface QRScannerProps {
  onDataScanned: (data: QRPersonalData) => void
  onCancel?: () => void
}

export function QRScanner({ onDataScanned, onCancel }: QRScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleScan = () => {
    setScanning(true)
    setError(null)
    
    // En una implementación completa, aquí se usaría una librería de escaneo de QR
    // Por ahora, mostramos un input manual y carga de archivo
    toast.info('Funcionalidad de escaneo de cámara en desarrollo. Usa la opción de pegar JSON o cargar archivo.')
  }

  const handleManualInput = () => {
    if (!manualInput.trim()) {
      setError('Por favor ingresa el JSON del QR')
      return
    }

    try {
      const qrData = parseQRData(manualInput)
      
      if (!qrData) {
        setError('Formato de datos inválido')
        return
      }

      if (qrData.type !== 'personal_data') {
        setError('Este QR no contiene datos personales')
        return
      }

      onDataScanned(qrData as QRPersonalData)
      setError(null)
      toast.success('Datos importados exitosamente')
    } catch (error) {
      console.error('Error al procesar datos:', error)
      setError('Error al procesar los datos. Verifica que el formato sea correcto.')
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setManualInput(content)
      handleManualInput()
    }
    reader.onerror = () => {
      setError('Error al leer el archivo')
    }
    reader.readAsText(file)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scan className="h-5 w-5" />
          Escanear QR de Datos Personales
        </CardTitle>
        <CardDescription>
          Escanea un QR o pega el JSON para importar datos personales automáticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Button
            onClick={handleScan}
            className="w-full"
            disabled={scanning}
          >
            <QrCode className="h-4 w-4 mr-2" />
            {scanning ? 'Escaneando...' : 'Escanear con Cámara'}
          </Button>
          
          <div className="text-xs text-muted-foreground text-center">
            O pega el JSON del QR aquí:
          </div>
          
          <Textarea
            value={manualInput}
            onChange={(e) => {
              setManualInput(e.target.value)
              setError(null)
            }}
            placeholder='{"version":"1.0.0","type":"personal_data",...}'
            className="font-mono text-xs"
            rows={6}
          />
          
          <Button
            onClick={handleManualInput}
            className="w-full"
            disabled={!manualInput.trim()}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Importar Datos
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">O</span>
          </div>
        </div>

        <div>
          <Input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Cargar Archivo JSON
          </Button>
        </div>

        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            className="w-full"
          >
            Cancelar
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
