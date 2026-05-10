/**
 * Componente para capturar fotos desde la cámara
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, X, RotateCw } from 'lucide-react'
import { toast } from 'sonner'

export interface PhotoCaptureProps {
  onCapture: (photoBase64: string) => void
  onCancel: () => void
}

export default function PhotoCapture({ onCapture, onCancel }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [isCapturing, setIsCapturing] = useState(false)

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [facingMode])

  const startCamera = async () => {
    try {
      // Detener stream anterior si existe
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error('Error al acceder a la cámara:', error)
      toast.error('No se pudo acceder a la cámara. Verifica los permisos.')
      onCancel()
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    try {
      setIsCapturing(true)
      const video = videoRef.current
      const canvas = canvasRef.current

      // Configurar dimensiones del canvas
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Capturar frame
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('No se pudo obtener contexto del canvas')
      }

      ctx.drawImage(video, 0, 0)

      // Convertir a base64
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.9)
      onCapture(photoBase64)

      // Detener cámara
      stopCamera()
    } catch (error) {
      console.error('Error al capturar foto:', error)
      toast.error('Error al capturar la foto')
    } finally {
      setIsCapturing(false)
    }
  }, [onCapture])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capturar Foto</CardTitle>
        <CardDescription>
          Posiciona la cámara y captura la foto que deseas agregar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative border rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto max-h-[400px] object-contain"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={switchCamera}
            className="flex-1 sm:flex-initial"
            disabled={isCapturing}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Cambiar Cámara
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 sm:flex-initial"
            disabled={isCapturing}
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button
            onClick={capturePhoto}
            disabled={isCapturing || !stream}
            className="flex-1 sm:flex-initial"
          >
            <Camera className="mr-2 h-4 w-4" />
            {isCapturing ? 'Capturando...' : 'Capturar Foto'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

