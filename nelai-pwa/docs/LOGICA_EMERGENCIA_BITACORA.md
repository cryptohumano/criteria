# Lógica de Emergencia Durante Bitácora

## 📋 Resumen

Este documento define la lógica y el flujo cuando se activa una emergencia durante una bitácora de montañismo activa.

## 🎯 Principios Fundamentales

1. **Accesibilidad**: El botón de emergencia debe ser fácilmente accesible en todo momento
2. **Confirmación**: Evitar falsas alarmas con confirmación antes de enviar
3. **Contexto**: Vincular automáticamente con la bitácora activa
4. **Ubicación**: Capturar GPS automáticamente al momento de activar
5. **Persistencia**: Guardar localmente incluso si falla el envío a blockchain
6. **Visibilidad**: Mostrar claramente el estado de la emergencia

## 🔄 Flujo Completo

### 1. **Detección y Activación**

```
Usuario presiona "Botón de Emergencia" en la bitácora
  ↓
Verificar que hay una bitácora activa
  ↓
Verificar que la wallet está desbloqueada
  ↓
Verificar permisos de GPS
  ↓
Mostrar diálogo de confirmación
```

**Diálogo de Confirmación:**
- Tipo de emergencia (selector)
- Severidad (selector: baja, media, alta, crítica)
- Descripción breve (textarea, opcional pero recomendado)
- Botones: "Cancelar" | "Confirmar Emergencia"

### 2. **Captura de Datos**

```
Usuario confirma emergencia
  ↓
Capturar ubicación GPS actual (con timeout de 10 segundos)
  ↓
Si GPS falla: Usar última ubicación conocida de la bitácora
  ↓
Obtener datos de la bitácora:
  - logId
  - milestoneId actual (si existe)
  - Contactos de emergencia del Aviso de Salida
  - Cuenta Substrate activa
  ↓
Crear objeto Emergency localmente
```

### 3. **Registro Local**

```
Guardar emergencia en IndexedDB
  - Estado: 'pending'
  - Timestamp de creación
  - Todos los datos capturados
  ↓
Actualizar UI para mostrar emergencia activa
  - Banner de emergencia en la bitácora
  - Indicador visual prominente
  - Botón para ver detalles
```

### 4. **Envío a Blockchain**

```
Intentar enviar a blockchain inmediatamente
  ↓
Si hay conexión y cliente disponible:
  - Serializar emergencia a formato remark
  - Crear transacción system.remark
  - Firmar con cuenta activa
  - Enviar y esperar inclusión
  ↓
Si éxito:
  - Actualizar estado a 'submitted'
  - Guardar txHash, blockNumber
  - Mostrar confirmación al usuario
  ↓
Si falla (offline o error):
  - Mantener estado 'pending'
  - Guardar error para reintento
  - Mostrar mensaje: "Emergencia guardada localmente. Se enviará cuando haya conexión."
```

### 5. **Sincronización Offline**

```
Detectar cuando se restaura conexión
  ↓
Buscar emergencias con estado 'pending'
  ↓
Para cada emergencia pendiente:
  - Intentar enviar a blockchain
  - Si éxito: Actualizar estado
  - Si falla: Incrementar contador de intentos
  - Guardar timestamp de último intento
```

### 6. **Visualización Durante Bitácora**

**Cuando hay emergencia activa:**

1. **Banner de Emergencia** (siempre visible en la parte superior):
   ```
   [🚨 EMERGENCIA ACTIVA]
   Tipo: Médica | Severidad: Crítica
   Estado: Enviada a blockchain
   TxHash: 0x1234...5678
   [Ver Detalles] [Cancelar]
   ```

2. **Indicador en Navegación**:
   - Badge rojo con número de emergencias activas
   - Icono de alerta parpadeante (opcional, no intrusivo)

3. **Panel de Detalles** (expandible):
   - Ubicación en mapa (offline si es necesario)
   - Información de contacto
   - Historial de actualizaciones
   - Opción para agregar notas adicionales

### 7. **Comportamiento Especial Durante Emergencia**

