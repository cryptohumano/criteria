/**
 * Tipos TypeScript para el sistema de bitácoras de montañismo
 */

import type { GPSMetadata } from './documents'

export type MountainLogStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled'

export type TrackingMode = 'manual' | 'automatic'

export interface GPSPoint extends GPSMetadata {
  // Información adicional del punto GPS
  speed?: number // Velocidad en m/s
  heading?: number // Dirección en grados (0-360)
  timestamp: number // Timestamp del punto
}

/** Metadata firmada por criterIA (evidencia genérica); mapeable a C2PA + assertion org.nelai.polkadot (legacy) */
export interface SignedEvidenceMetadata {
  metadata: Record<string, unknown> // Metadata canónica (version, type, contentHash, createdAt, author, ...)
  signature: string // Firma hex (Polkadot)
  signer: string // Dirección SS58 del firmante
}

export interface MountainLogImage {
  id: string // UUID de la imagen
  data: string // Imagen en base64 o blob URL
  thumbnail?: string // Miniatura en base64
  metadata: {
    filename: string
    mimeType: string
    size: number // Tamaño en bytes
    width?: number
    height?: number
    capturedAt: number // Timestamp de captura
    gpsMetadata?: GPSMetadata // GPS al momento de captura
    cameraSettings?: {
      iso?: number
      aperture?: string
      shutterSpeed?: string
      focalLength?: string
    }
    exifData?: Record<string, any> // Datos EXIF adicionales
  }
  description?: string // Descripción opcional de la imagen
  tags?: string[] // Etiquetas para búsqueda
  /** Hash SHA-256 del contenido (hex); para verificación de integridad */
  contentHash?: string
  /** Firma criptográfica de la metadata (criterIA); capa genérica de procedencia */
  signedMetadata?: SignedEvidenceMetadata
  /** UAL del Knowledge Asset en DKG (OriginTrail); si está presente, la evidencia fue publicada */
  dkgUAL?: string
}

export interface MountainLogFile {
  id: string // UUID del archivo
  name: string // Nombre del archivo
  type: string // MIME type (ej: 'application/pdf', 'text/plain')
  data: string // Archivo en base64 o blob URL
  size: number // Tamaño en bytes
  uploadedAt: number // Timestamp de subida
  description?: string // Descripción opcional del archivo
  tags?: string[] // Etiquetas para búsqueda
  /** Hash SHA-256 del contenido (hex); para verificación de integridad */
  contentHash?: string
  /** Firma criptográfica de la metadata (criterIA); capa genérica de procedencia */
  signedMetadata?: SignedEvidenceMetadata
  /** UAL del Knowledge Asset en DKG (OriginTrail); si está presente, la evidencia fue publicada */
  dkgUAL?: string
}

export interface MountainLogEntry {
  id: string // UUID de la entrada
  timestamp: number
  type: 'note' | 'waypoint' | 'photo' | 'gps_point' | 'event'
  content?: string // Contenido de texto (para notas)
  imageId?: string // ID de imagen relacionada (si aplica)
  gpsPoint?: GPSPoint // Punto GPS asociado
  metadata?: Record<string, any> // Metadata adicional
}

export interface MountainLogMilestone {
  id: string // UUID del milestone
  timestamp: number // Timestamp de creación
  title: string // Título del milestone
  description?: string // Descripción opcional
  type: 'checkpoint' | 'camp' | 'summit' | 'photo' | 'note' | 'custom'
  
  // Ubicación GPS
  gpsPoint?: GPSPoint
  
  // Imágenes asociadas
  images: MountainLogImage[]
  
  // Archivos asociados (para bitácoras históricas)
  files?: MountainLogFile[]
  
  // Indica si el timestamp fue ingresado manualmente (bitácoras históricas)
  manualTimestamp?: boolean
  
  // Indica si el GPS fue ingresado manualmente (bitácoras históricas)
  manualGPS?: boolean
  
  // Notas adicionales
  notes?: string
  
  // Metadata personalizada
  metadata?: {
    elevation?: number
    weather?: string
    temperature?: number
    duration?: number // Duración desde el milestone anterior (en segundos)
    distance?: number // Distancia desde el milestone anterior (en metros)
    // Campos para bitácoras históricas
    fechaInicio?: string // Fecha de inicio (formato YYYY-MM-DD)
    horaInicio?: string // Hora de inicio (formato HH:mm)
    fechaLlegada?: string // Fecha de llegada (formato YYYY-MM-DD)
    horaLlegada?: string // Hora de llegada (formato HH:mm)
    fechaSalida?: string // Fecha de salida (formato YYYY-MM-DD)
    horaSalida?: string // Hora de salida (formato HH:mm)
    [key: string]: any
  }
  
