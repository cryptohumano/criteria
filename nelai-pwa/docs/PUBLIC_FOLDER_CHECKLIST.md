# Checklist de Archivos en `/public`

## ✅ Archivos Requeridos y Verificados

### Iconos y Favicons

1. **`favicon.svg`** ✅
   - Referenciado en: `index.html` línea 5
   - Tipo: SVG favicon moderno
   - Estado: ✅ Presente

2. **`favicon.ico`** ✅
   - Referenciado en: `vite.config.ts` (includeAssets)
   - Tipo: ICO favicon para compatibilidad legacy
   - Estado: ✅ Presente

3. **`favicon-96x96.png`** ✅
   - Tipo: PNG favicon 96x96
   - Estado: ✅ Presente (opcional pero útil)

4. **`apple-touch-icon.png`** ✅
   - Referenciado en: `index.html` línea 9, `vite.config.ts` (includeAssets)
   - Tamaño recomendado: 180x180px
   - Estado: ✅ Presente

### Iconos PWA

5. **`web-app-manifest-192x192.png`** ✅
   - Referenciado en: `vite.config.ts` (manifest.icons)
   - Tamaño: 192x192px
   - Propósito: any
   - Estado: ✅ Presente

6. **`web-app-manifest-512x512.png`** ✅
   - Referenciado en: `vite.config.ts` (manifest.icons)
   - Tamaño: 512x512px
   - Propósito: any y maskable
   - Estado: ✅ Presente

### Manifest

7. **`site.webmanifest`** ⚠️
   - Estado: ⚠️ Presente pero NO se usa
   - Razón: VitePWA genera su propio manifest automáticamente
   - Recomendación: Se puede eliminar o mantener como backup
   - Nota: Si se mantiene, debe estar sincronizado con `vite.config.ts`

## 📋 Resumen de Referencias

### `index.html`
- ✅ `/favicon.svg` (corregido de `/vite.svg`)
- ✅ `/apple-touch-icon.png`

### `vite.config.ts`
- ✅ `includeAssets`: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`
- ✅ `manifest.icons`: `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`
- ✅ `shortcuts.icons`: `web-app-manifest-192x192.png`

## 🔧 Correcciones Realizadas

1. ✅ Corregido `index.html` para usar `favicon.svg` en lugar de `vite.svg`
2. ✅ Corregido `vite.config.ts` para usar `web-app-manifest-*.png` en lugar de `pwa-*.png`
3. ✅ Eliminado `mask-icon.svg` de `includeAssets` (no existe en public)
4. ✅ Agregado `favicon.svg` a `includeAssets`

## 📝 Archivos Opcionales pero Recomendados

- `favicon-96x96.png`: Útil para algunos navegadores legacy
- `site.webmanifest`: Puede mantenerse como backup, pero VitePWA genera uno automáticamente

## ⚠️ Notas Importantes

1. **VitePWA genera el manifest**: El plugin `vite-plugin-pwa` genera automáticamente un `manifest.webmanifest` basado en la configuración en `vite.config.ts`. El archivo `site.webmanifest` en public NO se usa a menos que se configure explícitamente.

2. **Nombres de iconos**: Los iconos deben llamarse exactamente como se referencia en `vite.config.ts`:
   - `web-app-manifest-192x192.png` (no `pwa-192x192.png`)
   - `web-app-manifest-512x512.png` (no `pwa-512x512.png`)

3. **Tamaños requeridos**: 
   - Apple Touch Icon: 180x180px (recomendado)
   - PWA Icon 192x192: 192x192px (mínimo)
   - PWA Icon 512x512: 512x512px (recomendado)

## ✅ Estado Final

Todos los archivos requeridos están presentes y las referencias están corregidas. La carpeta `/public` está lista para producción.
