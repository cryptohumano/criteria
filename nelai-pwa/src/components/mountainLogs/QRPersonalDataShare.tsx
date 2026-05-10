/**
 * Componente para compartir datos personales vía QR
 */

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QrCode, Download, Copy, Check } from 'lucide-react'
import { generatePersonalDataQR, qrDataToJSON, extractPersonalDataFromAvisoSalida, fitsInQR } from '@/utils/qrSharing'
import type { MountainLog } from '@/types/mountainLogs'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { toast } from 'sonner'

interface QRPersonalDataShareProps {
  log: MountainLog
}

export function QRPersonalDataShare({ log }: QRPersonalDataShareProps) {
  const { accounts } = useKeyringContext()
  const [qrData, setQrData] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generateQR = () => {
    if (!log.avisoSalida?.guia) {
      toast.error('No hay datos personales para compartir')
      return
    }

    const personalInfo = extractPersonalDataFromAvisoSalida(log.avisoSalida)
    if (!personalInfo) {
      toast.error('No se pudieron extraer los datos personales')
      return
    }

    // Obtener cuenta Substrate activa si existe
    const activeAccount = log.relatedAccount || accounts[0]?.address

    const qrPersonalData = generatePersonalDataQR(
      personalInfo,
      log.avisoSalida.contactosEmergencia,
      activeAccount
    )

    if (!fitsInQR(qrPersonalData)) {
      toast.error('Los datos son demasiado grandes para un QR. Por favor, reduce la información.')
      return
    }

    const jsonString = qrDataToJSON(qrPersonalData)
    setQrData(jsonString)
    toast.success('QR generado exitosamente')
  }

  const handleCopy = async () => {
    if (!qrData) return

    try {
      await navigator.clipboard.writeText(qrData)
      setCopied(true)
      toast.success('Datos copiados al portapapeles')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Error al copiar:', error)
      toast.error('Error al copiar datos')
    }
  }

  const handleDownload = () => {
    if (!qrData) return

    const blob = new Blob([qrData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `datos-personales-${log.logId}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Datos descargados')
  }

  if (!qrData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Compartir Datos Personales
          </CardTitle>
          <CardDescription>
            Genera un QR con tus datos personales para que otros participantes puedan llenar automáticamente sus formularios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generateQR} className="w-full">
            <QrCode className="h-4 w-4 mr-2" />
            Generar QR de Datos Personales
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR de Datos Personales
        </CardTitle>
        <CardDescription>
          Escanea este QR con otra PWA para importar automáticamente los datos personales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center p-4 bg-white rounded-lg border">
          <QRCodeSVG
            value={qrData}
            size={256}
            level="M"
            includeMargin={true}
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="flex-1"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copiar JSON
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
          <Button
            variant="outline"
            onClick={() => setQrData(null)}
            className="flex-1"
          >
            Regenerar
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground text-center">
          <p>Este QR contiene tus datos personales del aviso de salida.</p>
          <p>Otros participantes pueden escanearlo para auto-llenar sus formularios.</p>
        </div>
      </CardContent>
    </Card>
  )
}
