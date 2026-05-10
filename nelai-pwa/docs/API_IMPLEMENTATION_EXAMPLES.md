# Ejemplos de Implementación de la API

Este documento contiene ejemplos prácticos de cómo implementar la API desde el cliente (PWA) usando TypeScript.

## Configuración Base

### Cliente API

```typescript
// src/services/api/client.ts
export class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string = 'https://api.wallet-service.com/v1') {
    this.baseUrl = baseUrl
  }

  setToken(token: string) {
    this.token = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}
```

## Autenticación

### Servicio de Autenticación

```typescript
// src/services/api/auth.ts
import { ApiClient } from './client'
import type { KeyringPair } from '@polkadot/keyring/types'
import { u8aToHex } from '@polkadot/util'

export interface AuthChallenge {
  challenge: string
  nonce: string
  expiresAt: number
}

export interface AuthResponse {
  token: string
  expiresIn: number
  user: {
    address: string
    publicKey: string
    keyType: string
  }
}

export class AuthService {
  constructor(private api: ApiClient) {}

  async requestChallenge(address: string): Promise<AuthChallenge> {
    return this.api.post<AuthChallenge>('/auth/challenge', {
      address,
      timestamp: Date.now(),
    })
  }

  async verifySignature(
    address: string,
    challenge: string,
    signature: Uint8Array,
    nonce: string
  ): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>('/auth/verify', {
      address,
      challenge,
      signature: u8aToHex(signature),
      nonce,
    })

    this.api.setToken(response.token)
    return response
  }

  async authenticate(pair: KeyringPair): Promise<AuthResponse> {
    const address = pair.address
    const challenge = await this.requestChallenge(address)

    // Firmar el challenge
    const message = new TextEncoder().encode(challenge.challenge)
    const signature = pair.sign(message)

    return this.verifySignature(
      address,
      challenge.challenge,
      signature,
      challenge.nonce
    )
  }
}
```

## Documentos PDF

### Servicio de Documentos

```typescript
// src/services/api/documents.ts
import { ApiClient } from './client'
import type { KeyringPair } from '@polkadot/keyring/types'
import { u8aToHex } from '@polkadot/util'

export interface Document {
  documentId: string
  type: string
  pdf?: string
  hash: string
  signature?: {
    signer: string
    timestamp: number
    valid: boolean
  }
  metadata: {
    createdAt: string
    size: number
    pages: number
  }
}

export interface GenerateDocumentRequest {
  type: string
  template: string
  data: any
  options: {
    format: 'PDF/A-2b' | 'PDF/A-3b'
    includeSignature: boolean
    encrypt: boolean
  }
}

export interface SignDocumentRequest {
  documentId: string
  signerAddress: string
  signature: string
  certificate?: {
    subject: string
    issuer: string
    validFrom: string
    validTo: string
  }
}

export class DocumentService {
  constructor(private api: ApiClient) {}

  async generateDocument(request: GenerateDocumentRequest): Promise<Document> {
    return this.api.post<Document>('/documents/generate', request)
  }

  async signDocument(
    documentId: string,
    pair: KeyringPair,
    certificate?: SignDocumentRequest['certificate']
  ): Promise<Document> {
    // Primero obtener el documento para obtener el hash
    const document = await this.getDocument(documentId)

    // Firmar el hash del documento
    const hashBytes = new Uint8Array(
      document.hash.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    )
    const signature = pair.sign(hashBytes)

    const request: SignDocumentRequest = {
      documentId,
      signerAddress: pair.address,
      signature: u8aToHex(signature),
      certificate,
    }

    return this.api.post<Document>('/documents/sign', request)
  }

  async encryptDocument(
    documentId: string,
    algorithm: string = 'AES-GCM-256'
  ): Promise<Document> {
    return this.api.post<Document>('/documents/encrypt', {
      documentId,
      algorithm,
      keyDerivation: {
        method: 'PBKDF2',
        iterations: 100000,
        salt: this.generateSalt(),
      },
    })
  }

  async getDocument(documentId: string): Promise<Document> {
    return this.api.get<Document>(`/documents/${documentId}`)
  }

  async listDocuments(params?: {
    type?: string
    limit?: number
    offset?: number
    sort?: string
  }): Promise<{ documents: Document[]; pagination: any }> {
    const query = new URLSearchParams()
    if (params?.type) query.set('type', params.type)
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.offset) query.set('offset', params.offset.toString())
    if (params?.sort) query.set('sort', params.sort)

    const endpoint = `/documents${query.toString() ? `?${query}` : ''}`
    return this.api.get<{ documents: Document[]; pagination: any }>(endpoint)
  }

  async verifyDocument(
    documentId: string,
    hash: string,
    signature: string
  ): Promise<{ valid: boolean; integrity: any; signature: any }> {
    return this.api.post('/documents/verify', {
      documentId,
      hash,
      signature,
    })
  }

  private generateSalt(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }
}
```

