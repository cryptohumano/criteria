# Análisis: Bitácoras Históricas (Async Logbook)

## Objetivo
Permitir a los montañistas digitalizar sus bitácoras viejas sin el flujo en tiempo real actual, permitiendo:
- Subir archivos manualmente (no solo imágenes capturadas)
- Agregar descripciones, coordenadas GPS manuales
- Crear milestones sin el aviso de salida
- Mantener separación clara con bitácoras activas

## Análisis del Flujo Actual

### Flujo de Bitácoras Activas
1. **Creación**: Se crea con `status: 'draft'`
2. **Planeación** (opcional): Formulario de planeación previa
3. **Aviso de Salida** (obligatorio): Formulario extenso con datos del guía, participantes, contactos, etc.
4. **Milestones**: Se crean con:
   - Título, descripción, tipo
   - GPS automático (si está disponible)
   - Imágenes capturadas desde cámara o archivos (solo imágenes)
   - Timestamp automático (tiempo actual)

### Estructura Actual
```typescript
interface MountainLog {
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled'
  avisoSalida?: { ... } // Obligatorio para bitácoras activas
  milestones: MountainLogMilestone[]
  // ...
}

interface MountainLogMilestone {
  images: MountainLogImage[] // Solo imágenes
  gpsPoint?: GPSPoint // GPS automático o manual
  timestamp: number // Timestamp automático
  // ...
}
```

## Propuesta de Solución

### Opción 1: Campo `isHistorical` (Recomendada)
Agregar un campo booleano `isHistorical` a `MountainLog` que:
- **Ventajas**:
  - Simple y claro
  - Fácil de filtrar y distinguir
  - No rompe compatibilidad
  - Permite migrar bitácoras existentes

- **Comportamiento cuando `isHistorical === true`**:
  - ❌ Omitir completamente el Aviso de Salida
  - ✅ Permitir subir archivos (no solo imágenes) a milestones
  - ✅ Permitir entrada manual de coordenadas GPS
  - ✅ Permitir editar timestamps manualmente
  - ✅ Mostrar UI simplificada sin tracking en tiempo real

### Opción 2: Modo `mode: 'active' | 'historical'`
Similar a Opción 1 pero con un campo explícito de modo.

### Opción 3: Extender con "Modo Historia" en UI
Agregar un toggle en la creación que active el modo histórico.

## Implementación Recomendada (Opción 1)

### 1. Extender Tipos

```typescript
interface MountainLog {
  // ... campos existentes
  isHistorical?: boolean // true = bitácora histórica (sin aviso de salida)
}

interface MountainLogMilestone {
  // ... campos existentes
  files?: MountainLogFile[] // Archivos adicionales (PDFs, documentos, etc.)
  manualTimestamp?: boolean // Si el timestamp fue ingresado manualmente
}

interface MountainLogFile {
  id: string
  name: string
  type: string // MIME type
  data: string // base64 o blob URL
  size: number
  uploadedAt: number
  description?: string
}
```

### 2. Modificar Flujo de Creación

En `MountainLogDetail.tsx`:
- Si `isHistorical === true`, omitir `AvisoSalidaForm`
- Mostrar formulario simplificado de creación
- Permitir seleccionar fecha/hora manualmente

### 3. Extender UI de Milestones

- Agregar botón "Subir Archivo" además de "Tomar Foto"
- Permitir entrada manual de coordenadas GPS
- Permitir editar timestamp del milestone
- Mostrar lista de archivos además de imágenes

### 4. Filtros y Visualización

En `MountainLogs.tsx`:
- Agregar filtro por tipo: "Activas", "Históricas", "Todas"
- Mostrar badge distintivo para bitácoras históricas

## Ventajas de esta Solución

1. ✅ **No rompe compatibilidad**: Las bitácoras existentes siguen funcionando
2. ✅ **Separación clara**: Fácil distinguir entre activas e históricas
3. ✅ **Flexibilidad**: Permite digitalizar bitácoras viejas con todos los datos
4. ✅ **Reutiliza estructura**: Usa la misma estructura de milestones
5. ✅ **UI consistente**: Misma interfaz con opciones adicionales

## Consideraciones

### Almacenamiento
- Los archivos se almacenan igual que las imágenes (base64 en IndexedDB)
- Considerar límites de tamaño para archivos grandes

### Validación
- Para bitácoras históricas, no validar aviso de salida
- Permitir milestones sin GPS (opcional)
- Permitir timestamps en el pasado

### Exportación PDF
- Las bitácoras históricas pueden no tener aviso de salida en el PDF
- Incluir archivos adjuntos en el PDF si es posible

## Próximos Pasos

1. ✅ Crear rama `feature/async-logbook`
2. ⏳ Extender tipos TypeScript
3. ⏳ Modificar flujo de creación
4. ⏳ Agregar UI para subir archivos
5. ⏳ Agregar entrada manual de GPS
6. ⏳ Agregar filtros en lista de bitácoras
7. ⏳ Actualizar generador de PDF
8. ⏳ Testing
