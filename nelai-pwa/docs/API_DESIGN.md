# Diseño de API para Wallet Móvil con Primitivos Criptográficos

## Visión General

API RESTful diseñada para una PWA que funciona como wallet móvil con capacidades criptográficas avanzadas, enfocada en:
- Registro de horas de vuelo de pilotos
- Generación y firma de documentos PDF
- Integración con servicios de atestación de credenciales
- Gestión de expedientes médicos
- Transferencia segura de documentos entre servidor y PWA

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    PWA (Cliente)                             │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Wallet Service                                       │   │
│  │  - Keyring Management                                 │   │
│  │  - Document Generation (PDF)                          │   │
│  │  - Cryptographic Operations                           │   │
│  │  - Offline Storage (IndexedDB)                        │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Service Worker                                       │   │
│  │  - Background Sync                                    │   │
│  │  - Request Queue                                      │   │
│  │  - Cache Management                                   │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                        ↕ HTTPS / WebSocket
┌─────────────────────────────────────────────────────────────┐
│                    API Server                                │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Authentication Layer                                 │   │
│  │  - JWT / WebAuthn                                     │   │
│  │  - Signature Verification                            │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Core Services                                        │   │
│  │  - Documents API                                      │   │
│  │  - Flight Logs API                                    │   │
│  │  - Medical Records API                                │   │
│  │  - Attestation API                                    │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  External Integrations                                │   │
│  │  - Credential Attestation Services                   │   │
│  │  - Medical Record Systems                             │   │
│  │  - Blockchain Networks                                │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Autenticación y Autorización

### Métodos de Autenticación

1. **JWT con Firma Criptográfica**
   - El cliente firma un challenge con su keyring
   - El servidor verifica la firma y emite un JWT
   - El JWT incluye el address del keyring como subject

2. **WebAuthn**
   - Autenticación biométrica o hardware key
   - Compatible con dispositivos móviles

3. **Signature-based Auth**
   - Cada request puede incluir una firma opcional
   - Útil para operaciones críticas

### Headers de Autenticación

```http
Authorization: Bearer <JWT_TOKEN>
X-Signature: <hex_signature>
X-Signer-Address: <ss58_address>
X-Timestamp: <unix_timestamp>
X-Nonce: <random_nonce>
```

## Endpoints de la API

### Base URL
```
https://api.wallet-service.com/v1
```

### 1. Autenticación

#### POST `/auth/challenge`
Genera un challenge para autenticación basada en firma.

**Request:**
```json
{
  "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "timestamp": 1234567890
}
```

**Response:**
```json
{
  "challenge": "0x1234...",
  "nonce": "random-nonce-123",
  "expiresAt": 1234567890
}
```

#### POST `/auth/verify`
Verifica la firma del challenge y emite un JWT.

**Request:**
```json
{
  "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "challenge": "0x1234...",
  "signature": "0xabcd...",
  "nonce": "random-nonce-123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "user": {
    "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "publicKey": "0x...",
    "keyType": "sr25519"
  }
}
```

### 2. Documentos PDF

#### POST `/documents/generate`
Genera un documento PDF con metadata y GPS.

**Request:**
```json
{
  "type": "flight_log",
  "template": "standard",
  "data": {
    "pilot": {
      "address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "name": "Juan Pérez",
      "license": "PIL-12345"
    },
    "flight": {
      "date": "2024-01-15T10:30:00Z",
      "duration": 2.5,
      "aircraft": "N12345",
      "route": "MEX-GDL"
    },
    "gps": {
      "start": {
        "latitude": 19.4326,
        "longitude": -99.1332,
        "altitude": 2240,
        "accuracy": 10
      },
      "end": {
        "latitude": 20.6597,
        "longitude": -103.3496,
        "altitude": 1524,
        "accuracy": 10
      }
    },
    "photos": [
      {
        "data": "data:image/jpeg;base64,/9j/4AAQ...",
        "metadata": {
          "exif": {
            "DateTime": "2024:01:15 10:30:00",
            "GPSLatitude": "19/1,25/1,57/1",
            "GPSLongitude": "99/1,7/1,59/1"
          }
        },
        "timestamp": 1234567890
      }
    ]
  },
  "options": {
    "format": "PDF/A-2b",
    "includeSignature": true,
    "encrypt": true
  }
}
```

