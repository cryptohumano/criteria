# Uso de Archivos GPX/KMZ en Bitácoras de Montañismo

## ¿Es necesario el archivo GPX/KMZ?

**No es obligatorio**, pero es **muy recomendable** por las siguientes razones:

### Ventajas de incluir un archivo GPX:

1. **Pre-carga de Waypoints**: Los waypoints del GPX se pueden convertir automáticamente en milestones de la bitácora
2. **Ruta Planificada**: Tienes una referencia visual de la ruta que planeas seguir
3. **Comparación**: Puedes comparar la ruta planificada (GPX) vs la ruta real (tracking GPS)
4. **Validación**: Verificar que todos los participantes tengan la ruta correcta
5. **Compartir**: Exportar la ruta para compartir con otros miembros del equipo
6. **Backup**: Tener una copia de la ruta planificada en caso de emergencia

## ¿Qué se puede hacer con un archivo GPX?

### 1. **Extraer Waypoints**
Los waypoints del GPX (puntos de referencia como campamentos, cumbres, cruces) se pueden convertir automáticamente en milestones de la bitácora.

**Ejemplo:**
- Waypoint "Base Camp" → Milestone tipo "Campamento"
- Waypoint "Summit" → Milestone tipo "Cima"
- Waypoint "Cruce de Río" → Milestone tipo "Checkpoint"

### 2. **Visualizar la Ruta Planificada**
El GPX contiene tracks (trazados) que muestran la ruta completa. Esto se puede visualizar en un mapa para:
- Ver el perfil de elevación
- Calcular distancias
- Identificar puntos críticos
- Planificar tiempos de marcha

### 3. **Comparar Ruta Planificada vs Real**
Durante la expedición, el tracking GPS registra la ruta real. Al finalizar, puedes comparar:
- ¿Seguimos la ruta planificada?
- ¿Cuánto nos desviamos?
- ¿Qué puntos no alcanzamos?

### 4. **Calcular Estadísticas**
Del GPX se pueden extraer:
- Distancia total planificada
- Ganancia/pérdida de elevación
- Elevación máxima/mínima
- Tiempo estimado (si incluye tiempos)

### 5. **Exportar y Compartir**
Una vez procesado, el GPX se puede:
- Exportar como PDF con la ruta
- Compartir con otros miembros del equipo
- Enviar a servicios de emergencia si es necesario

## Formato de Archivos

### GPX (GPS Exchange Format)
- Formato estándar XML
- Contiene waypoints, tracks y rutas
- Ampliamente soportado
- **Recomendado para uso en la app**

### KMZ (Keyhole Markup Zipped)
- Es un archivo ZIP que contiene un KML (similar a GPX)
- Usado principalmente por Google Earth
- **Por ahora no está completamente soportado** (se requiere extraer el GPX manualmente)

## Cómo Obtener un Archivo GPX

### Opción 1: Exportar desde Apps de Navegación
- **AllTrails**: Exportar ruta como GPX
- **Komoot**: Descargar ruta en formato GPX
- **Gaia GPS**: Exportar track como GPX
- **Strava**: Exportar actividad como GPX
- **Google Earth**: Guardar ruta como KML, convertir a GPX

### Opción 2: Crear Manualmente
- Usar editores como:
  - **GPX Editor** (web)
  - **Garmin BaseCamp**
  - **QGIS** (software GIS)

### Opción 3: Descargar de Fuentes Públicas
- **Wikiloc**: Miles de rutas compartidas en GPX
- **OpenStreetMap**: Datos de rutas en formato GPX
- **Federaciones de montañismo**: A menudo comparten rutas en GPX

## Procesamiento en la App

Cuando subes un archivo GPX:

1. **Validación**: Se verifica que sea un GPX válido
2. **Parsing**: Se extraen waypoints, tracks y rutas
3. **Conversión**: Los waypoints se convierten a formato GPSPoint
4. **Estadísticas**: Se calculan distancias y elevaciones
5. **Almacenamiento**: Se guarda el nombre del archivo y metadata

### Próximas Funcionalidades (TODO)

- [ ] Pre-cargar waypoints como milestones automáticamente
- [ ] Visualizar ruta en mapa interactivo
- [ ] Comparar ruta planificada vs real
- [ ] Exportar bitácora con ruta GPX incluida
- [ ] Sincronizar con apps de navegación externas

## Ejemplo de Uso

```typescript
// Cuando el usuario sube un GPX
const gpxFile = event.target.files[0]
const parsed = await parseGPX(gpxFile)

// Extraer waypoints
const waypoints = convertGPXWaypointsToGPSPoints(parsed.waypoints)

// Calcular estadísticas
const stats = calculateGPXStats(waypoints)

// Mostrar al usuario
console.log(`Ruta: ${stats.totalDistance / 1000} km`)
console.log(`Elevación: ${stats.maxElevation}m`)
console.log(`Waypoints: ${waypoints.length}`)
```

## Recomendaciones

1. **Siempre incluye un GPX** si tienes una ruta planificada
2. **Valida el GPX** antes de la expedición (abre en una app de mapas)
3. **Comparte el GPX** con todos los participantes
4. **Guarda una copia offline** del GPX en tu dispositivo
5. **Compara después** la ruta planificada vs la real para mejorar futuras expediciones
