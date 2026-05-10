/**
 * Verificar procedencia — Agente Verificador Nelai
 * Sube archivo + metadata (JSON) y obtén un reporte de verificación.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ShieldCheck, ShieldAlert, ShieldX, Upload, FileJson, QrCode, Camera, X, Link2 } from 'lucide-react'
import { verifyEvidence } from '@/services/criteria/evidenceVerification'
import { getAssetFromDKG, summarizeDkgAssertions, getDkgConfig } from '@/services/criteria/dkgPublish'
import { readC2paManifest, type C2paManifestInfo } from '@/services/c2pa/c2paReader'
import jsQR from 'jsqr'
import { toast } from 'sonner'

type VerificationStatus = 'idle' | 'verifying' | 'valid' | 'invalid' | 'error'
type VerifyMode = 'file' | 'ual'

export default function VerifyProcedence() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<VerifyMode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [jsonInput, setJsonInput] = useState('')
  const [ualInput, setUalInput] = useState('')
  const [status, setStatus] = useState<VerificationStatus>('idle')
  const [c2paInfo, setC2paInfo] = useState<C2paManifestInfo | null>(null)

  const hasLoadedFromState = useRef(false)
  useEffect(() => {
    if (hasLoadedFromState.current) return
    const state = location.state as { imageData?: string; signedMetadata?: unknown; filename?: string; mimeType?: string } | null
    if (!state?.imageData || !state?.signedMetadata) return
    hasLoadedFromState.current = true
    try {
      const base64 = state.imageData.includes(',') ? state.imageData.split(',')[1] : state.imageData
      const binary = atob(base64)
      const arr = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
      const blob = new Blob([arr], { type: state.mimeType || 'image/jpeg' })
      const f = new File([blob], state.filename || 'imagen.jpg', { type: state.mimeType || 'image/jpeg' })
      setFile(f)
      setJsonInput(JSON.stringify({ signedMetadata: state.signedMetadata }, null, 2))
      navigate(location.pathname, { replace: true, state: {} })
    } catch (e) {
      console.warn('[VerifyProcedence] Error al cargar imagen desde state:', e)
    }
  }, [location.state, location.pathname, navigate])
  const [showCameraScan, setShowCameraScan] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  const [result, setResult] = useState<{
    integrityValid: boolean
    signatureValid: boolean
    valid: boolean
    report: string
    signer?: string
    createdAt?: string
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f || null)
    setStatus('idle')
    setResult(null)
  }

  const handleVerify = async () => {
    if (mode === 'ual') {
      const ual = ualInput.trim()
      if (!ual) {
        toast.error('Pega un UAL para verificar')
        return
      }
      if (!getDkgConfig()) {
        toast.error('Configura DKG en Configuración > DKG para consultar por UAL')
        return
      }

      setStatus('verifying')
      setResult(null)

      try {
        const { assertion } = await getAssetFromDKG(ual)
        const summary = summarizeDkgAssertions(assertion ?? [])
        setResult({
          integrityValid: true,
          signatureValid: true,
          valid: true,
          report: summary.report,
          signer: summary.author,
          createdAt: summary.createdAt,
        })
        setStatus('valid')
      } catch (err) {
        console.error('[VerifyProcedence] Error DKG:', err)
        setStatus('error')
        setResult({
          integrityValid: false,
          signatureValid: false,
          valid: false,
          report: `Error al consultar DKG: ${err instanceof Error ? err.message : 'Error desconocido'}`,
        })
        toast.error('Error al consultar DKG')
      }
      return
    }

    if (!file) {
      toast.error('Sube un archivo para verificar')
      return
    }

    let signedMetadata: { metadata: Record<string, unknown>; signature: string; signer: string }
    try {
      const parsed = JSON.parse(jsonInput.trim() || '{}')
      if (parsed.signedMetadata) {
        signedMetadata = parsed.signedMetadata
      } else if (parsed.metadata && parsed.signature && parsed.signer) {
        signedMetadata = {
          metadata: parsed.metadata,
          signature: parsed.signature,
          signer: parsed.signer,
        }
      } else if (parsed.metadata && parsed.signature !== undefined) {
        signedMetadata = {
          metadata: parsed.metadata,
          signature: parsed.signature,
          signer: parsed.signer || parsed.metadata?.author || '',
        }
      } else {
        toast.error('El JSON debe incluir signedMetadata o (metadata, signature, signer)')
        return
      }
    } catch {
      toast.error('JSON inválido. Pega el metadata firmado o sube un archivo .json')
      return
    }

    setStatus('verifying')
    setResult(null)
    setC2paInfo(null)

    try {
      const buffer = await file.arrayBuffer()
      const res = await verifyEvidence(buffer, signedMetadata)
      setResult(res)
      setStatus(res.valid ? 'valid' : 'invalid')

      // Intentar leer manifiesto C2PA si el archivo lo tiene
      try {
        const blob = new Blob([buffer], { type: file.type })
        const manifest = await readC2paManifest(blob)
        if (manifest?.hasManifest) setC2paInfo(manifest)
      } catch {
        // Ignorar errores de lectura C2PA
      }
    } catch (err) {
      console.error('[VerifyProcedence] Error:', err)
      setStatus('error')
      setResult({
        integrityValid: false,
        signatureValid: false,
        valid: false,
        report: `Error al verificar: ${err instanceof Error ? err.message : 'Error desconocido'}`,
      })
      toast.error('Error al verificar')
    }
  }

  const handleQRImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) {
      e.target.value = ''
      return
    }
    try {
      if ('BarcodeDetector' in window) {
        const bitmap = await createImageBitmap(f)
        const detector = new (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => { detect: (img: ImageBitmap) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] })
        const barcodes = await detector.detect(bitmap)
        if (barcodes.length > 0) {
          const raw = (barcodes[0] as { rawValue: string }).rawValue
          processQRData(raw)
          e.target.value = ''
          return
        }
      }
      const img = await createImageBitmap(f)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        toast.error('No se pudo procesar la imagen')
        e.target.value = ''
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        processQRData(code.data)
      } else {
        toast.error('No se detectó un QR en la imagen')
      }
    } catch (err) {
      console.error('[VerifyProcedence] Error al decodificar QR:', err)
      toast.error('No se pudo leer el QR. Intenta con otra imagen.')
    }
    e.target.value = ''
  }

  const processQRData = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw)
      const out = parsed.signedMetadata ? parsed : { signedMetadata: parsed }
      setJsonInput(JSON.stringify(out, null, 2))
      toast.success('Metadata obtenida del QR')
    } catch {
      setJsonInput(raw)
      toast.success('Contenido del QR cargado')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const videoCallbackRef = useCallback(
    (el: HTMLVideoElement | null) => {
      ;(videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
      if (!el) {
        stopCamera()
        return
      }
      if (!showCameraScan) return

      const useBarcodeDetector = 'BarcodeDetector' in window
      let mounted = true
      const BarcodeDetectorClass = useBarcodeDetector
        ? (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => { detect: (img: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
        : null
      const detector = BarcodeDetectorClass ? new BarcodeDetectorClass({ formats: ['qr_code'] }) : null

      const startCamera = async () => {
        if (!mounted) return
        try {
          let stream: MediaStream
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({ video: true })
          }
          if (!mounted) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          streamRef.current = stream
          el.srcObject = stream
          el.muted = true
          el.playsInline = true
          el.setAttribute('playsinline', '')
          el.setAttribute('webkit-playsinline', '')
          await el.play()

          const scanWithBarcodeDetector = async () => {
            if (!mounted || !el.srcObject || el.readyState < 2 || !detector) return
            try {
              const barcodes = await detector.detect(el)
              if (barcodes.length > 0) {
                const raw = (barcodes[0] as { rawValue: string }).rawValue
                stopCamera()
                processQRData(raw)
                setShowCameraScan(false)
                return
              }
            } catch {
              // ignore
            }
            animationRef.current = requestAnimationFrame(scanWithBarcodeDetector)
          }

          const scanWithJsQR = () => {
            if (!mounted || !el.srcObject || el.readyState < 2 || el.videoWidth === 0) return
            const canvas = document.createElement('canvas')
            canvas.width = el.videoWidth
            canvas.height = el.videoHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            ctx.drawImage(el, 0, 0)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(imageData.data, imageData.width, imageData.height)
            if (code) {
              stopCamera()
              processQRData(code.data)
              setShowCameraScan(false)
              return
            }
            animationRef.current = requestAnimationFrame(scanWithJsQR)
          }

          if (useBarcodeDetector && detector) {
            scanWithBarcodeDetector()
          } else {
            scanWithJsQR()
          }
        } catch (err) {
          console.error('[VerifyProcedence] Error al acceder a la cámara:', err)
          toast.error('No se pudo acceder a la cámara. Revisa los permisos.')
          setShowCameraScan(false)
        }
      }
      startCamera()
    },
    [showCameraScan, processQRData, stopCamera]
  )

  useEffect(() => {
    if (!showCameraScan) {
      stopCamera()
    }
  }, [showCameraScan, stopCamera])

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setJsonInput(String(reader.result))
        toast.success('JSON cargado')
      } catch {
        toast.error('No se pudo leer el archivo JSON')
      }
    }
    reader.readAsText(f)
    e.target.value = ''
  }

  const formatReport = (text: string) => {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  }

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verificar procedencia</h1>
        <p className="text-muted-foreground mt-1">
          Sube un archivo y su metadata firmada para comprobar integridad y autenticidad.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Archivo y metadata / UAL
          </CardTitle>
          <CardDescription>
            Verifica por archivo + metadata firmada, o consulta por UAL (DKG).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={mode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setMode('file'); setStatus('idle'); setResult(null) }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Archivo + metadata
            </Button>
            <Button
              variant={mode === 'ual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setMode('ual'); setStatus('idle'); setResult(null) }}
            >
              <Link2 className="h-4 w-4 mr-2" />
              UAL (DKG)
            </Button>
          </div>

          {mode === 'ual' ? (
            <div className="space-y-2">
              <Label htmlFor="ual">UAL (Uniform Asset Locator)</Label>
              <Textarea
                id="ual"
                placeholder="did:dkg:base:84532/0x.../..."
                value={ualInput}
                onChange={(e) => {
                  setUalInput(e.target.value)
                  setStatus('idle')
                }}
                rows={2}
                className="font-mono text-xs"
              />
              {!getDkgConfig() && (
                <p className="text-xs text-amber-600">
                  Configura DKG en Configuración &gt; DKG para consultar por UAL.
                </p>
              )}
            </div>
          ) : (
            <>
          <div className="space-y-2">
            <Label htmlFor="file">Archivo</Label>
            <input
              id="file"
              type="file"
              accept="image/*,application/pdf,.json"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="json">Metadata firmada (JSON)</Label>
              <div className="flex flex-wrap gap-1">
                <input
                  id="qr-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleQRImageUpload}
                  className="hidden"
                />
                <input
                  id="json-upload"
                  type="file"
                  accept=".json"
                  onChange={handleJsonFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowCameraScan(true)}
                  title="Escanear QR con la cámara"
                >
                  <Camera className="h-4 w-4 mr-1" />
                  Cámara
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => document.getElementById('qr-upload')?.click()}
                  title="Subir imagen de QR"
                >
                  <QrCode className="h-4 w-4 mr-1" />
                  Subir imagen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => document.getElementById('json-upload')?.click()}
                >
                  <FileJson className="h-4 w-4 mr-1" />
                  Subir JSON
                </Button>
              </div>
            </div>
            <Textarea
              id="json"
              placeholder='{"signedMetadata": {"metadata": {...}, "signature": "0x...", "signer": "5..."}}'
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value)
                setStatus('idle')
              }}
              rows={6}
              className="font-mono text-xs"
            />
          </div>
            </>
          )}

          <Button
            onClick={handleVerify}
            disabled={
              status === 'verifying' ||
              (mode === 'file' && (!file || !jsonInput.trim())) ||
              (mode === 'ual' && (!ualInput.trim() || !getDkgConfig()))
            }
            className="w-full"
          >
            {status === 'verifying' ? 'Verificando…' : 'Verificar'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card
          className={
            status === 'valid'
              ? 'border-green-500/50 bg-green-500/5'
              : status === 'invalid' || status === 'error'
                ? 'border-destructive/50 bg-destructive/5'
                : ''
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {status === 'valid' ? (
                <ShieldCheck className="h-5 w-5 text-green-600" />
              ) : status === 'invalid' || status === 'error' ? (
                <ShieldX className="h-5 w-5 text-destructive" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              )}
              Reporte de verificación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="text-sm prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: formatReport(result.report),
              }}
            />
            {result.signer && (
              <div className="pt-2 border-t text-xs">
                <span className="text-muted-foreground">Firmante: </span>
                <span className="font-mono break-all">{result.signer}</span>
              </div>
            )}
            {result.createdAt && (
              <div className="text-xs">
                <span className="text-muted-foreground">Fecha de firma: </span>
                <span>{result.createdAt}</span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <span
                className={`text-xs px-2 py-1 rounded ${
                  result.integrityValid ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-destructive/20 text-destructive'
                }`}
              >
                Integridad: {result.integrityValid ? 'válida' : 'no válida'}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  result.signatureValid ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-destructive/20 text-destructive'
                }`}
              >
                Firma: {result.signatureValid ? 'válida' : 'no válida'}
              </span>
            </div>
            {c2paInfo?.hasManifest && (
              <div className="pt-3 mt-3 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Content Credentials (C2PA)</p>
                <div className="text-xs space-y-1">
                  {c2paInfo.title && <p><span className="text-muted-foreground">Manifiesto:</span> {c2paInfo.title}</p>}
                  {c2paInfo.polkadotAssertion?.address && (
                    <p><span className="text-muted-foreground">Autor (Polkadot):</span> <span className="font-mono break-all">{c2paInfo.polkadotAssertion.address}</span></p>
                  )}
                  {c2paInfo.polkadotAssertion?.createdAt && (
                    <p><span className="text-muted-foreground">Fecha:</span> {c2paInfo.polkadotAssertion.createdAt}</p>
                  )}
                  {c2paInfo.validationStatus && (
                    <p className="text-muted-foreground">Estado: {c2paInfo.validationStatus}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showCameraScan} onOpenChange={(open) => {
        if (!open) {
          stopCamera()
          setShowCameraScan(false)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear QR con cámara</DialogTitle>
            <DialogDescription>
              Apunta la cámara al QR que contiene la metadata firmada.
            </DialogDescription>
          </DialogHeader>
          <div className="relative aspect-square max-h-[70vh] min-h-[200px] bg-black rounded-lg overflow-hidden">
            <video
              ref={videoCallbackRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ minHeight: 200 }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-white/50 rounded-lg" />
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              stopCamera()
              setShowCameraScan(false)
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
