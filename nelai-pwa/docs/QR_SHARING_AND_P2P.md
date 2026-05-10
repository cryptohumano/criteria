# Sistema de Compartir Datos vía QR y Sincronización P2P

## Capacidad de QR Codes

### Límites Técnicos

- **Versión 40-L (máxima)**: ~2,953 bytes (binario)
- **Versión 40-M**: ~2,331 bytes
- **Versión 40-Q**: ~1,817 bytes
- **Versión 40-H**: ~1,273 bytes

### Estrategia de Datos

Para mantener los QR escaneables y funcionales:

1. **Datos Personales**: ~500-800 bytes
   - Información básica del guía/participante
   - Contactos de emergencia (máx 3)
   - Cuenta Substrate (opcional)

2. **Invitación a Expedición**: ~300-500 bytes
   - ID de expedición
   - Datos básicos del líder
   - Código de sincronización P2P

3. **Sincronización Incremental**: ~200-400 bytes
   - Solo cambios (milestones, GPS points)
   - Timestamps de actualización

## Casos de Uso

### 1. Compartir Datos Personales

**Flujo:**
1. Líder completa su aviso de salida
2. Genera QR con sus datos personales
3. Participantes escanean el QR
4. Sus formularios se auto-llenan

**Datos incluidos:**
- Nombres y apellidos
- RUT/Pasaporte
- Email y teléfono
- Contactos de emergencia
- Cuenta Substrate (opcional)

### 2. Invitación a Expedición

**Flujo:**
1. Líder crea expedición
2. Genera QR de invitación
3. Participantes escanean y se unen
4. Se establece conexión P2P

**Datos incluidos:**
- ID de expedición
- Datos del líder
- Información básica de la actividad
- Código de sincronización

### 3. Sincronización P2P

**Flujo:**
1. Líder inicia expedición
2. Participantes se conectan vía código
3. Sincronización automática de:
   - Milestones
   - Puntos GPS
   - Estado de la expedición
4. Sin servidor central

## Arquitectura P2P

### Sin Servidor Central

El sistema usa **WebRTC** o **WebSockets directos** para comunicación P2P:

```
Líder (PWA)                    Participante 1 (PWA)
    |                                |
    |---- Código de Sincronización -->|
    |<-------- Conexión P2P ---------|
    |<---- Sincronización ----------|
```

### Componentes

1. **Líder de Expedición**
   - Crea la expedición
   - Genera código de sincronización
   - Comparte QR de invitación
   - Sincroniza datos con participantes

2. **Participantes**
   - Escanean QR de invitación
   - Se conectan al líder vía P2P
   - Reciben actualizaciones automáticas
   - Pueden enviar sus propios datos

### Sincronización

**Estrategia:**
- **Incremental**: Solo cambios desde última sincronización
- **Timestamp-based**: Orden por timestamp
- **Conflict Resolution**: Último timestamp gana
- **Offline Support**: Cola de cambios cuando offline

## Implementación Técnica

### Generación de QR

```typescript
// Datos personales
const qrData = generatePersonalDataQR(
  personalInfo,
  contactosEmergencia,
  substrateAccount
)

// Invitación
const invite = generateExpeditionInviteQR(
  expeditionId,
  leader,
  expedition,
  syncCode
)
```

### Escaneo de QR

```typescript
// Escanear QR
const qrData = parseQRData(jsonString)

// Aplicar datos
const updatedAviso = applyPersonalDataToAvisoSalida(
  qrData.personalInfo,
  currentAvisoSalida
)
```

### Sincronización P2P

**Opciones de implementación:**

1. **WebRTC Data Channels**
   - Conexión directa entre navegadores
   - Sin servidor intermedio
   - Requiere STUN/TURN para NAT traversal

2. **WebSockets con Relay**
   - Servidor mínimo (solo relay)
   - Más simple de implementar
   - Requiere servidor básico

3. **WebRTC + Signaling Server**
   - Servidor solo para signaling
   - Datos via P2P directo
   - Mejor para privacidad

**Recomendación**: WebRTC Data Channels con signaling mínimo

## Seguridad

### Validación de Datos

- Hash SHA-256 de verificación
- Validación de estructura
- Timestamp de expiración (opcional)

### Privacidad

- Datos solo compartidos explícitamente
- QR con expiración temporal
- Cifrado opcional para datos sensibles

## Limitaciones y Consideraciones

### Tamaño de QR

- Mantener datos mínimos
- Comprimir cuando sea posible
- Usar referencias externas para datos grandes

### P2P sin Servidor

- Requiere conexión directa
- NAT traversal puede ser complejo
- Fallback a servidor mínimo si es necesario

### Offline

- Datos en IndexedDB local
- Sincronización cuando vuelve conexión
- Cola de cambios pendientes

## Próximos Pasos

1. ✅ Sistema de QR para datos personales
2. ⏳ Implementar escáner de QR con cámara
3. ⏳ Sistema P2P con WebRTC
4. ⏳ Sincronización automática
5. ⏳ UI para gestión de participantes