**Restricciones:**
- ❌ NO bloquear la finalización de la bitácora (el usuario debe poder completarla)
- ✅ SÍ mostrar advertencia si intenta finalizar con emergencia activa
- ✅ SÍ permitir agregar más emergencias si es necesario
- ✅ SÍ permitir cancelar emergencia si fue falsa alarma

**Advertencia al Finalizar:**
```
⚠️ Tienes una emergencia activa
¿Estás seguro de que quieres finalizar la bitácora?
La emergencia seguirá activa y visible.
[Cancelar] [Finalizar de Todas Formas]
```

### 8. **Cancelación de Emergencia**

```
Usuario presiona "Cancelar Emergencia"
  ↓
Confirmar cancelación (evitar cancelaciones accidentales)
  ↓
Actualizar estado a 'cancelled'
  ↓
Guardar localmente
  ↓
Opcional: Enviar remark de cancelación a blockchain
  (formato: EMERGENCY_CANCEL:{emergencyId})
```

## 📊 Estados de Emergencia

| Estado | Descripción | Acciones Disponibles |
|--------|-------------|---------------------|
| `pending` | Creada localmente, no enviada | Enviar, Cancelar, Editar |
| `submitted` | Enviada a blockchain | Ver detalles, Cancelar |
| `acknowledged` | Reconocida por servicios | Ver detalles, Agregar notas |
| `in_progress` | En proceso de atención | Ver detalles, Agregar notas |
| `resolved` | Resuelta | Ver detalles, Exportar reporte |
| `cancelled` | Cancelada (falsa alarma) | Ver detalles |

## 🔗 Integración con Bitácora

### Datos Automáticos de la Bitácora

Cuando se crea una emergencia desde una bitácora, se incluyen automáticamente:

1. **relatedLogId**: ID de la bitácora
2. **relatedMilestoneId**: ID del milestone actual (si existe)
3. **emergencyContacts**: Contactos del Aviso de Salida
4. **reporterAccount**: Cuenta Substrate activa
5. **metadata**: 
   - Número de participantes
   - Tipo de actividad
   - Ubicación general (región, lugar destino)

### Exportación de PDF

Cuando se exporta una bitácora que tiene emergencias:

1. **Incluir sección de emergencias** en el PDF:
   - Lista de todas las emergencias relacionadas
   - Estado de cada una
   - Fechas y ubicaciones
   - Descripciones

2. **Marcar visualmente** si hay emergencias activas:
   - Banner en la portada
   - Sección destacada en el contenido

## 🚨 Casos Especiales

### Emergencia Sin Bitácora Activa

Si el usuario intenta crear una emergencia sin bitácora activa:
- Permitir crear emergencia independiente
- No requerir bitácora
- Capturar GPS manualmente si es necesario

### Múltiples Emergencias

- Permitir múltiples emergencias en la misma bitácora
- Mostrar lista de emergencias activas
- Cada una puede tener su propio estado

### GPS No Disponible

- Usar última ubicación conocida de la bitácora
- Usar ubicación del último milestone
- Usar ubicación inicial de la bitácora
- Si nada disponible: Permitir entrada manual de coordenadas

## 📱 Notificaciones (Futuro)

Cuando se implemente el sistema de notificaciones:

1. **Al crear emergencia**: Notificar a contactos de emergencia
2. **Al cambiar estado**: Notificar al usuario
3. **Al resolver**: Notificar confirmación

## 🔐 Seguridad

1. **Rate Limiting**: Máximo X emergencias por hora por cuenta
2. **Validación**: Verificar que la cuenta tiene balance suficiente para fees
3. **Confirmación**: Siempre requerir confirmación antes de enviar
4. **Auditoría**: Registrar todas las acciones relacionadas con emergencias

## 📝 Notas de Implementación

- El botón de emergencia debe ser visible pero no intrusivo
- El color rojo debe usarse con moderación (solo para emergencias activas)
- Las animaciones deben ser sutiles (no distraer)
- El texto debe ser claro y directo
- Los tiempos de respuesta deben ser rápidos (< 3 segundos para crear)
