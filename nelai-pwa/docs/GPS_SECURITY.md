# 🔒 Seguridad GPS y Detección de Spoofing

## ⚠️ Limitaciones Fundamentales

**IMPORTANTE**: En una PWA del lado del cliente, es **IMPOSIBLE prevenir completamente** el GPS spoofing. Las validaciones implementadas ayudan a **detectar patrones sospechosos**, pero un usuario determinado puede eludirlas.

### Por qué es difícil prevenir el spoofing:

1. **Control del Cliente**: El código JavaScript se ejecuta en el navegador del usuario
2. **APIs del Navegador**: Dependemos de `navigator.geolocation`, que puede ser manipulado
3. **Apps de Spoofing**: Existen aplicaciones que pueden inyectar ubicaciones falsas
4. **Sin Servidor**: Sin validación del lado del servidor, no hay forma de verificar la autenticidad

## 🛡️ Validaciones Implementadas

### 1. Validación de Coordenadas
- ✅ Verifica que latitud esté entre -90 y 90
- ✅ Verifica que longitud esté entre -180 y 180
- ✅ Rechaza coordenadas fuera de rango

### 2. Validación de Precisión
- ⚠️ Alerta si la precisión es > 100m (baja confianza)
- ⚠️ Alerta si la precisión es > 50m (precisión moderada)
- 📉 Reduce la confianza del punto según la precisión

### 3. Validación de Velocidad
- ⚠️ Detecta velocidades > 10 km/h durante la actividad (sospechoso para montañismo)
- ⚠️ Detecta saltos de ubicación que requieren velocidades > 150 km/h
- 📉 Marca puntos con velocidades irrealistas

### 4. Validación de Saltos de Ubicación
- ⚠️ Detecta saltos grandes entre puntos consecutivos
- 📊 Calcula la distancia máxima razonable basada en tiempo y velocidad
- 🚨 Marca saltos que requieren velocidades imposibles

### 5. Validación de Altitud
- ✅ Verifica que la altitud esté entre -100m y 9000m (rango razonable)
- ⚠️ Detecta cambios de altitud inconsistentes (ej: +1000m en <1km horizontal)
- 📉 Reduce confianza en cambios de altitud sospechosos

### 6. Validación de Timestamp
- ⚠️ Detecta timestamps muy diferentes del tiempo actual
- 🚨 Marca puntos con timestamps sospechosos

### 7. Detección de Patrones
- 🔍 Detecta si todos los puntos están en la misma ubicación (GPS fijo)
- 🔍 Detecta muchos saltos grandes en la secuencia
- 📊 Analiza la secuencia completa para patrones sospechosos

## 📊 Sistema de Confianza

Cada punto GPS recibe un **score de confianza** (0-100):

- **90-100**: Muy confiable ✅
- **70-89**: Confiable ✅
- **50-69**: Moderadamente confiable ⚠️
- **0-49**: Poco confiable / Sospechoso 🚨

### Factores que reducen la confianza:

- Precisión baja: -10 a -20 puntos
- Velocidad sospechosa: -15 puntos
- Salto sospechoso: -30 puntos
- Altitud inconsistente: -20 puntos
- Timestamp anómalo: -15 puntos
- Altitud fuera de rango: -25 puntos

## 🎯 Cómo Funciona

### Validación Individual
```typescript
import { validateGPSPoint } from '@/utils/gpsValidation'

const validation = validateGPSPoint(currentPoint, previousPoint)
if (!validation.isValid) {
  console.warn('Punto GPS sospechoso:', validation.warnings)
}
```

### Validación de Secuencia
```typescript
import { validateGPSSequence } from '@/utils/gpsValidation'

const sequenceValidation = validateGPSSequence(allPoints)
if (sequenceValidation.confidence < 70) {
  console.warn('Secuencia GPS sospechosa:', sequenceValidation.warnings)
}
```

## 🚨 Señales de Alerta

El sistema marca puntos como sospechosos cuando detecta:

1. **Saltos imposibles**: Distancias que requieren velocidades > 150 km/h
2. **Velocidades altas**: > 10 km/h durante montañismo (excepto en vehículo)
3. **Precisión muy baja**: > 100m de error
4. **Altitud inconsistente**: Cambios de >1000m en <1km horizontal
5. **GPS fijo**: Todos los puntos en la misma ubicación exacta
6. **Timestamps anómalos**: Muy diferentes del tiempo actual

## 💡 Mejores Prácticas

### Para Usuarios:
1. **Usa GPS real**: No uses apps de spoofing
2. **Permite alta precisión**: Activa "Alta Precisión" en tu dispositivo
3. **Espera la señal**: Deja que el GPS se sincronice antes de comenzar
4. **Al aire libre**: El GPS funciona mejor al aire libre

### Para Desarrolladores:
1. **Validación del lado del servidor**: Si es posible, valida en el servidor
2. **Comparación con mapas**: Verifica que las coordenadas estén en rutas válidas
3. **Análisis de patrones**: Analiza secuencias completas, no solo puntos individuales
4. **Marcado de sospechosos**: Marca puntos sospechosos pero no los rechaces completamente
5. **Logging**: Registra todos los puntos sospechosos para análisis posterior

## 🔐 Soluciones Avanzadas (Futuras)

### 1. Validación del Servidor
- Comparar con mapas de rutas conocidas
- Verificar contra datos históricos
- Análisis de patrones de movimiento

### 2. Sensores Adicionales
- Acelerómetro: Detectar movimiento real
- Brújula: Verificar dirección de movimiento
- Barómetro: Validar cambios de altitud

### 3. Machine Learning
- Entrenar modelos con datos reales vs falsos
- Detectar patrones anómalos
- Clasificar automáticamente puntos sospechosos

### 4. Blockchain / Timestamping
- Registrar timestamps en blockchain
- Verificar que los puntos fueron capturados en tiempo real
- Prevenir manipulación de timestamps

## 📝 Notas Técnicas

### Limitaciones del Navegador:
- `navigator.geolocation` puede ser manipulado
- No hay forma de verificar la fuente real del GPS
- Las apps de spoofing pueden inyectar ubicaciones falsas

### Lo que SÍ podemos hacer:
- ✅ Detectar patrones sospechosos
- ✅ Marcar puntos con baja confianza
- ✅ Alertar al usuario sobre posibles problemas
- ✅ Registrar advertencias para análisis

### Lo que NO podemos hacer:
- ❌ Prevenir completamente el spoofing
- ❌ Verificar la autenticidad del GPS
- ❌ Detectar spoofing sofisticado
- ❌ Garantizar que todos los puntos sean reales

## 🎯 Conclusión

Las validaciones implementadas ayudan a **detectar y marcar** puntos GPS sospechosos, pero **no pueden prevenir completamente** el spoofing. Para aplicaciones críticas, se recomienda:

1. **Validación del servidor** cuando sea posible
2. **Análisis de patrones** de secuencias completas
3. **Marcado de puntos sospechosos** para revisión manual
4. **Educación del usuario** sobre la importancia de usar GPS real