## Registro de Horas de Vuelo

### Servicio de Flight Logs

```typescript
// src/services/api/flightLogs.ts
import { ApiClient } from './client'
import type { KeyringPair } from '@polkadot/keyring/types'

export interface GPSLocation {
  latitude: number
  longitude: number
  altitude: number
  accuracy?: number
}

export interface PhotoMetadata {
  data: string // base64
  metadata: {
    exif: {
      DateTime?: string
      GPSLatitude?: string
      GPSLongitude?: string
      [key: string]: any
    }
  }
  timestamp: number
}

export interface FlightLog {
  flightLogId: string
  pilotAddress: string
  flight: {
    date: string
    duration: number
    aircraft: {
      registration: string
      type: string
      model?: string
    }
    route: {
      origin: {
        icao: string
        name: string
        gps: GPSLocation
      }
      destination: {
        icao: string
        name: string
        gps: GPSLocation
      }
    }
    conditions?: {
      weather: string
      visibility: string
      clouds: string
    }
    notes?: string
  }
  documentId?: string
  createdAt: string
}

export interface CreateFlightLogRequest {
  pilotAddress: string
  flight: {
    date: string
    duration: number
    aircraft: {
      registration: string
      type: string
      model?: string
    }
    route: {
      origin: {
        icao: string
        name: string
        gps: GPSLocation
      }
      destination: {
        icao: string
        name: string
        gps: GPSLocation
      }
    }
    conditions?: {
      weather: string
      visibility: string
      clouds: string
    }
    notes?: string
  }
  photos?: PhotoMetadata[]
  generatePdf?: boolean
  signDocument?: boolean
}

export class FlightLogService {
  constructor(
    private api: ApiClient,
    private documentService: DocumentService
  ) {}

  async createFlightLog(
    request: CreateFlightLogRequest,
    pair?: KeyringPair
  ): Promise<FlightLog> {
    const flightLog = await this.api.post<FlightLog>('/flight-logs', request)

    // Si se solicita generar PDF y firmar, hacerlo
    if (request.generatePdf && request.signDocument && pair) {
      // El servidor ya generó el PDF, solo necesitamos firmarlo
      if (flightLog.documentId) {
        await this.documentService.signDocument(flightLog.documentId, pair)
      }
    }

    return flightLog
  }

  async getFlightLog(flightLogId: string): Promise<FlightLog> {
    return this.api.get<FlightLog>(`/flight-logs/${flightLogId}`)
  }

  async listFlightLogs(params?: {
    pilotAddress?: string
    fromDate?: string
    toDate?: string
    limit?: number
    offset?: number
  }): Promise<{
    flightLogs: FlightLog[]
    summary: any
    pagination: any
  }> {
    const query = new URLSearchParams()
    if (params?.pilotAddress) query.set('pilotAddress', params.pilotAddress)
    if (params?.fromDate) query.set('fromDate', params.fromDate)
    if (params?.toDate) query.set('toDate', params.toDate)
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.offset) query.set('offset', params.offset.toString())

    const endpoint = `/flight-logs${query.toString() ? `?${query}` : ''}`
    return this.api.get(endpoint)
  }

  async getSummary(params?: {
    pilotAddress?: string
    period?: 'month' | 'year' | 'all'
  }): Promise<{
    pilotAddress: string
    summary: {
      totalHours: number
      totalFlights: number
      byAircraft: Record<string, number>
      byMonth: Record<string, number>
    }
    period: {
      from: string
      to: string
    }
  }> {
    const query = new URLSearchParams()
    if (params?.pilotAddress) query.set('pilotAddress', params.pilotAddress)
    if (params?.period) query.set('period', params.period)

    const endpoint = `/flight-logs/summary${query.toString() ? `?${query}` : ''}`
    return this.api.get(endpoint)
  }
}
```

## Captura de GPS y Fotos

### Utilidades para GPS y Metadata

