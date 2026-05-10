# Debugging en iOS/Safari

## Ver Consola de Safari en iPhone

### Opción 1: Safari Web Inspector (Recomendado)

1. **En tu Mac:**
   - Abre Safari
   - Ve a **Safari** → **Preferencias** → **Avanzado**
   - Activa **"Mostrar el menú Desarrollar en la barra de menú"**

2. **En tu iPhone:**
   - Ve a **Configuración** → **Safari** → **Avanzado**
   - Activa **"Inspección Web"**

3. **Conectar:**
   - Conecta tu iPhone a tu Mac con cable USB
   - En tu iPhone, abre la PWA en Safari
   - En tu Mac, ve a **Desarrollar** → **[Tu iPhone]** → **[Nombre de la PWA]**
   - Se abrirá la consola de Web Inspector

### Opción 2: Eruda (Consola en el dispositivo)

Agregar Eruda temporalmente para debugging:

```typescript
// En desarrollo, agregar al inicio de main.tsx
if (import.meta.env.DEV) {
  import('eruda').then(eruda => eruda.default.init())
}
```

## Ver Logs en iOS

### Usar `console.log` con Alertas

Para debugging rápido sin Web Inspector, puedes usar alertas:

```typescript
// Temporal para debugging
const debugLog = (message: string, data?: any) => {
  console.log(message, data)
  // Descomentar para ver en el dispositivo:
  // alert(`${message}: ${JSON.stringify(data)}`)
}
```

### Ver Logs en la PWA

Los logs aparecen en:
- **Safari Web Inspector** (si está conectado)
- **Consola del navegador** (si abres la PWA en Safari desktop)
- **Eruda** (si lo instalas)

## Problemas Comunes en iOS

### 1. Input File No Dispara onChange

**Síntoma:** La cámara se abre, tomas la foto, pero no se procesa.

**Solución:** Usar `useRef` para mantener el milestoneId:

```typescript
const milestoneIdForCapture = useRef<string | null>(null)

// Antes de abrir cámara
milestoneIdForCapture.current = milestoneId

// En handleImageFile
const milestoneId = milestoneIdForCapture.current
```

### 2. FileReader Falla Silenciosamente

**Síntoma:** No hay errores pero la imagen no se procesa.

**Solución:** Agregar handlers de error:

```typescript
reader.onerror = (error) => {
  console.error('Error en FileReader:', error)
  toast.error('Error al leer la imagen')
}
```

### 3. Canvas toDataURL Falla

**Síntoma:** Error al generar thumbnail.

**Solución:** Verificar que el canvas tenga dimensiones válidas:

```typescript
if (canvas.width === 0 || canvas.height === 0) {
  throw new Error('Canvas tiene dimensiones inválidas')
}
```

### 4. IndexedDB No Guarda

**Síntoma:** La imagen se procesa pero no aparece después de recargar.

**Solución:** Verificar que `saveMountainLog` complete:

```typescript
await saveMountainLog(updatedLog)
console.log('✅ Guardado completado')
// Verificar después
const saved = await getMountainLog(logId)
console.log('✅ Verificado:', saved.milestones[0].images.length)
```

## Testing en iOS

### Pasos para Reproducir el Problema

1. Abre la PWA en Safari en iPhone
2. Crea o abre una bitácora
3. Agrega un milestone
4. Intenta agregar una foto
5. Toma la foto y acepta
6. Verifica si aparece en el milestone

### Verificar en Web Inspector

1. Conecta iPhone a Mac
2. Abre Web Inspector
3. Ve a la pestaña **Console**
4. Busca logs que empiecen con `[handleImageFile]`
5. Verifica si hay errores

### Verificar IndexedDB

1. En Web Inspector, ve a **Storage** → **IndexedDB**
2. Busca `pwa-substrate-keyring`
3. Ve a `mountain-logs`
4. Busca tu bitácora
5. Verifica que el milestone tenga imágenes

## Logs Agregados

He agregado logs detallados en `handleImageFile`:

- `[handleImageFile] Archivo seleccionado` - Confirma que se seleccionó un archivo
- `[handleImageFile] Milestone ID` - Muestra el ID del milestone
- `[handleImageFile] Imagen leída` - Confirma que FileReader funcionó
- `[handleImageFile] Imagen cargada` - Confirma que la imagen se cargó
- `[handleImageFile] Guardando bitácora` - Antes de guardar
- `[handleImageFile] ✅ Imagen agregada` - Después de guardar exitosamente

## Solución Temporal: Usar Alertas

Si no puedes usar Web Inspector, puedes agregar alertas temporales:

```typescript
// En handleImageFile, después de cada paso importante:
alert(`Paso completado: ${mensaje}`)
```

**⚠️ Recuerda quitar las alertas antes de producción.**

## Próximos Pasos

1. Conecta tu iPhone a Mac con Safari Web Inspector
2. Reproduce el problema
3. Revisa los logs en la consola
4. Comparte los logs para identificar el problema exacto
