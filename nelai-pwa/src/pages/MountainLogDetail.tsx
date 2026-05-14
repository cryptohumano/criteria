import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  getMountainLog, 
  saveMountainLog,
  updateMountainLogStatus,
  type MountainLog 
} from '@/utils/mountainLogStorage'
import { useGPSTracking } from '@/hooks/useGPSTracking'
import { 
  Save, 
  Camera, 
  MapPin, 
  Play, 
  Pause,
  Square, 
  Plus, 
  Trash2, 
  ArrowLeft,
  CheckCircle,
  Tent,
  Mountain as MountainIcon,
  Image as ImageIcon,
  FileText,
  X,
  Clock,
  Navigation,
  Info,
  Download,
  PenTool
} from 'lucide-react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import type { MountainLogStatus, MountainLogMilestone, MountainLogImage, GPSPoint, GPSMetadata } from '@/types/mountainLogs'
import { validateGPSPoint } from '@/utils/gpsValidation'
import { formatDuration } from '@/utils/mountainLogStatistics'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AvisoSalidaForm } from '@/components/mountainLogs/AvisoSalidaForm'
import { AvisoSalidaView } from '@/components/mountainLogs/AvisoSalidaView'
import { PlaneacionForm } from '@/components/mountainLogs/PlaneacionForm'
import { ImageGallery } from '@/components/mountainLogs/ImageGallery'
import { RouteMap } from '@/components/mountainLogs/RouteMap'
import PhotoCapture from '@/components/documents/PhotoCapture'
import { generateMountainLogPDF } from '@/services/mountainLogs/mountainLogPDFGenerator'
import { EmergencyButton } from '@/components/emergencies/EmergencyButton'
import { EmergencyPanel } from '@/components/emergencies/EmergencyPanel'
import { FAB } from '@/components/ui/fab'
import { downloadPDF } from '@/utils/pdfUtils'
import SignatureSelector from '@/components/signatures/SignatureSelector'
import type { Document } from '@/types/documents'
import { createDocumentFromPDF } from '@/services/documents/DocumentService'
import { signDocumentWithSubstrate } from '@/services/signatures/SubstrateSigner'
import { signEvidenceMetadata } from '@/services/criteria/evidenceSigning'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function MountainLogDetail() {
  const { logId } = useParams<{ logId: string }>()
  const navigate = useNavigate()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const [showCameraDialog, setShowCameraDialog] = useState(false)
  const [currentMilestoneForImage, setCurrentMilestoneForImage] = useState<string | null>(null)
  // Estado para mantener milestoneId durante el proceso de captura (iOS puede perder el atributo)
  const milestoneIdForCapture = useRef<string | null>(null)
  const [showAddMilestone, setShowAddMilestone] = useState(false)

  const [log, setLog] = useState<MountainLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPlaneacion, setShowPlaneacion] = useState(false)
  const [showAvisoSalida, setShowAvisoSalida] = useState(false)
  const [showAvisoSalidaView, setShowAvisoSalidaView] = useState(false)
  const [showLogTypeSelector, setShowLogTypeSelector] = useState(false) // Selector de tipo de bitácora
  const [selectedMilestoneDescription, setSelectedMilestoneDescription] = useState<{ title: string; description: string } | null>(null)
  const [showSignDialog, setShowSignDialog] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [document, setDocument] = useState<Document | null>(null)
  const { accounts, getAccount } = useKeyringContext()
  const { activeAccount } = useActiveAccount()

  // Form state para nuevo milestone
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('')
  const [newMilestoneType, setNewMilestoneType] = useState<MountainLogMilestone['type']>('checkpoint')
  const [newMilestoneDescription, setNewMilestoneDescription] = useState('')
  // Para bitácoras históricas: entrada manual de GPS
  const [manualGPS, setManualGPS] = useState({ latitude: '', longitude: '', altitude: '' })
  const [gpxFile, setGpxFile] = useState<File | null>(null)
  // Para bitácoras históricas: fechas y horas manuales
  const [manualDateTime, setManualDateTime] = useState({
    fechaInicio: '',
    horaInicio: '',
    fechaLlegada: '',
    horaLlegada: '',
    fechaSalida: '',
    horaSalida: ''
  })

  // GPS Tracking
  const {
    currentLocation,
    isTracking,
    points: gpsPoints,
    startTracking,
    stopTracking,
    addManualPoint,
    error: gpsError,
    hasPermission
  } = useGPSTracking({
    enabled: false,
    interval: 5000,
    highAccuracy: true
  })

  useEffect(() => {
    // Si logId es "new" o undefined, mostrar selector de tipo
    if (!logId || logId === 'new') {
      // Crear nueva bitácora - mostrar selector de tipo primero
      setShowLogTypeSelector(true)
      setLoading(false)
    } else {
      // Cargar bitácora existente solo si no está ya en el estado con el mismo logId
      // Esto evita recargar cuando ya tenemos el log (por ejemplo, después de crear una histórica)
      if (!log || log.logId !== logId) {
        loadLog()
      } else {
        // Si ya tenemos el log correcto, solo asegurar que no esté en estado de carga
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId]) // Solo dependemos de logId, no de log para evitar loops

  const loadLog = async () => {
    if (!logId) return
    try {
      setLoading(true)
      const loadedLog = await getMountainLog(logId)
      if (!loadedLog) {
        toast.error('Bitácora no encontrada')
        navigate('/mountain-logs')
        return
      }
      // Asegurar que milestones existe
      if (!loadedLog.milestones) {
        loadedLog.milestones = []
      }
      setLog(loadedLog)
    } catch (error) {
      console.error('Error al cargar bitácora:', error)
      toast.error('Error al cargar la bitácora')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!log) return

    try {
      setSaving(true)
      const updatedLog: MountainLog = {
        ...log,
        updatedAt: Date.now(),
        gpsPoints: isTracking ? [...gpsPoints] : log.gpsPoints
      }

      // Calcular y actualizar estadísticas
      const { updateMountainLogStatistics } = await import('@/utils/mountainLogStatistics')
      const logWithStats = updateMountainLogStatistics(updatedLog)

      await saveMountainLog(logWithStats)
      setLog(logWithStats)
      toast.success('Bitácora guardada')
    } catch (error) {
      console.error('Error al guardar bitácora:', error)
      toast.error('Error al guardar la bitácora')
    } finally {
      setSaving(false)
    }
  }

  const handleChangeAccount = async (newAccountAddress: string) => {
    if (!log) return

    // REGLA: No se puede cambiar la cuenta después de que la bitácora ya tiene una cuenta asignada
    if (log.relatedAccount) {
      toast.error('No se puede cambiar la cuenta de una bitácora después de crearla. La cuenta está asociada permanentemente a la bitácora y al aviso de salida.')
      return
    }

    try {
      setSaving(true)
      const updatedLog: MountainLog = {
        ...log,
        relatedAccount: newAccountAddress,
        updatedAt: Date.now(),
      }
      await saveMountainLog(updatedLog)
      setLog(updatedLog)
      toast.success('Cuenta asociada a la bitácora')
    } catch (error) {
      console.error('Error al cambiar cuenta de la bitácora:', error)
      toast.error('Error al cambiar la cuenta')
    } finally {
      setSaving(false)
    }
  }

  const handleFinalize = async () => {
    if (!log) return

    if (!confirm('¿Estás seguro de que deseas finalizar esta bitácora? No podrás agregar más milestones.')) {
      return
    }

    try {
      setSaving(true)
      if (isTracking) {
        stopTracking()
      }
      
      // Calcular estadísticas finales antes de finalizar
      const { updateMountainLogStatistics } = await import('@/utils/mountainLogStatistics')
      const logWithStats = updateMountainLogStatistics({
        ...log,
        endDate: Date.now(),
        gpsPoints: isTracking ? [...gpsPoints] : log.gpsPoints,
        isTrackingActive: false,
      })

      // Guardar con estadísticas actualizadas
      await saveMountainLog(logWithStats)
      
      // Actualizar estado a completado
      await updateMountainLogStatus(log.logId, 'completed', Date.now())
      await loadLog()
      toast.success('Bitácora finalizada')
    } catch (error) {
      console.error('Error al finalizar bitácora:', error)
      toast.error('Error al finalizar la bitácora')
    } finally {
      setSaving(false)
    }
  }

  const handleExportPDF = async () => {
    if (!log) return

    try {
      setExportingPDF(true)
      toast.info('Generando PDF...')

      // Calcular estadísticas antes de generar el PDF
      const { updateMountainLogStatistics } = await import('@/utils/mountainLogStatistics')
      const logWithStats = updateMountainLogStatistics({
        ...log,
        gpsPoints: isTracking ? [...gpsPoints] : log.gpsPoints,
      })

      // Guardar bitácora con estadísticas actualizadas
      await saveMountainLog(logWithStats)
      setLog(logWithStats)

      // Obtener nombre de la cuenta si está disponible
      let authorName = logWithStats.relatedAccount || ''
      if (logWithStats.relatedAccount) {
        const account = getAccount(logWithStats.relatedAccount)
        if (account?.meta?.name) {
          authorName = account.meta.name
        }
      }

      const { pdfBase64, pdfHash } = await generateMountainLogPDF({
        log: logWithStats,
        includeImages: true, // Incluir imágenes en el PDF
        authorName, // Pasar el nombre del autor
      })

      // Agregar EXIF/cámara de las imágenes para Content Credentials y metadata
      const { aggregateExifFromMountainLog } = await import('@/utils/exifAggregation')
      const exifData = aggregateExifFromMountainLog(logWithStats)

      // Crear documento en el sistema de documentos (guardar primero)
      const doc = await createDocumentFromPDF({
        type: 'mountain_log',
        category: 'expediciones',
        subcategory: 'montañismo',
        pdfBase64,
        metadata: {
          title: logWithStats.title || 'Bitácora de Montañismo',
          description: logWithStats.description || `Bitácora de ${logWithStats.mountainName || logWithStats.location || 'montañismo'}`,
          author: authorName,
          subject: 'Bitácora de Montañismo',
          keywords: ['montañismo', 'bitácora', 'expedición', logWithStats.mountainName || '', logWithStats.location || ''].filter(Boolean),
          ...(exifData && { exifData }), // Para incrustar en Content Credentials al firmar
        },
        gpsMetadata: logWithStats.startLocation,
        relatedAccount: logWithStats.relatedAccount,
      })

      setDocument(doc)
      toast.success('PDF generado y guardado. Ahora puedes firmarlo.')

      // Descargar el PDF sin firmar
      const filename = `${logWithStats.title || 'bitacora'}_${new Date().toISOString().split('T')[0]}.pdf`
      downloadPDF(pdfBase64, filename)
    } catch (error) {
      console.error('Error al exportar PDF:', error)
      toast.error('Error al generar el PDF')
    } finally {
      setExportingPDF(false)
    }
  }

  const handleSignDocument = async (updatedDocument: Document) => {
    setDocument(updatedDocument)
    setShowSignDialog(false)
    
    // Verificar que tenga ambas firmas (Substrate y autográfica)
    const hasSubstrateSignature = updatedDocument.signatures?.some(sig => sig.type === 'substrate')
    const hasAutographicSignature = updatedDocument.signatures?.some(sig => sig.type === 'autographic')
    
    if (hasSubstrateSignature && hasAutographicSignature) {
      toast.success('Bitácora firmada exitosamente con ambas firmas (Substrate + Autográfica)')
    } else if (hasSubstrateSignature) {
      toast.success('Bitácora firmada con firma Substrate')
    } else if (hasAutographicSignature) {
      toast.success('Bitácora firmada con firma autográfica')
    } else {
      toast.warning('Bitácora guardada pero sin firmas')
    }
    
    // Descargar el PDF firmado automáticamente
    if (updatedDocument.pdf) {
      const filename = `${log?.title || 'bitacora'}_firmado_${new Date().toISOString().split('T')[0]}.pdf`
      downloadPDF(updatedDocument.pdf, filename)
    }
  }

  const handleStartTracking = async () => {
    if (!log) return

    if (!hasPermission) {
      toast.error('Se requiere permiso de geolocalización')
      return
    }

    try {
      await startTracking()
      const updatedLog: MountainLog = {
        ...log,
        isTrackingActive: true,
        startLocation: currentLocation || undefined,
        updatedAt: Date.now()
      }
      await saveMountainLog(updatedLog)
      setLog(updatedLog)
      toast.success('Tracking iniciado')
    } catch (error) {
      console.error('Error al iniciar tracking:', error)
      toast.error('Error al iniciar el tracking')
    }
  }

  const handleStopTracking = async () => {
    if (!log) return

    try {
      stopTracking()
      const updatedLog: MountainLog = {
        ...log,
        isTrackingActive: false,
        endLocation: currentLocation || undefined,
        gpsPoints: [...gpsPoints],
        updatedAt: Date.now()
      }

      // Calcular estadísticas después de detener el tracking
      const { updateMountainLogStatistics } = await import('@/utils/mountainLogStatistics')
      const logWithStats = updateMountainLogStatistics(updatedLog)

      await saveMountainLog(logWithStats)
      setLog(logWithStats)
      toast.success('Tracking detenido y estadísticas actualizadas')
    } catch (error) {
      console.error('Error al detener tracking:', error)
      toast.error('Error al detener el tracking')
    }
  }

  const handleAddMilestone = async () => {
    if (!log) return

    if (!newMilestoneTitle.trim()) {
      toast.error('El título del milestone es requerido')
      return
    }

    try {
      // En bitácoras históricas, NO intentar obtener GPS automático
      // Solo se permite entrada manual o archivos GPX
      let gpsPoint: GPSPoint | undefined = undefined
      
      if (!log.isHistorical) {
        // Bitácoras activas: intentar obtener GPS automático
        gpsPoint = currentLocation
        if (!gpsPoint) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
              })
            })
            gpsPoint = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude ?? undefined,
              accuracy: position.coords.accuracy ?? undefined,
              timestamp: position.timestamp || Date.now()
            }
            
            // Validar el punto GPS
            const validation = validateGPSPoint(gpsPoint, currentLocation || undefined)
            if (!validation.isValid || validation.confidence < 70) {
              toast.warning('Ubicación GPS con baja confianza', {
                description: validation.warnings.join('; ') || 'Posible GPS falso detectado'
              })
              // Marcar como sospechoso pero aún así guardarlo
              ;(gpsPoint as any).suspicious = true
              ;(gpsPoint as any).confidence = validation.confidence
            } else {
              toast.success('Ubicación GPS capturada')
            }
          } catch (gpsError) {
            console.warn('No se pudo obtener ubicación GPS:', gpsError)
            toast.info('Milestone creado sin ubicación GPS')
          }
        }
      }
      // En históricas, gpsPoint queda undefined (se puede agregar manualmente después)

      // En bitácoras históricas, procesar GPS manual o GPX
      if (log.isHistorical) {
        // Si hay coordenadas manuales, usarlas
        if (manualGPS.latitude && manualGPS.longitude) {
          const lat = parseFloat(manualGPS.latitude)
          const lon = parseFloat(manualGPS.longitude)
          if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            gpsPoint = {
              latitude: lat,
              longitude: lon,
              altitude: manualGPS.altitude ? parseFloat(manualGPS.altitude) : undefined,
              timestamp: Date.now(),
              accuracy: undefined
            }
            // Marcar como manual
            ;(gpsPoint as any).manual = true
          }
        }
        // Si hay archivo GPX, procesarlo (se puede usar para múltiples milestones en el futuro)
        if (gpxFile) {
          try {
            const { parseGPX, convertGPXWaypointsToGPSPoints } = await import('@/utils/gpxParser')
            const parsed = await parseGPX(gpxFile)
            if (parsed.waypoints.length > 0) {
              // Usar el primer waypoint del GPX para este milestone
              const waypoints = convertGPXWaypointsToGPSPoints(parsed.waypoints)
              if (waypoints.length > 0) {
                gpsPoint = waypoints[0]
                ;(gpsPoint as any).fromGPX = true
                toast.success(`GPS extraído del archivo GPX (${parsed.waypoints.length} waypoints encontrados)`)
              }
            }
          } catch (error) {
            console.error('Error al procesar GPX:', error)
            toast.error('Error al procesar archivo GPX')
          }
        }
      }

      // Calcular timestamp: para históricas, usar fecha/hora manual si está disponible
      let timestamp = Date.now()
      let metadata: MountainLogMilestone['metadata'] = {}
      
      if (log.isHistorical) {
        // Procesar fechas y horas manuales
        const fechaInicio = manualDateTime.fechaInicio
        const horaInicio = manualDateTime.horaInicio
        const fechaLlegada = manualDateTime.fechaLlegada
        const horaLlegada = manualDateTime.horaLlegada
        const fechaSalida = manualDateTime.fechaSalida
        const horaSalida = manualDateTime.horaSalida

        // Si hay fecha de inicio, usarla como timestamp principal
        if (fechaInicio) {
          const fechaInicioDate = new Date(fechaInicio)
          if (horaInicio) {
            const [hours, minutes] = horaInicio.split(':').map(Number)
            fechaInicioDate.setHours(hours || 0, minutes || 0, 0, 0)
          }
          timestamp = fechaInicioDate.getTime()
        }

        // Guardar todas las fechas/horas en metadata
        if (fechaInicio || horaInicio || fechaLlegada || horaLlegada || fechaSalida || horaSalida) {
          metadata = {
            ...metadata,
            fechaInicio: fechaInicio || undefined,
            horaInicio: horaInicio || undefined,
            fechaLlegada: fechaLlegada || undefined,
            horaLlegada: horaLlegada || undefined,
            fechaSalida: fechaSalida || undefined,
            horaSalida: horaSalida || undefined,
          }
        }
      }

      const milestone: MountainLogMilestone = {
        id: uuidv4(),
        timestamp,
        title: newMilestoneTitle.trim(),
        description: newMilestoneDescription.trim() || undefined,
        type: newMilestoneType,
        gpsPoint: gpsPoint || undefined,
        images: [],
        order: log.milestones.length,
        manualGPS: log.isHistorical ? !!manualGPS.latitude : undefined,
        manualTimestamp: log.isHistorical ? true : undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      }

      const updatedLog: MountainLog = {
        ...log,
        milestones: [...log.milestones, milestone].sort((a, b) => a.timestamp - b.timestamp),
        updatedAt: Date.now()
      }

      // Reordenar milestones
      updatedLog.milestones = updatedLog.milestones.map((m, index) => ({
        ...m,
        order: index
      }))

      await saveMountainLog(updatedLog)
      setLog(updatedLog)
      
      // Limpiar formulario
      setNewMilestoneTitle('')
      setNewMilestoneDescription('')
      setNewMilestoneType('checkpoint')
      setManualGPS({ latitude: '', longitude: '', altitude: '' })
      setGpxFile(null)
      setManualDateTime({
        fechaInicio: '',
        horaInicio: '',
        fechaLlegada: '',
        horaLlegada: '',
        fechaSalida: '',
        horaSalida: ''
      })
      setShowAddMilestone(false)
      
      toast.success('Milestone agregado')
    } catch (error) {
      console.error('Error al agregar milestone:', error)
      toast.error('Error al agregar milestone')
    }
  }

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!log) return

    if (!confirm('¿Estás seguro de que deseas eliminar este milestone?')) {
      return
    }

    try {
      const updatedLog: MountainLog = {
        ...log,
        milestones: log.milestones
          .filter(m => m.id !== milestoneId)
          .map((m, index) => ({ ...m, order: index })),
        updatedAt: Date.now()
      }

      await saveMountainLog(updatedLog)
      setLog(updatedLog)
      toast.success('Milestone eliminado')
    } catch (error) {
      console.error('Error al eliminar milestone:', error)
      toast.error('Error al eliminar milestone')
    }
  }

  const handleAddImageToMilestone = async (milestoneId: string) => {
    if (!log) return
    setCurrentMilestoneForImage(milestoneId)
    
    // Guardar milestoneId en ref para iOS (puede perder el atributo)
    milestoneIdForCapture.current = milestoneId
    console.log('[handleAddImageToMilestone] Milestone ID guardado:', milestoneId)
    
    // Verificar si estamos en un dispositivo móvil REAL (no solo por tamaño de pantalla)
    // El atributo capture solo funciona en dispositivos móviles reales con HTTPS
    const isRealMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isHTTPS = window.location.protocol === 'https:'
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    
    // En localhost, SIEMPRE mostrar opciones (capture no funciona bien en localhost)
    // En producción HTTPS con móvil real, intentar usar capture directamente
    if (isLocalhost) {
      // En localhost, siempre mostrar opciones (cámara web o archivo)
      console.log('[handleAddImageToMilestone] Localhost detectado - mostrando opciones (cámara web o archivo)...')
      setShowCameraDialog(true)
    } else if (isRealMobile && isHTTPS) {
      // En móvil real con HTTPS, intentar usar input file con capture
      cameraInputRef.current?.setAttribute('data-milestone-id', milestoneId)
      console.log('[handleAddImageToMilestone] Móvil real con HTTPS - abriendo cámara...')
      cameraInputRef.current?.click()
    } else {
      // En desktop o cuando capture no funciona, mostrar opción de webcam o archivo
      console.log('[handleAddImageToMilestone] Mostrando opciones (cámara web o archivo)...')
      setShowCameraDialog(true)
    }
  }

  const handleCameraCapture = async (photoBase64: string) => {
    if (!log || !currentMilestoneForImage) return
    setShowCameraDialog(false)
    
    // Procesar la imagen capturada de la webcam
    await processImageFromBase64(photoBase64, currentMilestoneForImage)
    setCurrentMilestoneForImage(null)
  }

  const handleFileSelect = () => {
    if (!currentMilestoneForImage) return
    cameraInputRef.current?.setAttribute('data-milestone-id', currentMilestoneForImage)
    cameraInputRef.current?.click()
    setShowCameraDialog(false)
  }

  const processImageFromBase64 = async (dataUrl: string, milestoneId: string) => {
    if (!log) return

    // Capturar referencias ANTES de cualquier operación asíncrona
    const currentLog = log
    const docRef = typeof document !== 'undefined' && document !== null 
      ? document 
      : (typeof window !== 'undefined' && window.document ? window.document : null)
    
    if (!docRef) {
      console.error('[processImageFromBase64] document no está disponible al inicio')
      toast.error('Error: No se puede procesar la imagen en este momento')
      return
    }

    try {
      // Convertir base64 a blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })

      // Obtener GPS si está disponible
      let gpsMetadata: GPSMetadata | undefined
      if (currentLocation) {
        gpsMetadata = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          altitude: currentLocation.altitude,
          accuracy: currentLocation.accuracy,
          timestamp: Date.now()
        }
      }

      // Verificar que Image esté disponible
      if (typeof Image === 'undefined') {
        console.error('[processImageFromBase64] Image constructor no está disponible')
        toast.error('Error: No se puede procesar la imagen')
        return
      }

      // Crear imagen
      const img = new Image()
      
      img.onerror = (error) => {
        console.error('[processImageFromBase64] Error al cargar imagen:', error)
        toast.error('Error al procesar la imagen')
      }

      img.onload = async () => {
        try {
          // Usar la referencia capturada (más confiable que acceder a document directamente)
          const doc = docRef
          
          // Verificar que el componente aún esté montado
          if (!currentLog || !milestoneId) {
            console.error('[processImageFromBase64] Log o milestoneId no disponible en img.onload')
            toast.error('Error: La bitácora ya no está disponible')
            return
          }

          // Verificar que createElement esté disponible
          if (typeof doc.createElement !== 'function') {
            console.error('[processImageFromBase64] document.createElement no está disponible')
            toast.error('Error: No se puede procesar la imagen')
            return
          }

          // Crear canvas con try-catch adicional para capturar errores
          let canvas: HTMLCanvasElement
          try {
            canvas = doc.createElement('canvas')
            if (!canvas) {
              throw new Error('createElement retornó null')
            }
          } catch (error) {
            console.error('[processImageFromBase64] Error al crear canvas:', error)
            toast.error('Error: No se puede procesar la imagen. Intenta recargar la página.')
            return
          }
          const maxSize = 200
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height
              height = maxSize
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            console.error('[processImageFromBase64] No se pudo obtener contexto del canvas')
            toast.error('Error al procesar la imagen')
            return
          }

          ctx.drawImage(img, 0, 0, width, height)
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7)

          // Verificar una vez más antes de guardar
          if (!currentLog || !milestoneId) {
            console.error('[processImageFromBase64] Log o milestoneId perdido antes de guardar')
            toast.error('Error: La bitácora ya no está disponible')
            return
          }

          const image: MountainLogImage = {
            id: uuidv4(),
            data: dataUrl,
            thumbnail,
            metadata: {
              filename: file.name,
              mimeType: file.type,
              size: file.size,
              width: img.width,
              height: img.height,
              capturedAt: Date.now(),
              gpsMetadata
            }
          }

          // Firma criterIA: procedencia y autenticidad (genérico)
          const authorAddress = currentLog.relatedAccount || activeAccount || accounts[0]?.address
          const account = authorAddress ? getAccount(authorAddress) : undefined
          if (account?.pair) {
            try {
              const result = await signEvidenceMetadata(dataUrl, authorAddress, account.pair, {
                type: 'photo',
                filename: image.metadata.filename,
                mimeType: image.metadata.mimeType,
                geolocation: image.metadata.gpsMetadata
                  ? {
                      lat: image.metadata.gpsMetadata.latitude,
                      lon: image.metadata.gpsMetadata.longitude,
                      alt: image.metadata.gpsMetadata.altitude
                    }
                  : undefined
              })
              image.contentHash = result.contentHash
              image.signedMetadata = result.signedMetadata
            } catch (err) {
              console.warn('[processImageFromBase64] Firma criterIA omitida:', err)
            }
          }

          const updatedLog: MountainLog = {
            ...currentLog,
            milestones: currentLog.milestones.map(m =>
              m.id === milestoneId
                ? { ...m, images: [...m.images, image] }
                : m
            ),
            updatedAt: Date.now()
          }

          console.log('[processImageFromBase64] Guardando bitácora...')
          await saveMountainLog(updatedLog)
          console.log('[processImageFromBase64] Bitácora guardada exitosamente')
          
          setLog(prevLog => {
            if (!prevLog) {
              console.warn('[processImageFromBase64] Componente desmontado, no se actualiza estado')
              return prevLog
            }
            return updatedLog
          })
          
          toast.success('Imagen agregada exitosamente')
        } catch (error) {
          console.error('[processImageFromBase64] Error en img.onload:', error)
          toast.error('Error al procesar la imagen: ' + (error instanceof Error ? error.message : 'Error desconocido'))
        }
      }

      // Asignar src después de configurar handlers
      img.src = dataUrl
    } catch (error) {
      console.error('Error al procesar imagen:', error)
      toast.error('Error al procesar la imagen')
    }
  }

  const handleDeleteImageFromMilestone = async (milestoneId: string, imageId: string) => {
    if (!log) return

    try {
      const updatedLog: MountainLog = {
        ...log,
        milestones: log.milestones.map(m => 
          m.id === milestoneId 
            ? { ...m, images: m.images.filter(img => img.id !== imageId) }
            : m
        ),
        updatedAt: Date.now()
      }

      await saveMountainLog(updatedLog)
      setLog(updatedLog)
      toast.success('Imagen eliminada')
    } catch (error) {
      console.error('Error al eliminar imagen:', error)
      toast.error('Error al eliminar la imagen')
    }
  }

  const handleImageUpdateInMilestone = async (
    milestoneId: string,
    imageId: string,
    updates: Partial<MountainLogImage>
  ) => {
    if (!log) return

    try {
      const updatedLog: MountainLog = {
        ...log,
        milestones: log.milestones.map(m =>
          m.id === milestoneId
            ? {
                ...m,
                images: m.images.map(img =>
                  img.id === imageId ? { ...img, ...updates } : img
                ),
              }
            : m
        ),
        updatedAt: Date.now(),
      }

      await saveMountainLog(updatedLog)
      setLog(updatedLog)
    } catch (error) {
      console.error('Error al actualizar imagen:', error)
      toast.error('Error al actualizar la imagen')
    }
  }

  const handleImageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!log) {
      console.error('[handleImageFile] No hay log disponible')
      toast.error('Error: No hay bitácora disponible')
      return
    }

    const files = event.target.files
    if (!files || files.length === 0) {
      console.warn('[handleImageFile] No se seleccionaron archivos')
      return
    }

    const file = files[0]
    console.log('[handleImageFile] Archivo seleccionado:', {
      name: file.name,
      type: file.type,
      size: file.size
    })

    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen')
      return
    }

    // Obtener milestoneId ANTES de procesar (iOS puede limpiar el input)
    // Intentar desde el atributo primero, luego desde el ref
    let milestoneId = cameraInputRef.current?.getAttribute('data-milestone-id') || milestoneIdForCapture.current
    console.log('[handleImageFile] Milestone ID (atributo):', cameraInputRef.current?.getAttribute('data-milestone-id'))
    console.log('[handleImageFile] Milestone ID (ref):', milestoneIdForCapture.current)
    console.log('[handleImageFile] Milestone ID (final):', milestoneId)

    if (!milestoneId) {
      console.error('[handleImageFile] No se encontró milestoneId')
      toast.error('Error: No se pudo identificar el milestone. Intenta de nuevo.')
      // Limpiar input
      if (cameraInputRef.current) {
        cameraInputRef.current.value = ''
      }
      return
    }

    // Verificar que el milestone existe
    const milestone = log.milestones.find(m => m.id === milestoneId)
    if (!milestone) {
      console.error('[handleImageFile] Milestone no encontrado:', milestoneId)
      toast.error('Error: Milestone no encontrado')
      if (cameraInputRef.current) {
        cameraInputRef.current.value = ''
      }
      return
    }

    try {
      const reader = new FileReader()
      
      reader.onerror = (error) => {
        console.error('[handleImageFile] Error en FileReader:', error)
        toast.error('Error al leer la imagen')
        if (cameraInputRef.current) {
          cameraInputRef.current.value = ''
        }
      }

          reader.onload = async (e) => {
        try {
          // Verificar que el componente aún esté montado
          if (!log || !milestoneId) {
            console.error('[handleImageFile] Log o milestoneId no disponible en reader.onload')
            toast.error('Error: La bitácora ya no está disponible')
            return
          }

          // Capturar referencias ANTES de cualquier operación asíncrona
          const currentLog = log
          const currentMilestoneId = milestoneId
          const docRef = typeof document !== 'undefined' && document !== null 
            ? document 
            : (typeof window !== 'undefined' && window.document ? window.document : null)
          
          if (!docRef) {
            console.error('[handleImageFile] document no está disponible al inicio')
            toast.error('Error: No se puede procesar la imagen en este momento')
            return
          }

          const dataUrl = e.target?.result as string
          if (!dataUrl) {
            console.error('[handleImageFile] No se pudo obtener dataUrl')
            toast.error('Error al procesar la imagen')
            return
          }

          console.log('[handleImageFile] Imagen leída, tamaño dataUrl:', dataUrl.length)

          let gpsMetadata: GPSMetadata | undefined
          if (currentLocation) {
            gpsMetadata = {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              altitude: currentLocation.altitude,
              accuracy: currentLocation.accuracy,
              timestamp: Date.now()
            }
            console.log('[handleImageFile] GPS metadata agregado:', gpsMetadata)
          }

          // Verificar que Image esté disponible
          if (typeof Image === 'undefined') {
            console.error('[handleImageFile] Image constructor no está disponible')
            toast.error('Error: No se puede procesar la imagen')
            return
          }

          const img = new Image()
          
          // Configurar handlers ANTES de asignar src
          img.onerror = (error) => {
            console.error('[handleImageFile] Error al cargar imagen:', error)
            toast.error('Error al procesar la imagen')
            milestoneIdForCapture.current = null
          }

          // Timeout de seguridad para iOS
          let timeoutId: NodeJS.Timeout | null = null
          
          img.onload = async () => {
            // Limpiar timeout si existe
            if (timeoutId) {
              clearTimeout(timeoutId)
              timeoutId = null
            }
            try {
              console.log('[handleImageFile] Imagen cargada, dimensiones:', img.width, 'x', img.height)

              // Usar la referencia capturada (más confiable que acceder a document directamente)
              const doc = docRef
              
              if (!doc) {
                console.error('[handleImageFile] document no está disponible en img.onload')
                console.error('[handleImageFile] typeof document:', typeof document)
                console.error('[handleImageFile] typeof window:', typeof window)
                toast.error('Error: No se puede procesar la imagen en este momento')
                return
              }

              // Verificar que el componente aún esté montado y el log exista
              if (!currentLog || !currentMilestoneId) {
                console.error('[handleImageFile] Log o milestoneId no disponible en img.onload')
                toast.error('Error: La bitácora ya no está disponible')
                return
              }

              // Verificar que createElement esté disponible
              if (typeof doc.createElement !== 'function') {
                console.error('[handleImageFile] document.createElement no está disponible')
                toast.error('Error: No se puede procesar la imagen')
                return
              }

              // Crear canvas con try-catch adicional para capturar errores
              let canvas: HTMLCanvasElement
              try {
                canvas = doc.createElement('canvas')
                if (!canvas) {
                  throw new Error('createElement retornó null')
                }
              } catch (error) {
                console.error('[handleImageFile] Error al crear canvas:', error)
                toast.error('Error: No se puede procesar la imagen. Intenta recargar la página.')
                return
              }
              const maxSize = 200
              let width = img.width
              let height = img.height

              if (width > height) {
                if (width > maxSize) {
                  height = (height * maxSize) / width
                  width = maxSize
                }
              } else {
                if (height > maxSize) {
                  width = (width * maxSize) / height
                  height = maxSize
                }
              }

              canvas.width = width
              canvas.height = height
              const ctx = canvas.getContext('2d')
              if (!ctx) {
                throw new Error('No se pudo obtener contexto del canvas')
              }

              ctx.drawImage(img, 0, 0, width, height)
              const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
              console.log('[handleImageFile] Thumbnail generado')

              // Extraer EXIF de la cámara (ISO, apertura, etc.) para incrustar en PDF y Content Credentials
              let exifData: Record<string, unknown> | undefined
              let cameraSettings: MountainLogImage['metadata']['cameraSettings'] | undefined
              let exifGps = gpsMetadata
              try {
                const { extractEXIFMetadata } = await import('@/services/pdf/PDFMetadata')
                const exif = await extractEXIFMetadata(file)
                if (exif.gps) exifGps = exif.gps
                if (exif.cameraSettings) cameraSettings = exif.cameraSettings
                if (exif.exifData && Object.keys(exif.exifData).length > 0) exifData = exif.exifData
              } catch (err) {
                console.warn('[handleImageFile] EXIF no extraído:', err)
              }

              const image: MountainLogImage = {
                id: uuidv4(),
                data: dataUrl,
                thumbnail,
                metadata: {
                  filename: file.name || `foto-${Date.now()}.jpg`,
                  mimeType: file.type || 'image/jpeg',
                  size: file.size,
                  width: img.width,
                  height: img.height,
                  capturedAt: Date.now(),
                  gpsMetadata: exifGps,
                  ...(cameraSettings && { cameraSettings }),
                  ...(exifData && { exifData }),
                }
              }

              // Firma criterIA: procedencia y autenticidad (genérico)
              const authorAddress = currentLog.relatedAccount || activeAccount || accounts[0]?.address
              const account = authorAddress ? getAccount(authorAddress) : undefined
              if (account?.pair) {
                try {
                  const result = await signEvidenceMetadata(dataUrl, authorAddress, account.pair, {
                    type: 'photo',
                    filename: image.metadata.filename,
                    mimeType: image.metadata.mimeType,
                    geolocation: image.metadata.gpsMetadata
                      ? {
                          lat: image.metadata.gpsMetadata.latitude,
                          lon: image.metadata.gpsMetadata.longitude,
                          alt: image.metadata.gpsMetadata.altitude
                        }
                      : undefined
                  })
                  image.contentHash = result.contentHash
                  image.signedMetadata = result.signedMetadata
                } catch (err) {
                  console.warn('[handleImageFile] Firma criterIA omitida:', err)
                }
              }

              console.log('[handleImageFile] Creando imagen, milestoneId:', currentMilestoneId)
              console.log('[handleImageFile] Milestones actuales:', currentLog.milestones.length)

              const updatedLog: MountainLog = {
                ...currentLog,
                milestones: currentLog.milestones.map(m => {
                  if (m.id === currentMilestoneId) {
                    console.log('[handleImageFile] Agregando imagen al milestone:', m.id, 'Imágenes actuales:', m.images.length)
                    return { ...m, images: [...m.images, image] }
                  }
                  return m
                }),
                updatedAt: Date.now()
              }

              // Verificar una vez más antes de guardar
              if (!currentLog || !currentMilestoneId) {
                console.error('[handleImageFile] Log o milestoneId perdido antes de guardar')
                toast.error('Error: La bitácora ya no está disponible')
                return
              }

              console.log('[handleImageFile] Guardando bitácora actualizada...')
              try {
                await saveMountainLog(updatedLog)
                console.log('[handleImageFile] Bitácora guardada exitosamente')
                
                // Verificar que el componente aún esté montado antes de actualizar estado
                setLog(prevLog => {
                  if (!prevLog) {
                    console.warn('[handleImageFile] Componente desmontado, no se actualiza estado')
                    return prevLog
                  }
                  return updatedLog
                })
                
                toast.success('Imagen agregada exitosamente')
                
                // Limpiar milestoneId después de éxito
                milestoneIdForCapture.current = null
                
                // Verificar que se guardó correctamente
                const savedMilestone = updatedLog.milestones.find(m => m.id === currentMilestoneId)
                if (savedMilestone) {
                  console.log('[handleImageFile] ✅ Imagen agregada. Total de imágenes en milestone:', savedMilestone.images.length)
                } else {
                  console.error('[handleImageFile] ❌ Milestone no encontrado después de guardar')
                }
              } catch (saveError) {
                console.error('[handleImageFile] Error al guardar:', saveError)
                toast.error('Error al guardar la imagen: ' + (saveError instanceof Error ? saveError.message : 'Error desconocido'))
                throw saveError
              }
            } catch (error) {
              console.error('[handleImageFile] Error en img.onload:', error)
              toast.error('Error al procesar la imagen: ' + (error instanceof Error ? error.message : 'Error desconocido'))
            }
          }

          // Asignar src después de configurar handlers
          img.src = dataUrl
          
          // Timeout de seguridad para iOS (10 segundos)
          timeoutId = setTimeout(() => {
            if (!img.complete) {
              console.error('[handleImageFile] Timeout al cargar imagen después de 10s')
              toast.error('La imagen tardó demasiado en cargar. Intenta con otra foto.')
              img.onerror = null
              img.onload = null
              milestoneIdForCapture.current = null
            }
          }, 10000)
        } catch (error) {
          console.error('[handleImageFile] Error en reader.onload:', error)
          toast.error('Error al procesar la imagen: ' + (error instanceof Error ? error.message : 'Error desconocido'))
          milestoneIdForCapture.current = null
        }
      }

      console.log('[handleImageFile] Iniciando lectura del archivo...')
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('[handleImageFile] Error general:', error)
      toast.error('Error al procesar la imagen: ' + (error instanceof Error ? error.message : 'Error desconocido'))
    } finally {
      // Limpiar input después de procesar
      if (cameraInputRef.current) {
        cameraInputRef.current.value = ''
        // NO remover el data-milestone-id aquí todavía, se limpiará después de éxito
      }
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    })
  }

  const getMilestoneIcon = (type: MountainLogMilestone['type']) => {
    switch (type) {
      case 'checkpoint':
        return <CheckCircle className="h-5 w-5" />
      case 'camp':
        return <Tent className="h-5 w-5" />
      case 'summit':
        return <MountainIcon className="h-5 w-5" />
      case 'photo':
        return <ImageIcon className="h-5 w-5" />
      case 'note':
        return <FileText className="h-5 w-5" />
      default:
        return <MapPin className="h-5 w-5" />
    }
  }

  const getMilestoneColor = (type: MountainLogMilestone['type']) => {
    switch (type) {
      case 'checkpoint':
        return 'bg-blue-500'
      case 'camp':
        return 'bg-green-500'
      case 'summit':
        return 'bg-yellow-500'
      case 'photo':
        return 'bg-purple-500'
      case 'note':
        return 'bg-gray-500'
      default:
        return 'bg-gray-400'
    }
  }

  const isReadOnly = log?.status === 'completed'

  // Mostrar selector de tipo de bitácora si es nueva (PRIMERO, antes de otros checks)
  if (showLogTypeSelector && (!logId || logId === 'new')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Crear Nueva Bitácora</CardTitle>
            <CardDescription>
              Selecciona el tipo de bitácora que deseas crear
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-auto p-6 flex flex-col items-start gap-3"
              onClick={() => {
                // Bitácora activa (con aviso de salida)
                const currentAccount = activeAccount || (accounts.length > 0 ? accounts[0].address : undefined)
                const newLog: MountainLog = {
                  logId: uuidv4(),
                  title: 'Nueva Bitácora',
                  description: '',
                  status: 'draft',
                  isHistorical: false,
                  startDate: Date.now(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  trackingMode: 'manual',
                  isTrackingActive: false,
                  routes: [],
                  milestones: [],
                  entries: [],
                  images: [],
                  gpsPoints: [],
                  synced: false,
                  relatedAccount: currentAccount
                }
                setLog(newLog)
                setShowLogTypeSelector(false)
                setShowPlaneacion(true)
              }}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Play className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold">Bitácora Activa</div>
                  <div className="text-sm text-muted-foreground">
                    Para expediciones en tiempo real con aviso de salida
                  </div>
                </div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="w-full h-auto p-6 flex flex-col items-start gap-3"
              onClick={async () => {
                // Bitácora histórica (sin aviso de salida)
                const currentAccount = activeAccount || (accounts.length > 0 ? accounts[0].address : undefined)
                const newLog: MountainLog = {
                  logId: uuidv4(),
                  title: 'Nueva Bitácora Histórica',
                  description: '',
                  status: 'draft',
                  isHistorical: true,
                  startDate: Date.now(),
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  trackingMode: 'manual',
                  isTrackingActive: false,
                  routes: [],
                  milestones: [],
                  entries: [],
                  images: [],
                  gpsPoints: [],
                  synced: false,
                  relatedAccount: currentAccount
                }
                setShowLogTypeSelector(false)
                // Establecer el log en el estado ANTES de guardar y navegar
                // Esto evita el error de renderizado momentáneo
                setLog(newLog)
                setLoading(false) // Asegurar que no esté en estado de carga
                // Guardar primero y luego navegar
                try {
                  await saveMountainLog(newLog)
                  toast.success('Bitácora histórica creada')
                  // Navegar usando react-router para mantener el estado
                  navigate(`/mountain-logs/${newLog.logId}`, { replace: true })
                } catch (error) {
                  console.error('Error al guardar bitácora histórica:', error)
                  toast.error('Error al guardar la bitácora')
                  setShowLogTypeSelector(true) // Volver a mostrar el selector si hay error
                  setLog(null) // Limpiar el log si hay error
                }
              }}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 bg-muted rounded-lg">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold">Bitácora Histórica</div>
                  <div className="text-sm text-muted-foreground">
                    Para digitalizar bitácoras antiguas sin aviso de salida
                  </div>
                </div>
              </div>
            </Button>
          </CardContent>
          <CardContent>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/mountain-logs')}
            >
              Cancelar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mostrar formulario de Planeación si es nueva bitácora activa
  if (showPlaneacion && (!logId || logId === 'new') && log) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/mountain-logs')}
              className="h-9 w-9 p-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold">Planeación de Expedición</h1>
            </div>
            <div className="w-9" />
          </div>
        </div>
        <PlaneacionForm
          log={log}
          onUpdate={async (updatedLog) => {
            setLog(updatedLog)
            try {
              await saveMountainLog(updatedLog)
            } catch (error) {
              console.error('Error al guardar:', error)
            }
          }}
          onComplete={() => {
            setShowPlaneacion(false)
            setShowAvisoSalida(true)
          }}
          onSkip={() => {
            // Si omite planeación, asegurar que tenga nombre mínimo
            if (!log.title || log.title === 'Nueva Bitácora') {
              const updatedLog = {
                ...log,
                title: `Bitácora ${new Date().toLocaleDateString('es-ES')}`
              }
              setLog(updatedLog)
              saveMountainLog(updatedLog)
            }
            setShowPlaneacion(false)
            setShowAvisoSalida(true)
          }}
        />
      </div>
    )
  }


  // Mostrar formulario de Aviso de Salida si es nueva bitácora activa
  if (showAvisoSalida && (!logId || logId === 'new') && log && !log.isHistorical) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/mountain-logs')}
              className="h-9 w-9 p-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold">Aviso de salida — Socorro de montaña</h1>
            </div>
            <div className="w-9" />
          </div>
        </div>
        <AvisoSalidaForm
          log={log}
          onUpdate={async (updatedLog) => {
            setLog(updatedLog)
            // Guardar automáticamente para que los datos persistan
            try {
              await saveMountainLog(updatedLog)
            } catch (error) {
              console.error('Error al guardar:', error)
            }
          }}
          onComplete={async () => {
            // Verificar que no tenga ya un aviso de salida (cada bitácora solo puede tener uno)
            if (log.avisoSalida && logId) {
              toast.warning('Esta bitácora ya tiene un aviso de salida registrado')
              navigate(`/mountain-logs/${log.logId}`)
              return
            }
            
            setShowAvisoSalida(false)
            // Actualizar título con lugar de destino si existe
            // REGLA: Asignar cuenta activa automáticamente si no está asignada (solo al crear)
            const currentAccount = activeAccount || (accounts.length > 0 ? accounts[0].address : undefined)
            const updatedLog = {
              ...log,
              title: log.avisoSalida?.actividad.lugarDestino || log.title || 'Nueva Bitácora',
              location: log.avisoSalida?.actividad.regionDestino || '',
              mountainName: log.avisoSalida?.actividad.lugarDestino || '',
              // Asignar cuenta activa si no está asignada (solo al crear)
              relatedAccount: log.relatedAccount || currentAccount,
              // Cambiar estado de "draft" a "in_progress" cuando se completa el aviso de salida
              status: log.status === 'draft' ? 'in_progress' : log.status,
            }
            setLog(updatedLog)
            await saveMountainLog(updatedLog)
            toast.success('Aviso de salida completado. Bitácora en progreso.')
            navigate(`/mountain-logs/${log.logId}`)
          }}
        />
      </div>
    )
  }

  // Si estamos cargando, mostrar estado de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando bitácora...</p>
        </div>
      </div>
    )
  }

  // Si no hay log y no es una nueva bitácora, mostrar error
  if (!log && logId && logId !== 'new') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Bitácora no encontrada</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate('/mountain-logs')}
          >
            Volver a Bitácoras
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header fijo */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/mountain-logs')}
            className="h-9 w-9 p-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold truncate px-2">{log.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {log.avisoSalida && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAvisoSalidaView(true)}
                className="h-9"
                title="Ver Aviso de Salida"
              >
                <Info className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Aviso</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="h-9"
              title="Exportar a PDF"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            {document && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSignDialog(true)}
                className="h-9"
                title="Firmar PDF"
              >
                <PenTool className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Firmar</span>
              </Button>
            )}
            {!isReadOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-9"
                title="Guardar cambios (no finaliza la bitácora)"
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal - Timeline de milestones */}
      <div className="px-4 py-6 space-y-6">
        {/* Selector de cuenta - Solo mostrar si hay más de una cuenta Y la bitácora aún no tiene cuenta asignada (solo al crear) */}
        {/* REGLA: No se puede cambiar la cuenta después de crear la bitácora */}
        {accounts.length > 1 && log && !log.relatedAccount && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="account-selector" className="text-sm font-medium mb-2 block">
                    Cuenta asociada a esta bitácora
                  </Label>
                  <Select
                    value={log.relatedAccount || activeAccount || accounts[0]?.address || ''}
                    onValueChange={handleChangeAccount}
                  >
                    <SelectTrigger id="account-selector">
                      <SelectValue>
                        {log.relatedAccount
                          ? accounts.find(acc => acc.address === log.relatedAccount)?.meta.name || 
                            `${log.relatedAccount.substring(0, 8)}...`
                          : 'Seleccionar cuenta'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.address} value={account.address}>
                          {account.meta.name || 'Sin nombre'} - {account.address.substring(0, 8)}...
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    Esta cuenta se asociará permanentemente a esta bitácora y al aviso de salida. No se podrá cambiar después.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mostrar cuenta actual si ya está asignada (solo lectura) */}
        {log && log.relatedAccount && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium mb-2 block">
                    Cuenta asociada a esta bitácora
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {accounts.find(acc => acc.address === log.relatedAccount)?.meta.name || 'Sin nombre'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {log.relatedAccount.substring(0, 8)}...{log.relatedAccount.slice(-8)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    La cuenta está asociada permanentemente a esta bitácora y no se puede cambiar.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Panel de Emergencias - Muestra emergencias activas (solo si hay milestones) */}
        <EmergencyPanel 
          logId={log.logId}
          log={log}
          onEmergencyUpdate={() => {
            // Recargar si es necesario
            if (import.meta.env.DEV) {
              console.log('[MountainLogDetail] Emergencia actualizada')
            }
          }}
        />

        {/* Botón de Emergencia - Solo visible en bitácoras activas (no históricas) */}
        {!isReadOnly && !log.isHistorical && (
          <Card className="border-destructive/50 bg-destructive/5" data-emergency-section>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-destructive mb-1">¿Necesitas ayuda de emergencia?</h3>
                  <p className="text-sm text-muted-foreground">
                    {isMobile 
                      ? 'Usa el botón flotante (FAB) a la izquierda para crear una emergencia rápidamente.'
                      : 'Si estás en una situación de emergencia, presiona el botón para enviar una alerta a la blockchain.'
                    }
                  </p>
                </div>
                {/* EmergencyButton maneja automáticamente FAB en móvil y botón en desktop */}
                <EmergencyButton 
                  log={log}
                  currentLocation={currentLocation}
                  onEmergencyCreated={(emergencyId) => {
                    if (import.meta.env.DEV) {
                      console.log('[MountainLogDetail] Emergencia creada:', emergencyId)
                    }
                    toast.info('Emergencia activa. Revisa el estado en el panel de emergencias.')
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mapa de la ruta - Solo mostrar si la bitácora está finalizada */}
        {isReadOnly && (
          <RouteMap log={log} />
        )}

        {/* Estadísticas de la bitácora */}
        {log.statistics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5" />
                Estadísticas de la Ruta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {log.statistics.totalDistance !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Distancia Total</p>
                    <p className="text-lg font-semibold">{(log.statistics.totalDistance / 1000).toFixed(2)} km</p>
                  </div>
                )}
                {log.statistics.totalDuration !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Duración Total</p>
                    <p className="text-lg font-semibold">
                      {formatDuration(log.statistics.totalDuration)}
                    </p>
                  </div>
                )}
                {log.statistics.maxElevation !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Elevación Máxima</p>
                    <p className="text-lg font-semibold">{Math.round(log.statistics.maxElevation)} m</p>
                  </div>
                )}
                {log.statistics.minElevation !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Elevación Mínima</p>
                    <p className="text-lg font-semibold">{Math.round(log.statistics.minElevation)} m</p>
                  </div>
                )}
                {log.statistics.totalElevationGain !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Elevación Ganada</p>
                    <p className="text-lg font-semibold">{Math.round(log.statistics.totalElevationGain)} m</p>
                  </div>
                )}
                {log.statistics.totalElevationLoss !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Elevación Perdida</p>
                    <p className="text-lg font-semibold">{Math.round(log.statistics.totalElevationLoss)} m</p>
                  </div>
                )}
                {log.statistics.maxSpeed !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Velocidad Máxima</p>
                    <p className="text-lg font-semibold">{(log.statistics.maxSpeed * 3.6).toFixed(1)} km/h</p>
                  </div>
                )}
                {log.statistics.averageSpeed !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Velocidad Promedio</p>
                    <p className="text-lg font-semibold">{(log.statistics.averageSpeed * 3.6).toFixed(1)} km/h</p>
                  </div>
                )}
                {log.startDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Tiempo de Inicio</p>
                    <p className="text-lg font-semibold">
                      {new Date(log.startDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
                {log.endDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Tiempo Final</p>
                    <p className="text-lg font-semibold">
                      {new Date(log.endDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
                {log.statistics.numberOfPhotos !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Fotos</p>
                    <p className="text-lg font-semibold">{log.statistics.numberOfPhotos}</p>
                  </div>
                )}
                {log.statistics.numberOfWaypoints !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Milestones</p>
                    <p className="text-lg font-semibold">{log.statistics.numberOfWaypoints}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Información de tracking - Solo para bitácoras activas */}
        {isTracking && !log.isHistorical && (
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Tracking activo</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStopTracking}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Detener
                </Button>
              </div>
              {currentLocation && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  {currentLocation.altitude && ` • ${Math.round(currentLocation.altitude)}m`}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Timeline de milestones */}
        <div className="space-y-4">
          {log.milestones.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MountainIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No hay milestones aún. Agrega tu primer milestone para comenzar.
                </p>
                {!isReadOnly && (
                  <Button onClick={() => setShowAddMilestone(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Primer Milestone
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              {/* Línea vertical de timeline */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
              
              {log.milestones.map((milestone, index) => (
                <div key={milestone.id} className="relative flex gap-4 pb-6">
                  {/* Punto del timeline */}
                  <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full ${getMilestoneColor(milestone.type)} flex items-center justify-center text-white shadow-lg`}>
                    {getMilestoneIcon(milestone.type)}
                  </div>

                  {/* Contenido del milestone */}
                  <div className="flex-1 min-w-0 pt-1">
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base mb-1">{milestone.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(milestone.timestamp)}</span>
                              {milestone.gpsPoint && (
                                <>
                                  <span>•</span>
                                  <MapPin className="h-3 w-3 text-primary" />
                                  <span className="font-mono text-xs">
                                    {milestone.gpsPoint.latitude.toFixed(4)}, {milestone.gpsPoint.longitude.toFixed(4)}
                                    {milestone.gpsPoint.altitude && ` • ${Math.round(milestone.gpsPoint.altitude)}m`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDeleteMilestone(milestone.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Tipo de milestone */}
                        <div className="mb-2">
                          <Badge variant="outline" className="text-xs">
                            {milestone.type === 'checkpoint' ? 'Punto de Control' :
                             milestone.type === 'camp' ? 'Campamento' :
                             milestone.type === 'summit' ? 'Cumbre' :
                             milestone.type === 'photo' ? 'Foto' :
                             milestone.type === 'note' ? 'Nota' : 'Personalizado'}
                          </Badge>
                        </div>

                        {milestone.description && (
                          <div className="mb-3">
                            <div className="p-3 bg-muted/30 rounded-lg">
                              <p className={`text-sm text-foreground ${milestone.description.length > 150 ? 'line-clamp-3' : ''}`}>
                                {milestone.description}
                              </p>
                            </div>
                            {milestone.description.length > 150 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-xs h-auto py-1 px-2"
                                onClick={() => setSelectedMilestoneDescription({
                                  title: milestone.title,
                                  description: milestone.description || ''
                                })}
                              >
                                Ver descripción completa...
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Información GPS simplificada del milestone */}
                        {milestone.gpsPoint && (
                          <div className="mb-3">
                            <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                              (milestone.gpsPoint as any).suspicious 
                                ? 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-700' 
                                : 'bg-muted/50 border border-border'
                            }`}>
                              <MapPin className={`h-3.5 w-3.5 flex-shrink-0 ${
                                (milestone.gpsPoint as any).suspicious 
                                  ? 'text-yellow-600 dark:text-yellow-400' 
                                  : 'text-primary'
                              }`} />
                              <div className="flex-1 flex items-center gap-3 flex-wrap">
                                {milestone.gpsPoint.altitude && (
                                  <span className="font-medium">{Math.round(milestone.gpsPoint.altitude)} m</span>
                                )}
                                {milestone.gpsPoint.accuracy && (
                                  <span className="text-muted-foreground">
                                    Precisión: ±{Math.round(milestone.gpsPoint.accuracy)} m
                                  </span>
                                )}
                                {(milestone.gpsPoint as any).suspicious && (
                                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                    ⚠️ Sospechoso
                                  </Badge>
                                )}
                                {(milestone.gpsPoint as any).confidence !== undefined && (milestone.gpsPoint as any).confidence < 70 && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    {(milestone.gpsPoint as any).confidence}%
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {(milestone.gpsPoint as any).suspicionReason && (
                              <div className="mt-1 p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs text-yellow-900 dark:text-yellow-100">
                                ⚠️ {(milestone.gpsPoint as any).suspicionReason}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Metadata adicional del milestone */}
                        {milestone.metadata && Object.keys(milestone.metadata).length > 0 && (
                          <Card className="mb-3 bg-muted/30">
                            <CardContent className="p-3">
                              <div className="text-xs space-y-1">
                                <div className="font-semibold text-sm mb-2">Información Adicional</div>
                                {milestone.metadata.elevation && (
                                  <div>
                                    <span className="text-muted-foreground">Elevación: </span>
                                    <span className="font-semibold">{milestone.metadata.elevation} m</span>
                                  </div>
                                )}
                                {milestone.metadata.weather && (
                                  <div>
                                    <span className="text-muted-foreground">Clima: </span>
                                    <span>{milestone.metadata.weather}</span>
                                  </div>
                                )}
                                {milestone.metadata.temperature && (
                                  <div>
                                    <span className="text-muted-foreground">Temperatura: </span>
                                    <span>{milestone.metadata.temperature}°C</span>
                                  </div>
                                )}
                                {milestone.metadata.duration && (
                                  <div>
                                    <span className="text-muted-foreground">Duración: </span>
                                    <span>{Math.round(milestone.metadata.duration / 60)} min</span>
                                  </div>
                                )}
                                {milestone.metadata.distance && (
                                  <div>
                                    <span className="text-muted-foreground">Distancia: </span>
                                    <span>{(milestone.metadata.distance / 1000).toFixed(2)} km</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Imágenes del milestone */}
                        {milestone.images.length > 0 && (
                          <div className="mb-3">
                            <ImageGallery
                              images={milestone.images}
                              onDelete={!isReadOnly ? (imageId) => handleDeleteImageFromMilestone(milestone.id, imageId) : undefined}
                              onImageUpdate={!isReadOnly ? (imageId, updates) => handleImageUpdateInMilestone(milestone.id, imageId, updates) : undefined}
                              canDelete={!isReadOnly}
                            />
                          </div>
                        )}

                        {/* Botón para agregar imagen */}
                        {!isReadOnly && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleAddImageToMilestone(milestone.id)}
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Agregar Foto
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FABs de acción - Solo en móvil y solo para bitácoras activas */}
        {!isReadOnly && isMobile && !log.isHistorical && (
          <>
            {/* FAB para agregar milestone - Derecha, más arriba */}
            <FAB
              icon={Plus}
              label="Agregar Milestone"
              onClick={() => setShowAddMilestone(true)}
              variant="default"
              position="right"
              bottomOffset={44} // 11rem desde abajo (encima de otros FABs)
              aria-label="Agregar Milestone"
            />
            
            {/* FAB de Tracking GPS - Derecha, medio */}
            {!isTracking ? (
              <FAB
                icon={Play}
                label="Iniciar Tracking GPS"
                onClick={handleStartTracking}
                variant="default"
                position="right"
                bottomOffset={20} // 5rem desde abajo
                secondaryIcon={Navigation} // Icono GPS secundario
                disabled={!hasPermission}
                aria-label="Iniciar Tracking GPS"
              />
            ) : (
              <FAB
                icon={Pause}
                label="Detener Tracking GPS"
                onClick={handleStopTracking}
                variant="outline"
                position="right"
                bottomOffset={20} // 5rem desde abajo
                secondaryIcon={Navigation} // Icono GPS secundario
                aria-label="Detener Tracking GPS"
              />
            )}
            
            {/* FAB de Finalizar Bitácora - Izquierda, encima del de emergencia */}
            {log.status !== 'completed' && (
              <FAB
                icon={CheckCircle}
                label="Finalizar Bitácora"
                onClick={handleFinalize}
                variant="destructive"
                position="left"
                bottomOffset={20} // 5rem desde abajo (encima del de emergencia)
                disabled={saving}
                aria-label="Finalizar Bitácora"
              />
            )}
          </>
        )}

        {/* FABs para bitácoras históricas (agregar milestone y finalizar) */}
        {!isReadOnly && isMobile && log.isHistorical && (
          <>
            <FAB
              icon={Plus}
              label="Agregar Milestone"
              onClick={() => setShowAddMilestone(true)}
              variant="default"
              position="right"
              bottomOffset={44}
              aria-label="Agregar Milestone"
            />
            {log.status !== 'completed' && (
              <FAB
                icon={CheckCircle}
                label="Finalizar Bitácora"
                onClick={handleFinalize}
                variant="destructive"
                position="left"
                bottomOffset={20}
                disabled={saving}
                aria-label="Finalizar Bitácora"
              />
            )}
          </>
        )}

        {/* Botones de acción para desktop - Barra inferior para bitácoras activas */}
        {!isReadOnly && !isMobile && !log.isHistorical && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 space-y-2 z-10 safe-area-bottom">
            {!isTracking ? (
              <Button
                className="w-full"
                onClick={handleStartTracking}
                disabled={!hasPermission}
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Tracking GPS
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleStopTracking}
              >
                <Square className="h-4 w-4 mr-2" />
                Detener Tracking
              </Button>
            )}
            {log.status !== 'completed' && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleFinalize}
                disabled={saving}
              >
                Finalizar Bitácora
              </Button>
            )}
          </div>
        )}

        {/* Botones de acción para desktop - Barra inferior para bitácoras históricas */}
        {!isReadOnly && !isMobile && log.isHistorical && log.status !== 'completed' && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-10 safe-area-bottom">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleFinalize}
              disabled={saving}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Finalizar Bitácora Histórica
            </Button>
          </div>
        )}
      </div>

      {/* Dialog para agregar milestone */}
      <Dialog open={showAddMilestone} onOpenChange={setShowAddMilestone}>
        <DialogContent className={`mx-4 max-h-[90vh] overflow-y-auto ${log.isHistorical ? 'sm:max-w-[600px]' : 'sm:max-w-[425px]'}`}>
          <DialogHeader>
            <DialogTitle>Nuevo Milestone</DialogTitle>
            <DialogDescription>
              {log.isHistorical 
                ? 'Agrega un nuevo hito a tu bitácora histórica. Todos los campos son manuales.'
                : 'Agrega un nuevo hito a tu bitácora'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="milestone-title">Título *</Label>
              <Input
                id="milestone-title"
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                placeholder="Ej: Base Camp"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="milestone-type">Tipo</Label>
              <Select
                value={newMilestoneType}
                onValueChange={(value) => setNewMilestoneType(value as MountainLogMilestone['type'])}
              >
                <SelectTrigger id="milestone-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkpoint">Checkpoint</SelectItem>
                  <SelectItem value="camp">Campamento</SelectItem>
                  <SelectItem value="summit">Cima</SelectItem>
                  <SelectItem value="photo">Foto</SelectItem>
                  <SelectItem value="note">Nota</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="milestone-description">Descripción</Label>
              <Textarea
                id="milestone-description"
                value={newMilestoneDescription}
                onChange={(e) => setNewMilestoneDescription(e.target.value)}
                placeholder="Descripción opcional..."
                rows={3}
              />
            </div>

            {/* Para bitácoras activas: mostrar GPS automático */}
            {!log.isHistorical && currentLocation && (
              <div className="p-3 bg-muted rounded-lg text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-3 w-3" />
                  <span className="font-medium">Ubicación GPS disponible</span>
                </div>
                <div className="text-muted-foreground">
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  {currentLocation.altitude && ` • ${Math.round(currentLocation.altitude)}m`}
                </div>
              </div>
            )}

            {/* Para bitácoras históricas: entrada manual completa */}
            {log.isHistorical && (
              <div className="space-y-4">
                {/* Fechas y Horas */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Fechas y Horas</Label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="fecha-inicio" className="text-xs">Fecha de Inicio</Label>
                      <Input
                        id="fecha-inicio"
                        type="date"
                        value={manualDateTime.fechaInicio}
                        onChange={(e) => setManualDateTime({ ...manualDateTime, fechaInicio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hora-inicio" className="text-xs">Hora de Inicio</Label>
                      <Input
                        id="hora-inicio"
                        type="time"
                        value={manualDateTime.horaInicio}
                        onChange={(e) => setManualDateTime({ ...manualDateTime, horaInicio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fecha-llegada" className="text-xs">Fecha de Llegada</Label>
                      <Input
                        id="fecha-llegada"
                        type="date"
                        value={manualDateTime.fechaLlegada}
                        onChange={(e) => setManualDateTime({ ...manualDateTime, fechaLlegada: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hora-llegada" className="text-xs">Hora de Llegada</Label>
                      <Input
                        id="hora-llegada"
                        type="time"
                        value={manualDateTime.horaLlegada}
                        onChange={(e) => setManualDateTime({ ...manualDateTime, horaLlegada: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fecha-salida" className="text-xs">Fecha de Salida</Label>
                      <Input
                        id="fecha-salida"
                        type="date"
                        value={manualDateTime.fechaSalida}
                        onChange={(e) => setManualDateTime({ ...manualDateTime, fechaSalida: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hora-salida" className="text-xs">Hora de Salida</Label>
                      <Input
                        id="hora-salida"
                        type="time"
                        value={manualDateTime.horaSalida}
                        onChange={(e) => setManualDateTime({ ...manualDateTime, horaSalida: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La fecha y hora de inicio se usarán como timestamp del milestone. Las demás fechas se guardarán como metadata.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Coordenadas GPS (Manual)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="manual-lat" className="text-xs">Latitud</Label>
                      <Input
                        id="manual-lat"
                        type="number"
                        step="any"
                        value={manualGPS.latitude}
                        onChange={(e) => setManualGPS({ ...manualGPS, latitude: e.target.value })}
                        placeholder="-33.4489"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="manual-lon" className="text-xs">Longitud</Label>
                      <Input
                        id="manual-lon"
                        type="number"
                        step="any"
                        value={manualGPS.longitude}
                        onChange={(e) => setManualGPS({ ...manualGPS, longitude: e.target.value })}
                        placeholder="-70.6693"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="manual-alt" className="text-xs">Altitud (m)</Label>
                      <Input
                        id="manual-alt"
                        type="number"
                        step="any"
                        value={manualGPS.altitude}
                        onChange={(e) => setManualGPS({ ...manualGPS, altitude: e.target.value })}
                        placeholder="520"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ingresa las coordenadas manualmente o sube un archivo GPX
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gpx-file">Archivo GPX (Opcional)</Label>
                  <Input
                    id="gpx-file"
                    type="file"
                    accept=".gpx"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.name.endsWith('.gpx')) {
                          setGpxFile(file)
                          toast.info('Archivo GPX seleccionado. Se extraerán las coordenadas al crear el milestone.')
                        } else {
                          toast.error('Por favor selecciona un archivo GPX válido')
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sube un archivo GPX para extraer coordenadas automáticamente. Si el GPX tiene múltiples waypoints, se usará el primero.
                  </p>
                  {gpxFile && (
                    <div className="p-2 bg-muted rounded text-xs">
                      <span className="font-medium">Archivo seleccionado:</span> {gpxFile.name}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowAddMilestone(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleAddMilestone}
              disabled={!newMilestoneTitle.trim()}
            >
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Input oculto para captura de imágenes */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture={isMobile ? "environment" : undefined}
        onChange={handleImageFile}
        className="hidden"
        // En móviles: capture="environment" abre la cámara trasera automáticamente
        // En desktop: permite seleccionar archivo desde el sistema o usar webcam si el navegador lo soporta
      />

      {/* Dialog para ver Aviso de Salida */}
      <Dialog open={showAvisoSalidaView} onOpenChange={setShowAvisoSalidaView}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aviso de salida — Socorro de montaña</DialogTitle>
            <DialogDescription>
              Información completa del aviso de salida registrado
            </DialogDescription>
          </DialogHeader>
          {log.avisoSalida && <AvisoSalidaView avisoSalida={log.avisoSalida} relatedAccount={log.relatedAccount} />}
        </DialogContent>
      </Dialog>

      {/* Dialog para capturar foto desde webcam o archivo */}
      <Dialog open={showCameraDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCameraDialog(false)
          setCurrentMilestoneForImage(null)
          milestoneIdForCapture.current = null
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Imagen al Milestone</DialogTitle>
            <DialogDescription>
              Elige cómo deseas agregar la imagen: desde un archivo o capturando con la cámara web
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={handleFileSelect}
                className="flex flex-col items-center gap-2 h-auto py-6"
              >
                <ImageIcon className="h-8 w-8" />
                <span className="font-medium">Desde Archivo</span>
                <span className="text-xs text-muted-foreground">Galería o explorador</span>
              </Button>
              <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-muted/30">
                <Camera className="h-8 w-8 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  O usa la cámara web abajo
                </p>
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="mb-2 text-sm font-medium">Capturar desde cámara web:</div>
              <PhotoCapture
                onCapture={handleCameraCapture}
                onCancel={() => {
                  setShowCameraDialog(false)
                  setCurrentMilestoneForImage(null)
                  milestoneIdForCapture.current = null
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver descripción completa del milestone */}
      <Dialog open={selectedMilestoneDescription !== null} onOpenChange={(open) => !open && setSelectedMilestoneDescription(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMilestoneDescription?.title}</DialogTitle>
            <DialogDescription>
              Descripción completa del milestone
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">
                {selectedMilestoneDescription?.description}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para firmar documento */}
      {document && (
        <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Firmar Bitácora</DialogTitle>
              <DialogDescription>
                Firma el PDF de la bitácora para validar su autenticidad
              </DialogDescription>
            </DialogHeader>
            <SignatureSelector
              document={document}
              onSigned={handleSignDocument}
              onCancel={() => setShowSignDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}

    </div>
  )
}