```typescript
// src/utils/gps.ts
export interface GPSData {
  latitude: number
  longitude: number
  altitude: number
  accuracy: number
  timestamp: number
}

export async function getCurrentGPS(): Promise<GPSData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation no está disponible'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        })
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}

// src/utils/photo.ts
export interface PhotoWithMetadata {
  data: string // base64
  metadata: {
    exif: {
      DateTime?: string
      GPSLatitude?: string
      GPSLongitude?: string
      Make?: string
      Model?: string
      [key: string]: any
    }
  }
  timestamp: number
}

export async function capturePhotoWithMetadata(): Promise<PhotoWithMetadata> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true })
  const track = stream.getVideoTracks()[0]
  const imageCapture = new ImageCapture(track)

  const blob = await imageCapture.takePhoto()
  const base64 = await blobToBase64(blob)

  // Obtener GPS actual
  const gps = await getCurrentGPS()

  // Extraer metadata EXIF (requiere biblioteca como exif-js)
  const metadata = await extractExifMetadata(blob)

  track.stop()

  return {
    data: base64,
    metadata: {
      exif: {
        ...metadata,
        DateTime: new Date().toISOString(),
        GPSLatitude: formatGPSLatitude(gps.latitude),
        GPSLongitude: formatGPSLongitude(gps.longitude),
      },
    },
    timestamp: Date.now(),
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function extractExifMetadata(blob: Blob): Promise<any> {
  // Implementar usando exif-js o similar
  // Esto es un placeholder
  return {}
}

function formatGPSLatitude(lat: number): string {
  const degrees = Math.floor(Math.abs(lat))
  const minutes = Math.floor((Math.abs(lat) - degrees) * 60)
  const seconds = ((Math.abs(lat) - degrees - minutes / 60) * 3600).toFixed(2)
  return `${degrees}/1,${minutes}/1,${seconds}/1`
}

function formatGPSLongitude(lon: number): string {
  const degrees = Math.floor(Math.abs(lon))
  const minutes = Math.floor((Math.abs(lon) - degrees) * 60)
  const seconds = ((Math.abs(lon) - degrees - minutes / 60) * 3600).toFixed(2)
  return `${degrees}/1,${minutes}/1,${seconds}/1`
}
```

## Generación de PDF

### Servicio de Generación de PDF

```typescript
// src/services/pdf/generator.ts
import jsPDF from 'jspdf'
import type { FlightLog } from '../api/flightLogs'

export class PDFGenerator {
  async generateFlightLogPDF(flightLog: FlightLog, photos?: string[]): Promise<Uint8Array> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Título
    doc.setFontSize(20)
    doc.text('Flight Log Entry', 105, 20, { align: 'center' })

    // Información del piloto
    doc.setFontSize(12)
    doc.text(`Pilot: ${flightLog.pilotAddress}`, 20, 40)

    // Información del vuelo
    doc.text(`Date: ${new Date(flightLog.flight.date).toLocaleDateString()}`, 20, 50)
    doc.text(`Duration: ${flightLog.flight.duration} hours`, 20, 60)
    doc.text(`Aircraft: ${flightLog.flight.aircraft.registration}`, 20, 70)
    doc.text(`Type: ${flightLog.flight.aircraft.type}`, 20, 80)

    // Ruta
    doc.text('Route:', 20, 95)
    doc.text(
      `From: ${flightLog.flight.route.origin.icao} (${flightLog.flight.route.origin.name})`,
      20,
      105
    )
    doc.text(
      `To: ${flightLog.flight.route.destination.icao} (${flightLog.flight.route.destination.name})`,
      20,
      115
    )

    // GPS
    doc.text('GPS Coordinates:', 20, 130)
    doc.text(
      `Origin: ${flightLog.flight.route.origin.gps.latitude}, ${flightLog.flight.route.origin.gps.longitude}`,
      20,
      140
    )
    doc.text(
      `Destination: ${flightLog.flight.route.destination.gps.latitude}, ${flightLog.flight.route.destination.gps.longitude}`,
      20,
      150
    )

    // Agregar fotos si están disponibles
    if (photos && photos.length > 0) {
      let yPos = 165
      for (const photo of photos.slice(0, 3)) {
        // Limitar a 3 fotos por página
        try {
          const img = new Image()
          img.src = photo
          await new Promise((resolve) => {
            img.onload = () => {
              const imgWidth = 80
              const imgHeight = (img.height * imgWidth) / img.width
              doc.addImage(photo, 'JPEG', 20, yPos, imgWidth, imgHeight)
              yPos += imgHeight + 10
              resolve(null)
            }
          })
        } catch (error) {
          console.error('Error adding photo:', error)
        }
      }
    }

    // Metadata embebida
    doc.setProperties({
      title: 'Flight Log Entry',
      subject: `Flight from ${flightLog.flight.route.origin.icao} to ${flightLog.flight.route.destination.icao}`,
      author: flightLog.pilotAddress,
      creator: 'PWA Wallet',
      keywords: 'flight log, aviation, pilot',
    })

    // Convertir a Uint8Array
    const pdfBlob = doc.output('arraybuffer')
    return new Uint8Array(pdfBlob)
  }

  async calculateHash(pdf: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', pdf)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
}
```

