# 📍 Tracking GPS - Guía de Funcionamiento

## ¿Cómo funciona el Tracking GPS?

El sistema de tracking GPS en la bitácora de montañismo permite registrar automáticamente o manualmente tu ubicación durante la expedición.

### 🎯 Modos de Tracking

#### 1. **Tracking Automático**
- **Cómo activarlo**: Presiona el botón "Iniciar Tracking" (▶️) en la pestaña "GPS & Tracking"
- **Funcionamiento**:
  - El sistema solicita permisos de geolocalización del navegador
  - Una vez autorizado, comienza a capturar tu ubicación automáticamente
  - Los puntos GPS se registran cada **5 segundos** por defecto (configurable)
  - Cada punto incluye:
    - Latitud y Longitud
    - Altitud (si está disponible)
    - Precisión del GPS
    - Velocidad (calculada automáticamente)
    - Dirección/Heading (calculada automáticamente)
    - Timestamp exacto

#### 2. **Tracking Manual**
- **Cómo usarlo**: Presiona el botón "Agregar Punto Manual" (📍)
- **Funcionamiento**:
  - Captura tu ubicación actual en ese momento
  - Útil para marcar puntos específicos (campamentos, cumbres, cruces, etc.)
  - Se puede usar incluso si el tracking automático está desactivado

### 🔧 Configuración Técnica

#### Precisión Alta (High Accuracy)
- **Activado por defecto**: Sí
- **Qué hace**: 
  - Usa GPS satelital en lugar de solo WiFi/celular
  - Mayor precisión (típicamente 3-10 metros)
  - Mayor consumo de batería
  - Mejor para actividades al aire libre

#### Intervalo de Captura
- **Por defecto**: 5 segundos
- **Configurable**: Se puede ajustar según necesidades
- **Consideraciones**:
  - Intervalos más cortos = más puntos = más precisión pero más batería
  - Intervalos más largos = menos puntos = menos batería pero menos detalle

### 📊 Datos Capturados

Cada punto GPS incluye:

```typescript
{
  latitude: number        // Latitud en grados decimales
  longitude: number       // Longitud en grados decimales
  altitude?: number       // Altitud en metros (si disponible)
  accuracy?: number       // Precisión en metros (±X metros)
  timestamp: number        // Timestamp Unix en milisegundos
  speed?: number          // Velocidad en m/s (calculada)
  heading?: number        // Dirección en grados 0-360 (calculada)
}
```

### 🗺️ Visualización

Los puntos GPS capturados se pueden ver en:
- **Pestaña "GPS & Tracking"**: Lista de todos los puntos
- **Milestones**: Cada milestone puede tener un punto GPS asociado
- **Estadísticas**: Distancia total, elevación ganada/perdida, etc.

### ⚠️ Permisos y Requisitos

#### Navegador
- **Chrome/Edge**: ✅ Soporta GPS completo
- **Firefox**: ✅ Soporta GPS completo
- **Safari (iOS)**: ✅ Soporta GPS completo
- **Opera**: ✅ Soporta GPS completo

#### Permisos Necesarios
1. **Geolocalización**: El navegador pedirá permiso la primera vez
   - En móviles: Permiso de ubicación del sistema
   - En desktop: Permiso del navegador

#### HTTPS Requerido
- ⚠️ **Importante**: El GPS solo funciona en conexiones HTTPS
- En localhost funciona sin HTTPS
- En producción debe estar en HTTPS

### 🔋 Optimización de Batería

#### Recomendaciones
1. **Usar tracking automático solo cuando sea necesario**
2. **Aumentar el intervalo** si la batería es crítica (ej: 10-15 segundos)
3. **Usar tracking manual** para puntos importantes
4. **Detener el tracking** cuando no se esté moviendo

### 🚀 Cómo Usar

#### Paso 1: Iniciar Tracking
1. Abre la bitácora
2. Ve a la pestaña "GPS & Tracking"
3. Presiona "Iniciar Tracking" (▶️)
4. Autoriza los permisos de ubicación

#### Paso 2: Durante la Expedición
- El sistema capturará puntos automáticamente cada 5 segundos
- Puedes agregar puntos manuales en momentos importantes
- Verás tu ubicación actual en tiempo real

#### Paso 3: Detener Tracking
- Presiona "Detener Tracking" (⏹️) cuando termines
- Todos los puntos se guardan automáticamente

### 📱 Funcionamiento en Móviles

#### Android
- Usa GPS satelital + WiFi + Red celular
- Alta precisión disponible
- Funciona en segundo plano si el navegador está abierto

#### iOS
- Usa GPS satelital + WiFi + Red celular
- Requiere que la app esté en primer plano
- Mejor precisión cuando hay señal GPS clara

### 🐛 Solución de Problemas

#### "Geolocalización no disponible"
- Verifica que estés en HTTPS (o localhost)
- Asegúrate de que el navegador soporte geolocalización

#### "Permiso denegado"
- Ve a configuración del navegador
- Permite acceso a ubicación para este sitio
- En móviles: Verifica permisos del sistema

#### "Precisión baja"
- Asegúrate de estar al aire libre
- Espera unos segundos para que el GPS se sincronice
- Verifica que "Alta Precisión" esté activado

#### "No captura puntos"
- Verifica que el tracking esté activo (botón verde)
- Revisa la consola del navegador para errores
- Intenta detener y reiniciar el tracking

### 💡 Consejos

1. **Inicia el tracking antes de comenzar** la expedición
2. **Agrega milestones manuales** en puntos importantes
3. **Revisa los puntos** al final del día para verificar que todo se capturó
4. **Usa tracking manual** si el automático consume mucha batería
5. **Guarda la bitácora** regularmente para no perder datos