  // Orden relativo (basado en timestamp, pero útil para ordenamiento)
  order: number
}

export interface MountainLogRoute {
  id: string // UUID de la ruta
  name: string
  description?: string
  points: GPSPoint[] // Array de puntos GPS que forman la ruta
  totalDistance?: number // Distancia total en metros
  totalElevationGain?: number // Ganancia de elevación total en metros
  totalElevationLoss?: number // Pérdida de elevación total en metros
  startTime?: number // Timestamp de inicio
  endTime?: number // Timestamp de fin
  duration?: number // Duración en segundos
  averageSpeed?: number // Velocidad promedio en m/s
  maxSpeed?: number // Velocidad máxima en m/s
  createdAt: number
  updatedAt: number
}

export interface MountainLog {
  // Identificación
  logId: string // UUID (clave primaria)
  
  // Información básica
  title: string
  description?: string
  mountainName?: string // Nombre de la montaña o ruta
  location?: string // Ubicación general
  
  // Estado
  status: MountainLogStatus
  
  // Tipo de bitácora
  isHistorical?: boolean // true = bitácora histórica (sin aviso de salida, permite entrada manual)
  
  // Fechas
  startDate: number // Timestamp de inicio
  endDate?: number // Timestamp de finalización (si está completada)
  createdAt: number
  updatedAt: number
  
  // Tracking
  trackingMode: TrackingMode
  isTrackingActive: boolean // Si el tracking está activo actualmente
  
  // Rutas y trayectos
  routes: MountainLogRoute[] // Múltiples rutas pueden ser registradas
  
  // Milestones (hitos) - la estructura principal de la bitácora
  milestones: MountainLogMilestone[] // Milestones ordenados por timestamp
  
  // Entradas de bitácora (legacy, mantener para compatibilidad)
  entries: MountainLogEntry[] // Entradas cronológicas (notas, waypoints, eventos)
  
  // Imágenes (legacy, mantener para compatibilidad)
  images: MountainLogImage[] // Imágenes capturadas durante la expedición
  
  // Datos GPS
  gpsPoints: GPSPoint[] // Puntos GPS capturados (si tracking automático)
  
  // Metadata GPS general
  startLocation?: GPSMetadata // Ubicación de inicio
  endLocation?: GPSMetadata // Ubicación de fin
  highestPoint?: GPSPoint // Punto más alto alcanzado
  lowestPoint?: GPSPoint // Punto más bajo
  
  // Estadísticas
  statistics?: {
    totalDistance?: number // Distancia total recorrida en metros
    totalElevationGain?: number // Ganancia de elevación total
    totalElevationLoss?: number // Pérdida de elevación total
    maxElevation?: number // Elevación máxima alcanzada
    minElevation?: number // Elevación mínima
    averageSpeed?: number // Velocidad promedio
    maxSpeed?: number // Velocidad máxima
    totalDuration?: number // Duración total en segundos
    numberOfPhotos?: number
    numberOfWaypoints?: number
  }
  
  // Relaciones
  relatedAccount?: string // Cuenta que creó la bitácora
  relatedDocuments?: string[] // IDs de documentos relacionados
  
  // Metadata adicional
  tags?: string[] // Etiquetas para categorización
  weather?: {
    conditions?: string // Condiciones climáticas
    temperature?: number // Temperatura en Celsius
    windSpeed?: number // Velocidad del viento
    visibility?: number // Visibilidad en metros
    notes?: string
  }
  equipment?: string[] // Equipo utilizado
  participants?: string[] // Participantes (nombres o IDs)
  notes?: string // Notas generales

  // Planeación (opcional, previa al aviso de salida)
  planeacion?: {
    nombreBitacora: string // Nombre asignado a la bitácora
    tipoActividad?: 'montañismo' | 'escalada' | 'esqui' | 'alta_montana' | 'senderismo' | 'trekking' | 'otros'
    dificultad?: 'facil' | 'moderada' | 'dificil' | 'muy_dificil' | 'extrema'
    duracionEstimada?: number // Días estimados
    temporada?: 'verano' | 'invierno' | 'primavera' | 'otoño' | 'todo_el_año'
    condicionesEsperadas?: {
      temperaturaMin?: number
      temperaturaMax?: number
      condicionesClimaticas?: string
      viento?: string
      visibilidad?: string
    }
    equipoSugerido?: {
      // Equipo técnico
      tecnico?: {
        piolets?: boolean
        crampones?: boolean
        cuerdas?: boolean
        arneses?: boolean
        cascos?: boolean
        mosquetones?: boolean
        aseguradores?: boolean
        otros?: string[]
      }
      // Equipo de campamento
      campamento?: {
        carpa?: boolean
        sleepingBag?: boolean
        colchoneta?: boolean
        cocina?: boolean
        otros?: string[]
      }
      // Vestuario
      vestuario?: {
        capasBase?: boolean
        capasMedias?: boolean
        capasExternas?: boolean
        guantes?: boolean
        gorros?: boolean
        gafas?: boolean
        otros?: string[]
      }
      // Seguridad
      seguridad?: {
        gps?: boolean
        brujula?: boolean
        mapa?: boolean
        telefonoSatelital?: boolean
        radio?: boolean
        botiquin?: boolean
        otros?: string[]
      }
    }
    notas?: string
    createdAt: number
    updatedAt: number
  }

