# Configuración shadcn/ui - Andino Wallet

## ✅ Estado Actual

### components.json
- ✅ Estilo: `new-york`
- ✅ Base color: `stone`
- ✅ CSS Variables: `true`
- ✅ RSC: `false` (correcto para Vite)
- ✅ TSX: `true`
- ✅ Icon Library: `lucide`

### Problemas Detectados y Soluciones

#### 1. Variables CSS Duplicadas
**Problema**: Variables definidas en `@theme` (HSL) y también en `:root/.dark` (oklch), causando conflictos.

**Solución**: Usar solo HSL en `@theme` y eliminar duplicados en `:root/.dark`.

#### 2. Dark Mode Incorrecto
**Problema**: Usando `@media (prefers-color-scheme: dark)` en lugar de clase `.dark`.

**Solución**: Mover variables dark mode a `.dark` para que funcione con ThemeProvider.

#### 3. Formato de Colores Mixto
**Problema**: Mezcla de HSL y oklch.

**Solución**: Usar solo HSL (formato estándar de shadcn/ui con CSS variables).

## 📋 Checklist de Configuración

- [x] components.json configurado correctamente
- [x] Tailwind CSS v4 configurado (@import "tailwindcss")
- [x] ThemeProvider implementado
- [ ] Variables CSS unificadas (HSL solamente)
- [ ] Dark mode usando clase `.dark`
- [ ] Eliminar variables duplicadas

## 🔧 Archivos a Corregir

1. `src/index.css` - Unificar variables CSS
2. Verificar que ThemeProvider aplique clase `.dark` correctamente
