import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Info,
  MapPin,
  Calendar,
  Camera,
  Image as ImageIcon,
  ShieldCheck,
  Database,
  Loader2
} from 'lucide-react'
import type { MountainLogImage } from '@/types/mountainLogs'
import { getImageSrc } from '@/utils/imageUtils'
import { publishEvidenceToDKG, getDkgConfig } from '@/services/criteria/dkgPublish'
import { getEthereumPrivateKeyForAccount } from '@/utils/evmKeyFromAccount'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { useGuideAgent } from '@/hooks/useGuideAgent'
import { GuideModal } from '@/components/criteria/GuideModal'
import { toast } from 'sonner'

interface ImageGalleryProps {
  images: MountainLogImage[]
  onDelete?: (imageId: string) => void
  onImageUpdate?: (imageId: string, updates: Partial<MountainLogImage>) => void
  canDelete?: boolean
}

export function ImageGallery({ images, onDelete, onImageUpdate, canDelete = true }: ImageGalleryProps) {
  const navigate = useNavigate()
  const { activeAccount } = useActiveAccount()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set())
  const [showMetadata, setShowMetadata] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [publishingDkg, setPublishingDkg] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [dkgPassword, setDkgPassword] = useState('')
  const { showModal: showGuideModal, setShowModal: setShowGuideModal, triggerGuide, acknowledge } = useGuideAgent('publish-dkg')

  if (images.length === 0) {
    return null
  }

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null

  const handlePrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const handleDelete = () => {
    if (selectedImage && onDelete) {
      onDelete(selectedImage.id)
      if (selectedIndex !== null) {
        if (selectedIndex >= images.length - 1 && selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1)
        } else if (images.length === 1) {
          setSelectedIndex(null)
        }
      }
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const doPublishDkg = async (img: MountainLogImage, evmPrivateKey?: string) => {
    if (!onImageUpdate || !img.signedMetadata) return
    setPublishingDkg(true)
    try {
      const { UAL } = await publishEvidenceToDKG(img.signedMetadata, { evmPrivateKey })
      onImageUpdate(img.id, { dkgUAL: UAL })
      toast.success('Publicado en DKG')
      setShowPasswordDialog(false)
      setDkgPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al publicar en DKG')
    } finally {
      setPublishingDkg(false)
    }
  }

  const handlePasswordSubmit = async () => {
    if (!activeAccount || !selectedImage || !dkgPassword.trim()) return
    try {
      const evmKey = await getEthereumPrivateKeyForAccount(activeAccount, dkgPassword)
      await doPublishDkg(selectedImage, evmKey)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al obtener la clave')
    }
  }

  return (
    <>
      {/* Grid de imágenes */}
      <div className="grid grid-cols-3 gap-2">
        {images.map((image, index) => {
          const src = getImageSrc(image.data, image.thumbnail, image.metadata.mimeType)
          const srcKey = src || image.id
          const failed = failedSrcs.has(srcKey)
          return (
          <div
            key={image.id}
            className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer group"
            onClick={() => setSelectedIndex(index)}
          >
            {src && !failed ? (
              <img
                src={src}
                alt={image.metadata.filename}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                onError={() => setFailedSrcs((prev) => new Set(prev).add(srcKey))}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
            {image.metadata.gpsMetadata && (
              <Badge 
                variant="secondary" 
                className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5"
              >
                <MapPin className="h-2.5 w-2.5 mr-1" />
                GPS
              </Badge>
            )}
            {(image.contentHash || image.signedMetadata) && (
              <Badge 
                variant="secondary" 
                className="absolute bottom-1 right-1 text-xs px-1.5 py-0.5 bg-primary/20 text-primary border-primary/30"
                title={image.dkgUAL ? 'Firmado y en DKG' : 'Contenido firmado'}
              >
                {image.dkgUAL ? <Database className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />}
              </Badge>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
              <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )})}
      </div>

      {/* Modal de imagen grande */}
      <Dialog open={selectedIndex !== null} onOpenChange={(open) => !open && setSelectedIndex(null)}>
        <DialogContent className="max-w-7xl max-h-[95vh] p-0 gap-0 bg-black/95 sm:p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Vista de Imagen</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Imagen principal */}
              <div className="relative w-full h-full flex items-center justify-center p-4 pb-20 sm:pb-4">
                {(() => {
                  const modalSrc = getImageSrc(selectedImage.data, selectedImage.thumbnail, selectedImage.metadata.mimeType)
                  return modalSrc ? (
                    <img
                      src={modalSrc}
                      alt={selectedImage.metadata.filename}
                      className="max-w-full max-h-[60vh] sm:max-h-[85vh] object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-16 w-16" />
                      <p>Imagen no disponible</p>
                    </div>
                  )
                })()}
              </div>

              {/* Botón cerrar */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 h-10 w-10 bg-black/50 hover:bg-black/70 text-white z-20"
                onClick={() => setSelectedIndex(null)}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Botón información/metadata */}
              <Button
                variant="ghost"
                size="icon"
                className={`absolute top-4 right-16 h-10 w-10 bg-black/50 hover:bg-black/70 text-white z-20 ${showMetadata ? 'bg-primary/80' : ''}`}
                onClick={() => setShowMetadata(!showMetadata)}
                title={showMetadata ? 'Ocultar información' : 'Mostrar información'}
              >
                <Info className="h-5 w-5" />
              </Button>

              {/* Botón eliminar */}
              {canDelete && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-28 h-10 w-10 bg-red-500/80 hover:bg-red-500 text-white z-20"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}

              {/* Navegación izquierda */}
              {selectedIndex !== null && selectedIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 h-12 w-12 bg-black/50 hover:bg-black/70 text-white z-20"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}

              {/* Navegación derecha */}
              {selectedIndex !== null && selectedIndex < images.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 h-12 w-12 bg-black/50 hover:bg-black/70 text-white z-20"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}

              {/* Contador de imágenes - Solo visible cuando metadata está cerrado */}
              {!showMetadata && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm z-20">
                  {selectedIndex !== null ? selectedIndex + 1 : 0} / {images.length}
                </div>
              )}

              {/* Panel de metadata */}
              {showMetadata && (
                <Card className="absolute bottom-0 left-0 right-0 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md bg-background/98 backdrop-blur-sm z-30 max-h-[80vh] sm:max-h-[60vh] overflow-hidden flex flex-col rounded-t-xl sm:rounded-lg shadow-2xl border-t-2 sm:border-t border-primary/20">
                  {/* Header sticky siempre visible */}
                  <div className="flex items-center justify-between p-4 pb-3 border-b bg-background/98 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
                    <h3 className="font-semibold flex items-center gap-2 text-base">
                      <Camera className="h-4 w-4" />
                      <span className="hidden sm:inline">Información de la Imagen</span>
                      <span className="sm:hidden">Info</span>
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowMetadata(false)}
                      className="h-9 w-9 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                      title="Cerrar información"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  {/* Contenido scrolleable */}
                  <CardContent className="p-4 pt-3 space-y-3 overflow-y-auto flex-1">

                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Nombre</p>
                        <p className="font-medium break-words">{selectedImage.metadata.filename}</p>
                      </div>

                      {selectedImage.metadata.mimeType && (
                        <div>
                          <p className="text-muted-foreground text-xs">Tipo de Archivo</p>
                          <p className="font-medium">{selectedImage.metadata.mimeType}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-muted-foreground text-xs">Fecha de Captura</p>
                          <p className="font-medium">{formatDate(selectedImage.metadata.capturedAt)}</p>
                        </div>
                      </div>

                      {selectedImage.metadata.width && selectedImage.metadata.height && (
                        <div>
                          <p className="text-muted-foreground text-xs">Dimensiones</p>
                          <p className="font-medium">
                            {selectedImage.metadata.width} × {selectedImage.metadata.height} px
                          </p>
                        </div>
                      )}

                      <div>
                        <p className="text-muted-foreground text-xs">Tamaño</p>
                        <p className="font-medium">{formatFileSize(selectedImage.metadata.size)}</p>
                      </div>

                      {(selectedImage.contentHash || selectedImage.signedMetadata) && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <p className="font-semibold text-sm">Contenido firmado</p>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {selectedImage.signedMetadata && (
                              <>
                                <div>
                                  <span className="text-muted-foreground">Firmado por: </span>
                                  <span className="font-mono break-all">{selectedImage.signedMetadata.signer}</span>
                                </div>
                                {selectedImage.signedMetadata.metadata && typeof selectedImage.signedMetadata.metadata === 'object' && 'createdAt' in selectedImage.signedMetadata.metadata && (
                                  <div>
                                    <span className="text-muted-foreground">Fecha de firma: </span>
                                    <span>
                                      {(() => {
                                        const createdAt = selectedImage.signedMetadata!.metadata.createdAt
                                        if (typeof createdAt === 'string') {
                                          const d = new Date(createdAt)
                                          return isNaN(d.getTime()) ? createdAt : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
                                        }
                                        return String(createdAt)
                                      })()}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                            {selectedImage.contentHash && (
                              <div className="pt-1">
                                <span className="text-muted-foreground">Hash de contenido: </span>
                                <span className="font-mono break-all text-[10px] block mt-0.5" title={selectedImage.contentHash}>
                                  {selectedImage.contentHash.slice(0, 18)}…{selectedImage.contentHash.slice(-10)}
                                </span>
                              </div>
                            )}
                            {selectedImage.dkgUAL && (
                              <div className="pt-1.5 text-xs">
                                <span className="text-muted-foreground">UAL DKG: </span>
                                <span className="font-mono break-all" title={selectedImage.dkgUAL}>
                                  {selectedImage.dkgUAL.slice(0, 24)}…
                                </span>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 min-w-[100px]"
                                onClick={() => setShowQR(true)}
                              >
                                Generar QR
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 min-w-[100px]"
                                onClick={() => {
                                  navigate('/verify', {
                                    state: {
                                      imageData: selectedImage.data,
                                      signedMetadata: selectedImage.signedMetadata,
                                      filename: selectedImage.metadata.filename,
                                      mimeType: selectedImage.metadata.mimeType,
                                    },
                                  })
                                  setSelectedIndex(null)
                                  setShowMetadata(false)
                                }}
                              >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Verificar
                              </Button>
                              {!selectedImage.dkgUAL && onImageUpdate && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 min-w-[100px]"
                                  disabled={publishingDkg}
                                  onClick={() => {
                                    if (!selectedImage.signedMetadata) {
                                      toast.error('La imagen debe estar firmada antes de publicar en DKG')
                                      return
                                    }
                                    const config = getDkgConfig()
                                    const needsPassword = config?.useDerivedKey && activeAccount
                                    if (config?.useDerivedKey && !activeAccount) {
                                      toast.error('Selecciona una cuenta para usar la clave derivada')
                                      return
                                    }
                                    const proceed = () => {
                                      if (needsPassword) {
                                        setShowPasswordDialog(true)
                                      } else {
                                        doPublishDkg(selectedImage)
                                      }
                                    }
                                    triggerGuide(proceed)
                                  }}
                                >
                                  {publishingDkg ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Database className="h-4 w-4 mr-2" />
                                  )}
                                  Proteger en DKG
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedImage.metadata.gpsMetadata && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <p className="font-semibold text-sm">Ubicación GPS</p>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Latitud: </span>
                              <span className="font-mono">{selectedImage.metadata.gpsMetadata.latitude.toFixed(6)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Longitud: </span>
                              <span className="font-mono">{selectedImage.metadata.gpsMetadata.longitude.toFixed(6)}</span>
                            </div>
                            {selectedImage.metadata.gpsMetadata.altitude && (
                              <div>
                                <span className="text-muted-foreground">Altitud: </span>
                                <span className="font-mono">{Math.round(selectedImage.metadata.gpsMetadata.altitude)} m</span>
                              </div>
                            )}
                            {selectedImage.metadata.gpsMetadata.accuracy && (
                              <div>
                                <span className="text-muted-foreground">Precisión: </span>
                                <span className="font-mono">±{Math.round(selectedImage.metadata.gpsMetadata.accuracy)} m</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedImage.description && (
                        <div className="pt-2 border-t">
                          <p className="text-muted-foreground text-xs">Descripción</p>
                          <p className="text-sm">{selectedImage.description}</p>
                        </div>
                      )}

                      {selectedImage.metadata.cameraSettings && (
                        <div className="pt-2 border-t">
                          <p className="text-muted-foreground text-xs mb-1">Configuración de Cámara</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {selectedImage.metadata.cameraSettings.iso && (
                              <div>
                                <span className="text-muted-foreground">ISO: </span>
                                <span>{selectedImage.metadata.cameraSettings.iso}</span>
                              </div>
                            )}
                            {selectedImage.metadata.cameraSettings.aperture && (
                              <div>
                                <span className="text-muted-foreground">Apertura: </span>
                                <span>{selectedImage.metadata.cameraSettings.aperture}</span>
                              </div>
                            )}
                            {selectedImage.metadata.cameraSettings.shutterSpeed && (
                              <div>
                                <span className="text-muted-foreground">Velocidad: </span>
                                <span>{selectedImage.metadata.cameraSettings.shutterSpeed}</span>
                              </div>
                            )}
                            {selectedImage.metadata.cameraSettings.focalLength && (
                              <div>
                                <span className="text-muted-foreground">Focal: </span>
                                <span>{selectedImage.metadata.cameraSettings.focalLength}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedImage.tags && selectedImage.tags.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-muted-foreground text-xs mb-2">Etiquetas</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedImage.tags.map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedImage.metadata.exifData && Object.keys(selectedImage.metadata.exifData).length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-muted-foreground text-xs mb-1">Datos EXIF Adicionales</p>
                          <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                            {Object.entries(selectedImage.metadata.exifData).map(([key, value]) => (
                              <div key={key} className="flex justify-between gap-2">
                                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                <span className="font-mono text-right break-words">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog contraseña para clave derivada */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPasswordDialog(false)
          setDkgPassword('')
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Contraseña para publicar en DKG</DialogTitle>
            <DialogDescription>
              Usa la clave EVM derivada de tu cuenta. Ingresa tu contraseña para desbloquear.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dkg-pwd">Contraseña</Label>
              <Input
                id="dkg-pwd"
                type="password"
                value={dkgPassword}
                onChange={(e) => setDkgPassword(e.target.value)}
                placeholder="Tu contraseña"
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
            </div>
            <Button
              className="w-full"
              disabled={!dkgPassword.trim() || publishingDkg}
              onClick={handlePasswordSubmit}
            >
              {publishingDkg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Publicar en DKG
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Agente Guía — antes de publicar en DKG */}
      <GuideModal
        open={showGuideModal}
        onOpenChange={setShowGuideModal}
        actionType="publish-dkg"
        fieldsToPublish={['author', 'contentHash', 'createdAt']}
        hasGeolocation={!!selectedImage?.metadata?.gpsMetadata}
        onAcknowledged={acknowledge}
        payloadSummary={
          selectedImage
            ? `imagen (hash, autor, fecha)${selectedImage.metadata?.gpsMetadata ? ', ubicación GPS' : ''}`
            : undefined
        }
      />

      {/* Dialog QR para compartir metadata */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR para verificación</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Escanea este QR para obtener la metadata firmada. Luego sube el archivo en Verificar procedencia.
            </p>
          </DialogHeader>
          {selectedImage?.signedMetadata && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG
                  value={JSON.stringify({ signedMetadata: selectedImage.signedMetadata })}
                  size={200}
                  level="M"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                El verificador debe subir el archivo además de escanear este QR.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
