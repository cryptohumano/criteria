/**
 * Script de seed para generar bitácoras de ejemplo con ubicaciones variadas en Chile
 * Similar a la generación de datos para el aviso de salida
 */

import type { MountainLog } from '@/types/mountainLogs'
import type { GPSMetadata } from '@/types/documents'
import { saveMountainLog } from './mountainLogStorage'

// Ubicaciones de montañas famosas en Chile con coordenadas reales
const MOUNTAIN_LOCATIONS: Array<{
  name: string
  location: string
  region: string
  coordinates: { lat: number; lon: number; altitude: number }
  routes: Array<{ name: string; difficulty: string }>
}> = [
  {
    name: 'Cerro El Plomo',
    location: 'Cordillera de los Andes',
    region: 'Región Metropolitana',
    coordinates: { lat: -33.2406, lon: -70.1294, altitude: 5424 },
    routes: [
      { name: 'Ruta Normal por Glaciar La Ollada', difficulty: 'alta_montana' },
      { name: 'Ruta por Glaciar del Plomo', difficulty: 'alta_montana' }
    ]
  },
  {
    name: 'Volcán Villarrica',
    location: 'Parque Nacional Villarrica',
    region: 'Región de la Araucanía',
    coordinates: { lat: -39.4203, lon: -71.9431, altitude: 2847 },
    routes: [
      { name: 'Ruta Normal', difficulty: 'moderada' },
      { name: 'Ruta por Glaciar', difficulty: 'dificil' }
    ]
  },
  {
    name: 'Cerro Tronador',
    location: 'Parque Nacional Vicente Pérez Rosales',
    region: 'Región de los Lagos',
    coordinates: { lat: -41.1578, lon: -71.8889, altitude: 3491 },
    routes: [
      { name: 'Ruta Normal por Glaciar', difficulty: 'dificil' },
      { name: 'Ruta por Cara Sur', difficulty: 'muy_dificil' }
    ]
  },
  {
    name: 'Cerro Aconcagua',
    location: 'Cordillera de los Andes',
    region: 'Región de Valparaíso',
    coordinates: { lat: -32.6532, lon: -70.0106, altitude: 6961 },
    routes: [
      { name: 'Ruta Normal', difficulty: 'alta_montana' },
      { name: 'Ruta del Glaciar de los Polacos', difficulty: 'extrema' }
    ]
  },
  {
    name: 'Volcán Osorno',
    location: 'Parque Nacional Vicente Pérez Rosales',
    region: 'Región de los Lagos',
    coordinates: { lat: -41.1056, lon: -72.4931, altitude: 2652 },
    routes: [
      { name: 'Ruta Normal', difficulty: 'moderada' },
      { name: 'Ruta por Glaciar', difficulty: 'dificil' }
    ]
  },
  {
    name: 'Cerro San Valentín',
    location: 'Parque Nacional Laguna San Rafael',
    region: 'Región de Aysén',
    coordinates: { lat: -46.5956, lon: -73.2208, altitude: 4058 },
    routes: [
      { name: 'Ruta Normal', difficulty: 'dificil' },
      { name: 'Ruta por Cara Norte', difficulty: 'muy_dificil' }
    ]
  },
  {
    name: 'Volcán Llaima',
    location: 'Parque Nacional Conguillío',
    region: 'Región de la Araucanía',
    coordinates: { lat: -38.6922, lon: -71.7292, altitude: 3125 },
    routes: [
      { name: 'Ruta Normal', difficulty: 'moderada' },
      { name: 'Ruta por Glaciar', difficulty: 'dificil' }
    ]
  },
  {
    name: 'Cerro El Morado',
    location: 'Cajón del Maipo',
    region: 'Región Metropolitana',
    coordinates: { lat: -33.7833, lon: -70.1167, altitude: 5060 },
    routes: [
      { name: 'Ruta Normal', difficulty: 'moderada' },
      { name: 'Ruta por Glaciar', difficulty: 'dificil' }
    ]
  },
  {
    name: 'Volcán Puyehue',
    location: 'Parque Nacional Puyehue',
    region: 'Región de los Lagos',
    coordinates: { lat: -40.5903, lon: -72.1167, altitude: 2236 },
    routes: [
      { name: 'Ruta Normal', difficulty: 'facil' },
      { name: 'Ruta por Glaciar', difficulty: 'moderada' }
    ]
  },
  {
    name: 'Cerro El Altar',
    location: 'Cajón del Maipo',
    region: 'Región Metropolitana',
    coordinates: { lat: -33.7167, lon: -70.0833, altitude: 5226 },
    routes: [
      { name: 'Ruta Normal', difficulty: 'dificil' },
      { name: 'Ruta por Glaciar', difficulty: 'muy_dificil' }
    ]
  }
]