## Ejemplo de Uso Completo

### Componente React para Registrar Vuelo

```typescript
// src/components/FlightLogForm.tsx
import { useState } from 'react'
import { useKeyring } from '../hooks/useKeyring'
import { ApiClient } from '../services/api/client'
import { AuthService } from '../services/api/auth'
import { FlightLogService } from '../services/api/flightLogs'
import { DocumentService } from '../services/api/documents'
import { getCurrentGPS, capturePhotoWithMetadata } from '../utils'

export function FlightLogForm() {
  const { selectedPair } = useKeyring()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const api = new ApiClient()
  const auth = new AuthService(api)
  const documents = new DocumentService(api)
  const flightLogs = new FlightLogService(api, documents)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedPair) {
      setError('No hay cuenta seleccionada')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Autenticación
      await auth.authenticate(selectedPair)

      // 2. Capturar GPS
      const originGPS = await getCurrentGPS()
      // Simular destino (en producción, el usuario lo ingresaría)
      const destinationGPS = {
        latitude: 20.6597,
        longitude: -103.3496,
        altitude: 1524,
        accuracy: 10,
        timestamp: Date.now(),
      }

      // 3. Capturar fotos
      const photos = []
      for (let i = 0; i < 2; i++) {
        const photo = await capturePhotoWithMetadata()
        photos.push(photo)
      }

      // 4. Crear registro de vuelo
      const flightLog = await flightLogs.createFlightLog(
        {
          pilotAddress: selectedPair.address,
          flight: {
            date: new Date().toISOString(),
            duration: 2.5,
            aircraft: {
              registration: 'N12345',
              type: 'Cessna 172',
              model: 'C172N',
            },
            route: {
              origin: {
                icao: 'MMMX',
                name: 'Aeropuerto Internacional de la Ciudad de México',
                gps: originGPS,
              },
              destination: {
                icao: 'MMGL',
                name: 'Aeropuerto Internacional de Guadalajara',
                gps: destinationGPS,
              },
            },
            conditions: {
              weather: 'VMC',
              visibility: '10+ SM',
              clouds: 'Clear',
            },
            notes: 'Training flight',
          },
          photos,
          generatePdf: true,
          signDocument: true,
        },
        selectedPair
      )

      console.log('Flight log creado:', flightLog)
      alert('Registro de vuelo creado exitosamente')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading || !selectedPair}>
        {loading ? 'Registrando...' : 'Registrar Vuelo'}
      </button>
    </form>
  )
}
```

## Sincronización Offline

### Service Worker para Sincronización

```typescript
// src/services/sync/queue.ts
export interface SyncOperation {
  id: string
  type: 'upload_document' | 'create_flight_log' | 'create_medical_record'
  data: any
  priority: 'low' | 'normal' | 'high'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  retries: number
  createdAt: number
  updatedAt: number
}

export class SyncQueue {
  private db: IDBDatabase | null = null

  async init() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sync-queue', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('operations')) {
          const store = db.createObjectStore('operations', { keyPath: 'id' })
          store.createIndex('byStatus', 'status', { unique: false })
          store.createIndex('byPriority', 'priority', { unique: false })
        }
      }
    })
  }

  async addOperation(operation: Omit<SyncOperation, 'id' | 'status' | 'retries' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.db) await this.init()

    const op: SyncOperation = {
      ...operation,
      id: crypto.randomUUID(),
      status: 'pending',
      retries: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['operations'], 'readwrite')
      const store = transaction.objectStore('operations')
      const request = store.add(op)

      request.onsuccess = () => resolve(op.id)
      request.onerror = () => reject(request.error)
    })
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['operations'], 'readonly')
      const store = transaction.objectStore('operations')
      const index = store.index('byStatus')
      const request = index.getAll('pending')

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async updateOperationStatus(id: string, status: SyncOperation['status']) {
    if (!this.db) await this.init()

    return new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(['operations'], 'readwrite')
      const store = transaction.objectStore('operations')
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const op = getRequest.result
        if (op) {
          op.status = status
          op.updatedAt = Date.now()
          if (status === 'failed') op.retries++

          const putRequest = store.put(op)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          reject(new Error('Operation not found'))
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }
}
```

## Manejo de Errores y Reintentos

```typescript
// src/services/api/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // No reintentar en errores 4xx (excepto 429)
      if (error instanceof Error && 'status' in error) {
        const status = (error as any).status
        if (status >= 400 && status < 500 && status !== 429) {
          throw error
        }
      }

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)))
      }
    }
  }

  throw lastError!
}
```