**Response:**
```json
{
  "documentId": "doc_abc123",
  "pdf": "data:application/pdf;base64,JVBERi0xLjQK...",
  "hash": "0x1234567890abcdef...",
  "metadata": {
    "size": 245678,
    "pages": 3,
    "createdAt": "2024-01-15T10:35:00Z"
  }
}
```

#### POST `/documents/sign`
Firma un documento PDF con el keyring del usuario.

**Request:**
```json
{
  "documentId": "doc_abc123",
  "signerAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "signature": "0xabcd...",
  "certificate": {
    "subject": "CN=Juan Pérez",
    "issuer": "CN=Aviation Authority",
    "validFrom": "2024-01-01T00:00:00Z",
    "validTo": "2025-01-01T00:00:00Z"
  }
}
```

**Response:**
```json
{
  "documentId": "doc_abc123",
  "signedPdf": "data:application/pdf;base64,JVBERi0xLjQK...",
  "signature": {
    "signer": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "timestamp": 1234567890,
    "hash": "0x1234...",
    "signature": "0xabcd...",
    "certificate": "base64_certificate..."
  },
  "verification": {
    "valid": true,
    "verifiedAt": "2024-01-15T10:36:00Z"
  }
}
```

#### POST `/documents/encrypt`
Encripta un documento PDF con SHA256 y AES-GCM.

**Request:**
```json
{
  "documentId": "doc_abc123",
  "algorithm": "AES-GCM-256",
  "keyDerivation": {
    "method": "PBKDF2",
    "iterations": 100000,
    "salt": "random-salt-123"
  }
}
```

**Response:**
```json
{
  "documentId": "doc_abc123",
  "encryptedPdf": "data:application/pdf;base64,JVBERi0xLjQK...",
  "hash": "0x1234567890abcdef...",
  "encryption": {
    "algorithm": "AES-GCM-256",
    "iv": "0x...",
    "salt": "random-salt-123",
    "iterations": 100000
  }
}
```

#### GET `/documents/{documentId}`
Obtiene un documento por ID.

**Response:**
```json
{
  "documentId": "doc_abc123",
  "type": "flight_log",
  "pdf": "data:application/pdf;base64,...",
  "hash": "0x1234...",
  "signature": {
    "signer": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "timestamp": 1234567890,
    "valid": true
  },
  "metadata": {
    "createdAt": "2024-01-15T10:35:00Z",
    "size": 245678,
    "pages": 3
  }
}
```

#### GET `/documents`
Lista documentos del usuario autenticado.

**Query Parameters:**
- `type`: Filtro por tipo (flight_log, medical_record, etc.)
- `limit`: Número de resultados (default: 20)
- `offset`: Paginación
- `sort`: Ordenamiento (createdAt, updatedAt)