// Nombres de guías
const GUIDE_NAMES = [
  { nombres: 'Juan Carlos', apellidos: 'Pérez González' },
  { nombres: 'María Elena', apellidos: 'Rodríguez Silva' },
  { nombres: 'Pedro Ignacio', apellidos: 'López Martínez' },
  { nombres: 'Ana Sofía', apellidos: 'Torres Fernández' },
  { nombres: 'Diego Alejandro', apellidos: 'González Muñoz' }
]

// Generar puntos GPS para una ruta
function generateGPSPoints(
  start: { lat: number; lon: number; altitude: number },
  end: { lat: number; lon: number; altitude: number },
  numPoints: number = 20
): Array<{ latitude: number; longitude: number; altitude?: number; timestamp: number; speed?: number; heading?: number }> {
  const points: Array<{ latitude: number; longitude: number; altitude?: number; timestamp: number; speed?: number; heading?: number }> = []
  const startTime = Date.now() - (numPoints * 60000) // Hace numPoints minutos

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1)
    const lat = start.lat + (end.lat - start.lat) * t
    const lon = start.lon + (end.lon - start.lon) * t
    const alt = start.altitude + (end.altitude - start.altitude) * t

    // Agregar variación aleatoria pequeña para simular movimiento real
    const latVariation = (Math.random() - 0.5) * 0.001
    const lonVariation = (Math.random() - 0.5) * 0.001
    const altVariation = (Math.random() - 0.5) * 50

    points.push({
      latitude: lat + latVariation,
      longitude: lon + lonVariation,
      altitude: Math.max(0, alt + altVariation),
      timestamp: startTime + (i * 60000),
      speed: 0.5 + Math.random() * 1.5, // 0.5-2 m/s
      heading: Math.random() * 360
    })
  }

  return points
}

// Generar milestones para una bitácora
function generateMilestones(
  startLocation: GPSMetadata,
  endLocation: GPSMetadata,
  mountainName: string
): Array<{
  id: string
  timestamp: number
  title: string
  description?: string
  type: 'checkpoint' | 'camp' | 'summit' | 'photo' | 'note' | 'custom'
  gpsPoint?: GPSMetadata
  images: any[]
  notes?: string
  metadata?: any
  order: number
}> {
  const milestones = []
  const startTime = startLocation.timestamp
  const duration = 3 * 24 * 60 * 60 * 1000 // 3 días

  // Milestone 1: Inicio
  milestones.push({
    id: `milestone-${Date.now()}-1`,
    timestamp: startTime,
    title: 'Inicio de la expedición',
    description: `Comienzo del ascenso a ${mountainName}`,
    type: 'checkpoint' as const,
    gpsPoint: startLocation,
    images: [],
    order: 1
  })

  // Milestone 2: Campamento base
  const campTime = startTime + (duration * 0.3)
  milestones.push({
    id: `milestone-${Date.now()}-2`,
    timestamp: campTime,
    title: 'Campamento Base',
    description: 'Establecimiento del campamento base',
    type: 'camp' as const,
    gpsPoint: {
      latitude: startLocation.latitude + (endLocation.latitude - startLocation.latitude) * 0.3,
      longitude: startLocation.longitude + (endLocation.longitude - startLocation.longitude) * 0.3,
      altitude: (startLocation.altitude || 0) + ((endLocation.altitude || 0) - (startLocation.altitude || 0)) * 0.3,
      timestamp: campTime,
      accuracy: 10
    },
    images: [],
    metadata: {
      elevation: (startLocation.altitude || 0) + ((endLocation.altitude || 0) - (startLocation.altitude || 0)) * 0.3,
      weather: 'Despejado',
      temperature: -5
    },
    order: 2
  })

  // Milestone 3: Cumbre
  milestones.push({
    id: `milestone-${Date.now()}-3`,
    timestamp: startTime + (duration * 0.7),
    title: `Cumbre de ${mountainName}`,
    description: `Llegada a la cumbre`,
    type: 'summit' as const,
    gpsPoint: endLocation,
    images: [],
    metadata: {
      elevation: endLocation.altitude,
      weather: 'Despejado',
      temperature: -15
    },
    order: 3
  })

  return milestones
}