  // Aviso de salida / socorro de montaña (único por bitácora)
  avisoSalida?: {
    // Datos personales del guía/líder
    guia: {
      nombres: string
      apellidos: string
      documentoIdentidad?: string
      rutPasaporte?: string
      email?: string
      telefono?: string
      nacionalidad?: string
      edad?: number
      profesion?: string
      telefonos?: string[]
      domicilio?: string
      institucionEmpresa?: string
      experienciaSector: boolean
      experienciaExpediciones: boolean
      seguroAccidente: boolean
      previsionSalud?: string
    }
    
    // Información de la actividad
    actividad: {
      regionDestino?: string
      lugarDestino?: string
      ruta?: string
      archivoRuta?: string // KMZ/GPX
      numeroParticipantes?: number
      actividadPracticar?: string
      equipamientoUtilizar?: string
      fechaSalida: number // Timestamp
      fechaRegreso?: number // Timestamp
      horaInicio?: string // HH:MM
      horaTermino?: string // HH:MM
      tipoActividad?: 'montañismo' | 'escalada' | 'esqui' | 'alta_montana' | 'otros'
      aprovisionamientoDias?: number
    }
    
    // Contactos de emergencia
    contactosEmergencia: Array<{
      nombres: string
      telefonos: string[]
    }>
    
    // Lista de participantes
    participantes: Array<{
      numero: number
      nombres: string
      documentoIdentidad?: string
      telefono?: string
      contactoEmergencia?: string
      telefonoEmergencia?: string
    }>
    
    // Participantes con enfermedades/lesiones
    participantesConEnfermedades: Array<{
      numero: number
      nombres: string
      enfermedadLesion?: string
      observaciones?: string
    }>
    
    // Lista de chequeo de equipamiento
    listaChequeo: {
      mediosOrientacion?: {
        gps: boolean
        brujula: boolean
        otro?: string
      }
      telefonosComunicacion?: {
        movil: boolean
        satelital?: string
      }
      radiosComunicacion?: {
        vhf: boolean
        uhf: boolean
        duales?: string
      }
      cartaTopografica: boolean
      chequeoAlimentacion: boolean
      chequeoEquipoTecnico: boolean
      chequeoEquipoCampamento: boolean
      chequeoVestuario: boolean
      proteccionFrioSolar: boolean
    }
    
    // Equipo técnico
    equipoTecnico?: {
      piolets?: number
      crampones?: number
      metrosCuerdaDinamica?: number
      metrosCuerdaSemiEstatica?: number
      cascos?: number
      arneses?: number
      aseguradores?: number
      ascendedores?: number
      mosquetones?: number
      cordines?: number
      linternas?: number
    }
    
    // Elementos de botiquín
    botiquin?: {
      elementosEntablillado: boolean
      inmovilizadorCuello: boolean
      vendajesFerulas: boolean
      apósitosCintas: boolean
      pinzasTijera: boolean
      guantesQuirurgicos: boolean
      sueroFisiologico: boolean
      analgesicos: boolean
      antinflamatorios: boolean
      antiespasmodicos: boolean
      antihistaminicos: boolean
      antidiarreicos: boolean
      antigripal: boolean
      salesHidratantes: boolean
      manualPrimerosAuxilios: boolean
      cremaQuemaduras: boolean
      libretaLapiz: boolean
      mantaTermica: boolean
      espejoSilbato: boolean
      termometro: boolean
      mantaAgua: boolean
      fosforosEncendedor: boolean
      otros?: string
    }
    
    // Otros de supervivencia
    supervivencia?: {
      otros?: string
    }
  }
  
  // Sincronización
  synced: boolean // Si está sincronizado con servidor
  serverId?: string // ID en el servidor (si existe)
  lastSyncAt?: number // Última sincronización
}