**Response:**
```json
{
  "documents": [
    {
      "documentId": "doc_abc123",
      "type": "flight_log",
      "hash": "0x1234...",
      "createdAt": "2024-01-15T10:35:00Z",
      "size": 245678
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

#### POST `/documents/verify`
Verifica la integridad y firma de un documento.

**Request:**
```json
{
  "documentId": "doc_abc123",
  "hash": "0x1234...",
  "signature": "0xabcd..."
}
```

**Response:**
```json
{
  "valid": true,
  "integrity": {
    "hashMatch": true,
    "hash": "0x1234..."
  },
  "signature": {
    "valid": true,
    "signer": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "verifiedAt": "2024-01-15T10:40:00Z"
  }
}
```

### 3. Registro de Horas de Vuelo

#### POST `/flight-logs`
Crea un nuevo registro de horas de vuelo.

**Request:**
```json
{
  "pilotAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "flight": {
    "date": "2024-01-15T10:30:00Z",
    "duration": 2.5,
    "aircraft": {
      "registration": "N12345",
      "type": "Cessna 172",
      "model": "C172N"
    },
    "route": {
      "origin": {
        "icao": "MMMX",
        "name": "Aeropuerto Internacional de la Ciudad de México",
        "gps": {
          "latitude": 19.4326,
          "longitude": -99.1332,
          "altitude": 2240
        }
      },
      "destination": {
        "icao": "MMGL",
        "name": "Aeropuerto Internacional de Guadalajara",
        "gps": {
          "latitude": 20.6597,
          "longitude": -103.3496,
          "altitude": 1524
        }
      }
    },
    "conditions": {
      "weather": "VMC",
      "visibility": "10+ SM",
      "clouds": "Clear"
    },
    "notes": "Training flight, cross-country navigation"
  },
  "photos": [
    {
      "data": "data:image/jpeg;base64,...",
      "metadata": {
        "exif": {
          "DateTime": "2024:01:15 10:30:00",
          "GPSLatitude": "19/1,25/1,57/1",
          "GPSLongitude": "99/1,7/1,59/1"
        }
      }
    }
  ],
  "generatePdf": true,
  "signDocument": true
}
```

**Response:**
```json
{
  "flightLogId": "flight_xyz789",
  "documentId": "doc_abc123",
  "pilotAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "flight": {
    "date": "2024-01-15T10:30:00Z",
    "duration": 2.5,
    "totalHours": 1250.5
  },
  "document": {
    "pdf": "data:application/pdf;base64,...",
    "hash": "0x1234...",
    "signature": {
      "signer": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "timestamp": 1234567890
    }
  },
  "createdAt": "2024-01-15T10:35:00Z"
}
```

#### GET `/flight-logs`
Lista los registros de vuelo del piloto.

**Query Parameters:**
- `pilotAddress`: Dirección del piloto (requerido si no es el usuario autenticado)
- `fromDate`: Fecha inicial
- `toDate`: Fecha final
- `limit`: Número de resultados
- `offset`: Paginación

**Response:**
```json
{
  "flightLogs": [
    {
      "flightLogId": "flight_xyz789",
      "date": "2024-01-15T10:30:00Z",
      "duration": 2.5,
      "route": "MMMX-MMGL",
      "aircraft": "N12345",
      "documentId": "doc_abc123",
      "totalHours": 1250.5
    }
  ],
  "summary": {
    "totalHours": 1250.5,
    "totalFlights": 45,
    "period": {
      "from": "2023-01-01T00:00:00Z",
      "to": "2024-01-15T23:59:59Z"
    }
  },
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

#### GET `/flight-logs/{flightLogId}`
Obtiene un registro de vuelo específico.

**Response:**
```json
{
  "flightLogId": "flight_xyz789",
  "pilotAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "flight": {
    "date": "2024-01-15T10:30:00Z",
    "duration": 2.5,
    "aircraft": {
      "registration": "N12345",
      "type": "Cessna 172"
    },
    "route": {
      "origin": {
        "icao": "MMMX",
        "name": "Aeropuerto Internacional de la Ciudad de México",
        "gps": {
          "latitude": 19.4326,
          "longitude": -99.1332
        }
      },
      "destination": {
        "icao": "MMGL",
        "name": "Aeropuerto Internacional de Guadalajara",
        "gps": {
          "latitude": 20.6597,
          "longitude": -103.3496
        }
      }
    }
  },
  "documentId": "doc_abc123",
  "createdAt": "2024-01-15T10:35:00Z"
}
```

#### GET `/flight-logs/summary`
Obtiene un resumen de horas de vuelo.

**Query Parameters:**
- `pilotAddress`: Dirección del piloto
- `period`: Período (month, year, all)

**Response:**
```json
{
  "pilotAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "summary": {
    "totalHours": 1250.5,
    "totalFlights": 45,
    "byAircraft": {
      "N12345": 800.0,
      "N67890": 450.5
    },
    "byMonth": {
      "2024-01": 25.5,
      "2023-12": 30.0
    }
  },
  "period": {
    "from": "2023-01-01T00:00:00Z",
    "to": "2024-01-15T23:59:59Z"
  }
}
```

### 4. Expedientes Médicos

#### POST `/medical-records`
Crea un nuevo expediente médico.

**Request:**
```json
{
  "patientAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "record": {
    "type": "medical_examination",
    "date": "2024-01-15T10:00:00Z",
    "provider": {
      "name": "Dr. María González",
      "license": "MED-54321",
      "address": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"
    },
    "data": {
      "bloodPressure": "120/80",
      "heartRate": 72,
      "vision": "20/20",
      "hearing": "Normal",
      "notes": "Fit for flight"
    },
    "attachments": [
      {
        "type": "lab_result",
        "data": "data:application/pdf;base64,...",
        "hash": "0x1234..."
      }
    ]
  },
  "encrypt": true,
  "generatePdf": true,
  "signDocument": true
}
```

**Response:**
```json
{
  "recordId": "medical_abc456",
  "documentId": "doc_def789",
  "patientAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "record": {
    "type": "medical_examination",
    "date": "2024-01-15T10:00:00Z",
    "provider": {
      "name": "Dr. María González",
      "license": "MED-54321"
    }
  },
  "document": {
    "pdf": "data:application/pdf;base64,...",
    "hash": "0x1234...",
    "encrypted": true
  },
  "createdAt": "2024-01-15T10:05:00Z"
}
```

#### GET `/medical-records`
Lista expedientes médicos.

**Query Parameters:**
- `patientAddress`: Dirección del paciente
- `type`: Tipo de registro
- `fromDate`: Fecha inicial
- `toDate`: Fecha final

**Response:**
```json
{
  "records": [
    {
      "recordId": "medical_abc456",
      "type": "medical_examination",
      "date": "2024-01-15T10:00:00Z",
      "provider": {
        "name": "Dr. María González"
      },
      "documentId": "doc_def789",
      "encrypted": true
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 20,
    "offset": 0
  }
}
```

#### GET `/medical-records/{recordId}`
Obtiene un expediente médico específico.

**Response:**
```json
{
  "recordId": "medical_abc456",
  "patientAddress": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "record": {
    "type": "medical_examination",
    "date": "2024-01-15T10:00:00Z",
    "provider": {
      "name": "Dr. María González",
      "license": "MED-54321"
    },
    "data": {
      "bloodPressure": "120/80",
      "heartRate": 72
    }
  },
  "documentId": "doc_def789",
  "encrypted": true,
  "createdAt": "2024-01-15T10:05:00Z"
}
```

### 5. Atestación de Credenciales

#### POST `/attestations/create`
Crea una atestación de credencial.

**Request:**
```json
{
  "credential": {
    "type": "pilot_license",
    "subject": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "issuer": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
    "claims": {
      "licenseNumber": "PIL-12345",
      "licenseType": "Commercial",
      "ratings": ["Multi-Engine", "Instrument"],
      "expirationDate": "2025-12-31T23:59:59Z"
    },
    "evidence": [
      {
        "type": "flight_log",
        "documentId": "doc_abc123"
      }
    ]
  },
  "format": "W3C_VC",
  "sign": true
}
```

**Response:**
```json
{
  "attestationId": "att_xyz123",
  "credential": {
    "id": "credential:xyz123",
    "type": "pilot_license",
    "subject": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "issuer": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
    "claims": {
      "licenseNumber": "PIL-12345",
      "licenseType": "Commercial"
    }
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2024-01-15T10:40:00Z",
    "verificationMethod": "did:substrate:5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty#keys-1",
    "proofValue": "0xabcd..."
  },
  "format": "W3C_VC",
  "createdAt": "2024-01-15T10:40:00Z"
}
```

#### POST `/attestations/verify`
Verifica una atestación de credencial.

**Request:**
```json
{
  "attestationId": "att_xyz123",
  "credential": {
    "id": "credential:xyz123",
    "proof": {
      "proofValue": "0xabcd..."
    }
  }
}
```

**Response:**
```json
{
  "valid": true,
  "attestationId": "att_xyz123",
  "verification": {
    "signature": {
      "valid": true,
      "signer": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      "verifiedAt": "2024-01-15T10:45:00Z"
    },
    "claims": {
      "valid": true,
      "expired": false
    },
    "evidence": {
      "valid": true,
      "documents": [
        {
          "documentId": "doc_abc123",
          "verified": true
        }
      ]
    }
  }
}
```

#### GET `/attestations`
Lista atestaciones.

**Query Parameters:**
- `subject`: Dirección del sujeto
- `issuer`: Dirección del emisor
- `type`: Tipo de credencial

**Response:**
```json
{
  "attestations": [
    {
      "attestationId": "att_xyz123",
      "type": "pilot_license",
      "subject": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "issuer": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
      "createdAt": "2024-01-15T10:40:00Z",
      "valid": true
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0
  }
}
```

### 6. Integración con Servicios Externos

#### POST `/integrations/attestation-services/register`
Registra un servicio de atestación externo.

**Request:**
```json
{
  "serviceId": "aviation-authority",
  "name": "Aviation Authority",
  "endpoint": "https://attestation.aviation.gov/api/v1",
  "apiKey": "encrypted_api_key",
  "config": {
    "supportedFormats": ["W3C_VC", "ISO_18013"],
    "supportedCredentials": ["pilot_license", "medical_certificate"]
  }
}
```

#### POST `/integrations/attestation-services/{serviceId}/submit`
Envía una credencial a un servicio de atestación externo.

**Request:**
```json
{
  "attestationId": "att_xyz123",
  "format": "W3C_VC"
}
```

**Response:**
```json
{
  "submissionId": "sub_789",
  "serviceId": "aviation-authority",
  "status": "pending",
  "submittedAt": "2024-01-15T10:50:00Z"
}
```

#### POST `/integrations/medical-systems/register`
Registra un sistema de expedientes médicos externo.

**Request:**
```json
{
  "systemId": "hospital-system-1",
  "name": "Hospital General",
  "endpoint": "https://hospital.example.com/api/records",
  "apiKey": "encrypted_api_key",
  "config": {
    "supportedFormats": ["HL7_FHIR", "DICOM"],
    "encryption": "AES-256"
  }
}
```

#### POST `/integrations/medical-systems/{systemId}/sync`
Sincroniza expedientes médicos con un sistema externo.

**Request:**
```json
{
  "recordIds": ["medical_abc456"],
  "direction": "export",
  "format": "HL7_FHIR"
}
```

**Response:**
```json
{
  "syncId": "sync_456",
  "systemId": "hospital-system-1",
  "status": "completed",
  "syncedRecords": [
    {
      "recordId": "medical_abc456",
      "externalId": "ext_123",
      "syncedAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

### 7. Sincronización y Transferencia

#### POST `/sync/queue`
Agrega operaciones a la cola de sincronización.

**Request:**
```json
{
  "operations": [
    {
      "type": "upload_document",
      "documentId": "doc_abc123",
      "priority": "high"
    },
    {
      "type": "create_flight_log",
      "data": { /* flight log data */ }
    }
  ]
}
```

#### GET `/sync/status`
Obtiene el estado de la sincronización.

**Response:**
```json
{
  "queued": 5,
  "processing": 1,
  "completed": 120,
  "failed": 2,
  "lastSync": "2024-01-15T10:00:00Z"
}
```

#### POST `/transfer/documents`
Transfiere documentos entre servidor y PWA.

**Request:**
```json
{
  "direction": "upload",
  "documents": [
    {
      "documentId": "doc_abc123",
      "pdf": "data:application/pdf;base64,...",
      "metadata": {
        "type": "flight_log",
        "hash": "0x1234..."
      }
    }
  ],
  "encrypt": true
}
```

**Response:**
```json
{
  "transferId": "transfer_789",
  "status": "completed",
  "transferred": [
    {
      "documentId": "doc_abc123",
      "status": "success",
      "serverId": "server_doc_123"
    }
  ]
}
```

#### GET `/transfer/documents/{transferId}`
Obtiene el estado de una transferencia.

**Response:**
```json
{
  "transferId": "transfer_789",
  "status": "completed",
  "progress": 100,
  "transferred": 1,
  "failed": 0,
  "startedAt": "2024-01-15T11:00:00Z",
  "completedAt": "2024-01-15T11:01:00Z"
}
```

## Formatos de Datos

### PDF/A-2b (ISO 19005-2)
- Formato de archivo PDF para preservación a largo plazo
- Incluye metadata embebida
- Soporte para firmas digitales X.509
- Compatible con sistemas de archivo

### W3C Verifiable Credentials
- Estándar para credenciales verificables
- Soporte para múltiples formatos de prueba
- Compatible con DID (Decentralized Identifiers)

### JSON-LD
- Formato para datos estructurados
- Soporte para contextos y vocabularios
- Compatible con esquemas JSON

## Seguridad

### Encriptación
- **SHA-256**: Hashing de documentos
- **AES-GCM-256**: Encriptación simétrica
- **RSA-OAEP**: Encriptación asimétrica (opcional)
- **PBKDF2**: Derivación de claves

### Firmas Digitales
- **Ed25519**: Firmas rápidas y seguras
- **sr25519**: Firmas Schnorr (Substrate)
- **X.509**: Certificados digitales

### Validación
- Verificación de firmas en cada operación crítica
- Validación de hashes de integridad
- Verificación de timestamps y nonces
- Rate limiting y protección DDoS

## Códigos de Estado HTTP

- `200 OK`: Operación exitosa
- `201 Created`: Recurso creado exitosamente
- `400 Bad Request`: Solicitud inválida
- `401 Unauthorized`: No autenticado
- `403 Forbidden`: No autorizado
- `404 Not Found`: Recurso no encontrado
- `409 Conflict`: Conflicto (ej: documento ya existe)
- `422 Unprocessable Entity`: Datos inválidos
- `429 Too Many Requests`: Rate limit excedido
- `500 Internal Server Error`: Error del servidor
- `503 Service Unavailable`: Servicio no disponible

## Rate Limiting

- **Autenticación**: 10 requests/minuto
- **Documentos**: 100 requests/hora
- **Flight Logs**: 50 requests/hora
- **Medical Records**: 30 requests/hora
- **Attestations**: 20 requests/hora

## WebSocket API (Opcional)

Para notificaciones en tiempo real y sincronización:

```
wss://api.wallet-service.com/v1/ws
```

### Eventos

- `document.uploaded`: Documento subido
- `document.signed`: Documento firmado
- `flight_log.created`: Registro de vuelo creado
- `attestation.verified`: Atestación verificada
- `sync.completed`: Sincronización completada

## Ejemplo de Flujo Completo

### 1. Registro de Vuelo con PDF Firmado

```typescript
// 1. Autenticación
const challenge = await fetch('/auth/challenge', {
  method: 'POST',
  body: JSON.stringify({ address: pilotAddress })
}).then(r => r.json())

const signature = keyring.sign(challenge.challenge)
const auth = await fetch('/auth/verify', {
  method: 'POST',
  body: JSON.stringify({
    address: pilotAddress,
    challenge: challenge.challenge,
    signature: u8aToHex(signature),
    nonce: challenge.nonce
  })
}).then(r => r.json())

// 2. Crear registro de vuelo
const flightLog = await fetch('/flight-logs', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${auth.token}`
  },
  body: JSON.stringify({
    pilotAddress,
    flight: {
      date: new Date().toISOString(),
      duration: 2.5,
      aircraft: { registration: 'N12345' },
      route: {
        origin: { icao: 'MMMX', gps: { latitude: 19.4326, longitude: -99.1332 } },
        destination: { icao: 'MMGL', gps: { latitude: 20.6597, longitude: -103.3496 } }
      }
    },
    photos: [/* photos with GPS metadata */],
    generatePdf: true,
    signDocument: true
  })
}).then(r => r.json())

// 3. El servidor genera el PDF, calcula el hash SHA-256, y espera la firma
// 4. Firmar el documento
const docHash = flightLog.document.hash
const docSignature = keyring.sign(docHash)

const signedDoc = await fetch(`/documents/${flightLog.documentId}/sign`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${auth.token}`
  },
  body: JSON.stringify({
    documentId: flightLog.documentId,
    signerAddress: pilotAddress,
    signature: u8aToHex(docSignature)
  })
}).then(r => r.json())

// 5. Documento firmado y listo para almacenamiento
```

## Consideraciones de Implementación

### Cliente (PWA)
- Usar Service Worker para sincronización en background
- Cola de operaciones para modo offline
- Cache de documentos frecuentemente accedidos
- Validación local antes de enviar al servidor

### Servidor
- Validación estricta de todas las entradas
- Verificación de firmas en cada operación crítica
- Almacenamiento seguro de documentos encriptados
- Logging y auditoría de todas las operaciones
- Backup y recuperación de desastres

### Integraciones
- Timeout y retry para servicios externos
- Validación de formatos antes de enviar
- Manejo de errores y fallbacks
- Sincronización asíncrona para mejor rendimiento