// Generar una bitácora completa
function generateMountainLog(
  mountain: typeof MOUNTAIN_LOCATIONS[0],
  routeIndex: number = 0,
  accountAddress?: string
): MountainLog {
  const route = mountain.routes[routeIndex]
  const guide = GUIDE_NAMES[Math.floor(Math.random() * GUIDE_NAMES.length)]
  const startDate = Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000 // Últimos 90 días
  const endDate = startDate + (2 + Math.random() * 3) * 24 * 60 * 60 * 1000 // 2-5 días de duración

  const startLocation: GPSMetadata = {
    latitude: mountain.coordinates.lat - 0.1 + Math.random() * 0.2,
    longitude: mountain.coordinates.lon - 0.1 + Math.random() * 0.2,
    altitude: mountain.coordinates.altitude - 1000,
    timestamp: startDate,
    accuracy: 10
  }

  const endLocation: GPSMetadata = {
    latitude: mountain.coordinates.lat,
    longitude: mountain.coordinates.lon,
    altitude: mountain.coordinates.altitude,
    timestamp: endDate,
    accuracy: 10
  }

  const gpsPoints = generateGPSPoints(
    { lat: startLocation.latitude, lon: startLocation.longitude, altitude: startLocation.altitude || 0 },
    { lat: endLocation.latitude, lon: endLocation.longitude, altitude: endLocation.altitude || 0 },
    30
  )

  const milestones = generateMilestones(startLocation, endLocation, mountain.name)

  const statuses: MountainLog['status'][] = ['draft', 'in_progress', 'completed']
  const status = statuses[Math.floor(Math.random() * statuses.length)]

  const log: MountainLog = {
    logId: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: `Ascenso a ${mountain.name}`,
    description: `Expedición de ${route.difficulty} a ${mountain.name} por la ${route.name}`,
    mountainName: mountain.name,
    location: `${mountain.location}, ${mountain.region}`,
    status,
    startDate,
    endDate: status === 'completed' ? endDate : undefined,
    createdAt: startDate - 7 * 24 * 60 * 60 * 1000, // Creada 7 días antes
    updatedAt: Date.now(),
    trackingMode: 'automatic',
    isTrackingActive: status === 'in_progress',
    routes: [
      {
        id: `route-${Date.now()}`,
        name: route.name,
        description: `Ruta ${route.name} hacia ${mountain.name}`,
        points: gpsPoints.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
          timestamp: p.timestamp,
          accuracy: 10,
          speed: p.speed,
          heading: p.heading
        })),
        totalDistance: Math.random() * 15000 + 5000, // 5-20 km
        totalElevationGain: endLocation.altitude! - (startLocation.altitude || 0),
        startTime: startDate,
        endTime: endDate,
        duration: (endDate - startDate) / 1000, // Convertir de milisegundos a segundos
        averageSpeed: 0.8 + Math.random() * 0.5,
        maxSpeed: 2 + Math.random() * 1,
        createdAt: startDate,
        updatedAt: endDate
      }
    ],
    milestones,
    entries: [],
    images: [],
    gpsPoints: gpsPoints.map(p => ({
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude,
      timestamp: p.timestamp,
      accuracy: 10,
      speed: p.speed,
      heading: p.heading
    })),
    startLocation,
    endLocation: status === 'completed' ? endLocation : undefined,
    highestPoint: {
      latitude: endLocation.latitude,
      longitude: endLocation.longitude,
      altitude: endLocation.altitude!,
      timestamp: endDate,
      accuracy: 10
    },
    statistics: {
      totalDistance: Math.random() * 15000 + 5000,
      totalElevationGain: endLocation.altitude! - (startLocation.altitude || 0),
      maxElevation: endLocation.altitude,
      minElevation: startLocation.altitude,
      averageSpeed: 0.8 + Math.random() * 0.5,
      maxSpeed: 2 + Math.random() * 1,
      totalDuration: (endDate - startDate) / 1000 // Convertir de milisegundos a segundos
    },
    relatedAccount: accountAddress,
    tags: [route.difficulty, mountain.region.toLowerCase().replace(/\s+/g, '-')],
    weather: {
      conditions: ['Despejado', 'Parcialmente nublado', 'Nublado'][Math.floor(Math.random() * 3)],
      temperature: -10 + Math.random() * 15,
      windSpeed: 10 + Math.random() * 30,
      visibility: 5000 + Math.random() * 10000
    },
    avisoSalida: {
      guia: {
        nombres: guide.nombres,
        apellidos: guide.apellidos,
        rutPasaporte: `${Math.floor(Math.random() * 20) + 10}.${Math.floor(Math.random() * 900) + 100}.${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9)}`,
        email: `${guide.nombres.toLowerCase().replace(/\s+/g, '.')}@ejemplo.com`,
        telefono: `+56 9 ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 9000) + 1000}`,
        nacionalidad: 'Chilena',
        edad: 25 + Math.floor(Math.random() * 20),
        profesion: 'Guía de Montaña',
        experienciaSector: true,
        experienciaExpediciones: true,
        seguroAccidente: true
      },
      actividad: {
        regionDestino: mountain.region,
        lugarDestino: mountain.name,
        ruta: route.name,
        numeroParticipantes: 2 + Math.floor(Math.random() * 4),
        actividadPracticar: route.difficulty === 'alta_montana' ? 'Alta Montaña' : 'Montañismo',
        tipoActividad: route.difficulty === 'alta_montana' ? 'alta_montana' : 'montañismo',
        fechaSalida: startDate,
        fechaRegreso: endDate,
        horaInicio: '06:00',
        horaTermino: '18:00',
        aprovisionamientoDias: Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000))
      },
      contactosEmergencia: [
        {
          nombres: 'Contacto Emergencia 1',
          telefonos: ['+56 9 1234 5678']
        }
      ],
      participantes: [],
      participantesConEnfermedades: [],
      listaChequeo: {}
    }
  }

  return log
}

/**
 * Genera y guarda bitácoras de ejemplo
 */
export async function seedMountainLogs(
  count: number = 10,
  accountAddress?: string
): Promise<MountainLog[]> {
  const logs: MountainLog[] = []

  for (let i = 0; i < count; i++) {
    const mountainIndex = i % MOUNTAIN_LOCATIONS.length
    const mountain = MOUNTAIN_LOCATIONS[mountainIndex]
    const routeIndex = Math.floor(Math.random() * mountain.routes.length)
    
    const log = generateMountainLog(mountain, routeIndex, accountAddress)
    logs.push(log)
    
    try {
      await saveMountainLog(log)
      console.log(`[Seed] ✅ Bitácora creada: ${log.title}`)
    } catch (error) {
      console.error(`[Seed] ❌ Error al crear bitácora ${log.title}:`, error)
    }
  }

  return logs
}
