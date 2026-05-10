import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getDocument } from '@/utils/documentStorage'
import type { Document } from '@/types/documents'
import { documentEditorPath, inferCriteriaDomain } from '@/utils/documentListing'
import {
  documentScoreUiLabels,
  lastDocumentScoreFromChatHistory,
} from '@/utils/agentDocumentScore'
import { downloadPDF, base64ToBlobURL } from '@/utils/pdfUtils'
import {
  ArrowLeft,
  Download,
  Eye,
  FileCheck,
  FileText,
  Calendar,
  User,
  Hash,
  PenTool,
  Lock,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pencil,
  QrCode,
  Info,
} from 'lucide-react'
import { deleteDocument } from '@/utils/documentStorage'
import { toast } from 'sonner'
import SignatureSelector from '@/components/signatures/SignatureSelector'
import { useGuideAgent } from '@/hooks/useGuideAgent'
import { GuideModal } from '@/components/criteria/GuideModal'
import { decryptDocument } from '@/services/documents/DocumentEncryptor'
import { verifyDocument, verifySignature, type VerificationResult } from '@/services/signatures/SignatureVerifier'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QRCodeSVG } from 'qrcode.react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function DocumentDetail() {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [signDialogOpen, setSignDialogOpen] = useState(false)
  const [decryptDialogOpen, setDecryptDialogOpen] = useState(false)
  const [decryptPassword, setDecryptPassword] = useState('')
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptError, setDecryptError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const { showModal: showGuideModal, setShowModal: setShowGuideModal, triggerGuide, acknowledge } = useGuideAgent('sign-document')

  useEffect(() => {
    if (documentId) {
      loadDocument()
    }
  }, [documentId])

  useEffect(() => {
    // Limpiar URL del blob cuando el componente se desmonte
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])

  const loadDocument = async () => {
    if (!documentId) return

    try {
      setLoading(true)
      const doc = await getDocument(documentId)
      if (!doc) {
        toast.error('Documento no encontrado')
        navigate('/documents')
        return
      }

      setDocument(doc)

      // Si el documento está encriptado, solicitar contraseña
      if (doc.encrypted) {
        setDecryptDialogOpen(true)
        return
      }

      // Crear URL del blob para el visor
      if (doc.pdf) {
        try {
          // Verificar que el PDF no esté vacío
          if (!doc.pdf || doc.pdf.trim().length === 0) {
            console.error('PDF está vacío')
            toast.error('El PDF está vacío o corrupto')
            return
          }
          
          const url = base64ToBlobURL(doc.pdf)
          setPdfUrl(url)
        } catch (error) {
          console.error('Error al crear URL del PDF:', error)
          console.error('PDF base64 length:', doc.pdf?.length)
          console.error('PDF base64 preview:', doc.pdf?.substring(0, 100))
          toast.error('Error al cargar el PDF. Verifica la consola para más detalles.')
        }
      } else {
        console.warn('Documento no tiene PDF')
        toast.error('El documento no tiene PDF asociado')
      }
    } catch (error) {
      console.error('Error al cargar documento:', error)
      toast.error('Error al cargar el documento')
    } finally {
      setLoading(false)
    }
  }


  const handleSigned = async (updatedDocument: Document) => {
    setDocument(updatedDocument)
    setSignDialogOpen(false)
    // Recargar PDF si hay cambios
    if (updatedDocument.pdf) {
      try {
        const url = base64ToBlobURL(updatedDocument.pdf)
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl)
        }
        setPdfUrl(url)
      } catch (error) {
        console.error('Error al actualizar PDF:', error)
      }
    }
  }

  const handleDecrypt = async () => {
    if (!document || !decryptPassword.trim()) {
      setDecryptError('Por favor ingresa la contraseña')
      return
    }

    try {
      setIsDecrypting(true)
      setDecryptError(null)

      const decryptedDoc = await decryptDocument(document, decryptPassword)
      setDocument(decryptedDoc)

      // Crear URL del blob para el visor
      if (decryptedDoc.pdf) {
        const url = base64ToBlobURL(decryptedDoc.pdf)
        setPdfUrl(url)
      }

      setDecryptDialogOpen(false)
      setDecryptPassword('')
      toast.success('Documento desencriptado exitosamente')
    } catch (error) {
      console.error('Error al desencriptar:', error)
      setDecryptError(
        error instanceof Error ? error.message : 'Error al desencriptar el documento'
      )
    } finally {
      setIsDecrypting(false)
    }
  }

  const handleDownload = () => {
    if (!document || !document.pdf) {
      toast.error('El PDF no está disponible')
      return
    }

    // Si está encriptado, solicitar desencriptación primero
    if (document.encrypted) {
      setDecryptDialogOpen(true)
      toast.info('Por favor desencripta el documento primero')
      return
    }

    try {
      const filename = document.metadata.title || `documento-${document.documentId?.slice(0, 8) || 'unknown'}`
      downloadPDF(document.pdf, filename)
      toast.success('PDF descargado')
    } catch (error) {
      console.error('Error al descargar PDF:', error)
      toast.error('Error al descargar el PDF')
    }
  }

  const handleVerifyDocument = async () => {
    if (!document) return

    try {
      setIsVerifying(true)
      const result = await verifyDocument(document)
      setVerificationResult(result)
      setVerifyDialogOpen(true)

      // Actualizar estado de validación en las firmas
      if (document.signatures && result.details.signatures) {
        const updatedSignatures = document.signatures.map(sig => {
          const verification = result.details.signatures.find(v => v.signatureId === sig.id)
          return {
            ...sig,
            valid: verification?.valid,
            verifiedAt: Date.now(),
          }
        })
        setDocument({ ...document, signatures: updatedSignatures })
      }

      if (result.valid) {
        toast.success('Documento verificado: Todas las firmas son válidas')
      } else {
        toast.warning('Documento verificado: Se encontraron problemas')
      }
    } catch (error) {
      console.error('Error al verificar documento:', error)
      toast.error('Error al verificar el documento')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleVerifySignature = async (signatureId: string) => {
    if (!document) return

    try {
      setIsVerifying(true)
      const result = await verifySignature(document, signatureId)
      
      // Actualizar la firma específica
      if (document.signatures) {
        const updatedSignatures = document.signatures.map(sig => 
          sig.id === signatureId
            ? { ...sig, valid: result.valid, verifiedAt: Date.now() }
            : sig
        )
        setDocument({ ...document, signatures: updatedSignatures })
      }

      if (result.valid) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error('Error al verificar firma:', error)
      toast.error('Error al verificar la firma')
    } finally {
      setIsVerifying(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getTypeLabel = (type: Document['type']) => {
    switch (type) {
      case 'contract':
        return 'Contrato'
      case 'flight_log':
        return 'Registro de Vuelo'
      case 'medical_record':
        return 'Expediente Médico'
      case 'attestation':
        return 'Atestación'
      case 'generic':
        return 'Genérico'
      default:
        return 'Otro'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              Cargando documento...
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Documento no encontrado</h3>
              <Button className="mt-4" onClick={() => navigate('/documents')}>
                Volver a Documentos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const lastAgentScore = lastDocumentScoreFromChatHistory(document.chatHistory)
  const detailScoreLabels = documentScoreUiLabels(inferCriteriaDomain(document))
  const scoreRecordedAt =
    lastAgentScore && lastAgentScore.at > 0 ? lastAgentScore.at : document.updatedAt

  return (
    <div className="container mx-auto p-3 sm:p-4 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/documents')} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">
              {document.metadata.title || 'Documento sin título'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {getTypeLabel(document.type)}
              {document.category && ` • ${document.category}`}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          {pdfUrl && (
            <Button 
              variant="outline" 
              onClick={() => window.open(pdfUrl, '_blank')}
              className="flex-1 sm:flex-initial text-sm"
            >
              <Eye className="mr-2 h-4 w-4" />
              Ver PDF
            </Button>
          )}
          {!document.encrypted && (
            <Button 
              variant="outline"
              onClick={handleVerifyDocument}
              disabled={isVerifying}
              className="flex-1 sm:flex-initial text-sm"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {isVerifying ? 'Verificando...' : 'Verificar'}
            </Button>
          )}
          {!document.encrypted && (
            <Button 
              variant="outline"
              onClick={() => triggerGuide(() => setSignDialogOpen(true))}
              className="flex-1 sm:flex-initial text-sm"
            >
              <PenTool className="mr-2 h-4 w-4" />
              Firmar
            </Button>
          )}
          {!document.encrypted && (
            <Button
              variant="outline"
              onClick={() => navigate(documentEditorPath(document.documentId, document))}
              className="flex-1 sm:flex-initial text-sm"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
          {document.signedMetadata && (
            <Button
              variant="outline"
              onClick={() => setQrDialogOpen(true)}
              className="flex-1 sm:flex-initial text-sm"
            >
              <QrCode className="mr-2 h-4 w-4" />
              QR
            </Button>
          )}
          <Button onClick={handleDownload} className="flex-1 sm:flex-initial text-sm">
            <Download className="mr-2 h-4 w-4" />
            Descargar
          </Button>
          {document.encrypted && (
            <Button 
              variant="outline"
              onClick={() => setDecryptDialogOpen(true)}
              className="flex-1 sm:flex-initial text-sm"
            >
              <Lock className="mr-2 h-4 w-4" />
              Desencriptar
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            className="flex-1 sm:flex-initial text-sm text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </div>

      {lastAgentScore && (
        <Card className="border-primary/20 bg-primary/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-primary shrink-0" />
                {detailScoreLabels.panelTitle}
              </span>
              <Badge variant="secondary" className="font-normal tabular-nums">
                {formatDate(scoreRecordedAt)}
              </Badge>
            </CardTitle>
            <CardDescription>
              Última evaluación del agente registrada en este dispositivo (antes de abrir el editor).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={
                      lastAgentScore.score.score >= 70
                        ? '#22c55e'
                        : lastAgentScore.score.score >= 40
                          ? '#eab308'
                          : '#ef4444'
                    }
                    strokeWidth="3"
                    strokeDasharray={`${lastAgentScore.score.score}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums"
                  style={{
                    color:
                      lastAgentScore.score.score >= 70
                        ? '#22c55e'
                        : lastAgentScore.score.score >= 40
                          ? '#eab308'
                          : '#ef4444',
                  }}
                >
                  {lastAgentScore.score.score}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {detailScoreLabels.confidence}: {lastAgentScore.score.level}
                </p>
                {lastAgentScore.score.summary ? (
                  <p className="text-sm text-muted-foreground break-words">{lastAgentScore.score.summary}</p>
                ) : null}
                {(lastAgentScore.score.risks || []).length > 0 && (
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {detailScoreLabels.risksTitle}
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-0.5">
                      {(lastAgentScore.score.risks || []).slice(0, 8).map((r, i) => (
                        <li key={i} className="break-words">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {document.category === 'etherpad' && !document.encrypted && (
        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4" />
          <AlertTitle>Documento colaborativo (Etherpad)</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            El texto autoritativo vive en el pad. La vista previa muestra el último PDF guardado en este dispositivo.
            Abre <strong className="text-foreground font-medium">Editar</strong> y usa{' '}
            <strong className="text-foreground font-medium">Guardar local</strong> para actualizar lo que ves aquí y al
            descargar.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Información del Documento */}
        <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="flex items-start gap-2 text-xs sm:text-sm">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-muted-foreground">Tamaño: </span>
                  <span className="font-medium break-words">{formatFileSize(document.pdfSize)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs sm:text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-muted-foreground">Creado: </span>
                  <span className="font-medium break-words">{formatDate(document.createdAt)}</span>
                </div>
              </div>

              {document.metadata.author && (
                <div className="flex items-start gap-2 text-xs sm:text-sm">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground">Autor: </span>
                    <span className="font-medium break-words">{document.metadata.author}</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 text-xs sm:text-sm">
                <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-muted-foreground">Hash: </span>
                  <span className="font-mono text-xs break-all">
                    {document.pdfHash ? `${document.pdfHash.slice(0, 16)}...` : 'N/A'}
                  </span>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Badge variant={document.encrypted ? 'default' : 'secondary'}>
                  {document.encrypted ? 'Encriptado' : 'No encriptado'}
                </Badge>
                {document.signatureStatus && (
                  <Badge
                    variant={
                      document.signatureStatus === 'fully_signed'
                        ? 'default'
                        : document.signatureStatus === 'pending'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {document.signatureStatus === 'fully_signed'
                      ? 'Firmado'
                      : document.signatureStatus === 'pending'
                      ? 'Pendiente'
                      : document.signatureStatus === 'partially_signed'
                      ? 'Parcial'
                      : document.signatureStatus === 'expired'
                      ? 'Expirado'
                      : 'Rechazado'}
                  </Badge>
                )}
              </div>

              {document.metadata.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs sm:text-sm font-medium mb-2">Descripción</p>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                      {document.metadata.description}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Firmas */}
          {document.signatures && document.signatures.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Firmas ({document.signatures.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {document.signatures.map((signature, index) => (
                  <div key={signature.id || index} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium break-all text-xs sm:text-sm">
                          {signature.type === 'substrate' && signature.signer
                            ? `${signature.signer?.slice(0, 10) || 'N/A'}...${signature.signer?.slice(-6) || ''}`
                            : signature.type === 'autographic'
                            ? 'Firma Autográfica'
                            : signature.type === 'x509'
                            ? 'Firma X.509'
                            : signature.type === 'hybrid'
                            ? 'Firma Híbrida'
                            : 'Firma Desconocida'}
                        </div>
                        <div className="text-muted-foreground text-xs mt-1">
                          {formatDate(signature.timestamp)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {signature.valid !== undefined ? (
                          signature.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {signature.type === 'substrate'
                          ? 'Digital'
                          : signature.type === 'autographic'
                          ? 'Autográfica'
                          : signature.type === 'x509'
                          ? 'X.509'
                          : signature.type === 'hybrid'
                          ? 'Híbrida'
                          : 'Desconocida'}
                      </Badge>
                      {signature.valid !== undefined && (
                        <Badge
                          variant={signature.valid ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {signature.valid ? 'Válida' : 'Inválida'}
                        </Badge>
                      )}
                      {signature.valid === undefined && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerifySignature(signature.id)}
                          disabled={isVerifying}
                          className="h-6 text-xs px-2"
                        >
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          Verificar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Visor de PDF */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Vista Previa</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {pdfUrl ? (
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    src={pdfUrl}
                    className="w-full h-[400px] sm:h-[500px] md:h-[600px] lg:h-[800px]"
                    title="Vista previa del PDF"
                  />
                </div>
              ) : (
                <div className="py-8 sm:py-12 text-center text-muted-foreground px-4">
                  <FileText className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">El PDF no está disponible para visualización</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog para desencriptar */}
      {document && document.encrypted && (
        <Dialog open={decryptDialogOpen} onOpenChange={setDecryptDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Desencriptar Documento</DialogTitle>
              <DialogDescription>
                Este documento está encriptado. Ingresa la contraseña para desencriptarlo y visualizarlo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="decrypt-password">Contraseña *</Label>
                <Input
                  id="decrypt-password"
                  type="password"
                  value={decryptPassword}
                  onChange={(e) => {
                    setDecryptPassword(e.target.value)
                    setDecryptError(null)
                  }}
                  placeholder="Contraseña de encriptación"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isDecrypting) {
                      handleDecrypt()
                    }
                  }}
                  disabled={isDecrypting}
                />
                {decryptError && (
                  <p className="text-sm text-destructive">{decryptError}</p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDecryptDialogOpen(false)
                    setDecryptPassword('')
                    setDecryptError(null)
                    navigate('/documents')
                  }}
                  disabled={isDecrypting}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDecrypt}
                  disabled={isDecrypting || !decryptPassword.trim()}
                >
                  {isDecrypting ? 'Desencriptando...' : 'Desencriptar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para eliminar */}
      {document && (
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Eliminar Documento</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar el documento "{document.metadata.title || 'sin título'}"? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!document) return
                  try {
                    setIsDeleting(true)
                    await deleteDocument(document.documentId)
                    toast.success('Documento eliminado exitosamente')
                    navigate('/documents')
                  } catch (error) {
                    console.error('Error al eliminar documento:', error)
                    toast.error('Error al eliminar el documento')
                  } finally {
                    setIsDeleting(false)
                    setDeleteDialogOpen(false)
                  }
                }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para verificar documento */}
      {verificationResult && (
        <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {verificationResult.valid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Verificación Exitosa
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    Verificación Fallida
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                Resultados de la verificación del documento
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Integridad */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Integridad del Documento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {verificationResult.details.integrity.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm">{verificationResult.details.integrity.message}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Firmas */}
              {verificationResult.details.signatures.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Firmas ({verificationResult.details.signatures.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {verificationResult.details.signatures.map((sigResult) => {
                      const signature = document?.signatures?.find(s => s.id === sigResult.signatureId)
                      return (
                        <div key={sigResult.signatureId} className="p-2 border rounded space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {sigResult.valid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="text-sm font-medium">
                                {sigResult.type === 'substrate' ? 'Firma Digital' :
                                 sigResult.type === 'autographic' ? 'Firma Autográfica' :
                                 sigResult.type === 'x509' ? 'Firma X.509' :
                                 sigResult.type === 'hybrid' ? 'Firma Híbrida' :
                                 'Firma Desconocida'}
                              </span>
                            </div>
                            <Badge variant={sigResult.valid ? 'default' : 'destructive'} className="text-xs">
                              {sigResult.valid ? 'Válida' : 'Inválida'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground ml-6">{sigResult.message}</p>
                          {signature?.signer && (
                            <p className="text-xs text-muted-foreground ml-6 break-all">
                              Firmante: {signature.signer}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Errores */}
              {verificationResult.errors.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-destructive">Errores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {verificationResult.errors.map((error, index) => (
                        <li key={index} className="text-sm text-destructive flex items-start gap-2">
                          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Advertencias */}
              {verificationResult.warnings.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-yellow-600">Advertencias</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {verificationResult.warnings.map((warning, index) => (
                        <li key={index} className="text-sm text-yellow-600 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setVerifyDialogOpen(false)}>
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Agente Guía — antes de firmar */}
      <GuideModal
        open={showGuideModal}
        onOpenChange={setShowGuideModal}
        actionType="sign-document"
        onAcknowledged={acknowledge}
        payloadSummary={document ? `documento "${document.metadata.title || 'sin título'}", hash, autor, fecha` : undefined}
      />

      {/* Dialog para firmar */}
      {document && !document.encrypted && (
        <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Firmar Documento</DialogTitle>
              <DialogDescription>
                Selecciona el tipo de firma que deseas aplicar al documento
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <SignatureSelector
                document={document}
                onSigned={handleSigned}
                onCancel={() => setSignDialogOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog QR para verificación */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR para verificación</DialogTitle>
            <DialogDescription>
              Escanea este QR para obtener la metadata firmada. Luego sube el PDF en Verificar procedencia.
            </DialogDescription>
          </DialogHeader>
          {document?.signedMetadata && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={JSON.stringify({ signedMetadata: document.signedMetadata })}
                  size={200}
                  level="M"
                />
              </div>
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>Incluye: contentHash, autor, fecha y firma.</p>
                <p>El verificador debe subir el PDF además de escanear este QR.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

