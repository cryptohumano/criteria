# Componentes Pendientes de Actualización - Sistema de Colores

## 📋 Resumen

Este documento lista los componentes que aún usan opacidades hardcodeadas y necesitan ser actualizados para usar las nuevas variables semánticas de colores.

**Total de componentes identificados**: ~40+ archivos

---

## ✅ Componentes Ya Actualizados

### Componentes UI Base
- ✅ `button.tsx` - Usa `primary-hover`, `destructive-hover`, `muted-hover`
- ✅ `badge.tsx` - Usa `primary-hover`, `destructive-hover`
- ✅ `table.tsx` - Usa `muted-light`
- ✅ `alert.tsx` - Usa `destructive-border-medium`
- ✅ `item.tsx` - Usa `accent-light`, `muted-light`
- ✅ `navigation-menu.tsx` - Usa `accent-light`
- ✅ `slider.tsx` - Usa `primary-border`, `primary-border-medium`
- ✅ `progress.tsx` - Usa `primary-border`
- ✅ `skeleton.tsx` - Usa `primary-light`
- ✅ `field.tsx` - Usa `primary-subtle`, `primary-light`

### Componentes de Páginas
- ✅ `MountainLogDetail.tsx` - Parcialmente actualizado
- ✅ `AvisoSalidaForm.tsx` - Actualizado
- ✅ `ActiveMountainLogCard.tsx` - Actualizado
- ✅ `QuickActionsGrid.tsx` - Actualizado
- ✅ `AccountDetail.tsx` - Actualizado
- ✅ `Settings.tsx` - Parcialmente actualizado
- ✅ `ImportAccount.tsx` - Actualizado

### Componentes de Layout
- ✅ `Header.tsx` - Actualizado
- ✅ `BottomNav.tsx` - Actualizado
- ✅ `RouteMap.tsx` - Parcialmente actualizado

---

## ⏳ Componentes Pendientes de Actualización

### 🔴 Alta Prioridad (Componentes de Emergencias)

#### `src/components/emergencies/EmergencyPanel.tsx`
```tsx
// Línea 119
<Card className="border-destructive/50 bg-destructive/5 mb-4">
// Cambiar a:
<Card className="border-destructive-border-medium bg-destructive-subtle mb-4">

// Línea 215
className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
// Cambiar a:
className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted-light cursor-pointer"
```

#### `src/components/home/ActiveEmergenciesCard.tsx`
```tsx
// Línea 96
<Card className="border-destructive/50 bg-destructive/5">
// Cambiar a:
<Card className="border-destructive-border-medium bg-destructive-subtle">
```

#### `src/pages/Emergencies.tsx`
```tsx
// Líneas 269-270
${isCritical ? 'border-destructive bg-destructive/5' : ''}
${isHigh ? 'border-destructive/50' : ''}
// Cambiar a:
${isCritical ? 'border-destructive bg-destructive-subtle' : ''}
${isHigh ? 'border-destructive-border-medium' : ''}
```

#### `src/pages/MountainLogDetail.tsx`
```tsx
// Línea 1397
<Card className="border-destructive/50 bg-destructive/5" data-emergency-section>
// Cambiar a:
<Card className="border-destructive-border-medium bg-destructive-subtle" data-emergency-section>

// Líneas 1627, 1654, 1692, 1947, 1979
bg-muted/30, bg-muted/50
// Cambiar a:
bg-muted-subtle, bg-muted-light
```

#### `src/components/home/MountainLogsMap.tsx`
```tsx
// Línea 363
<div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs">
// Cambiar a:
<div className="mb-2 p-2 bg-destructive-light border border-destructive-border rounded-lg text-xs">
```

#### `src/components/mountainLogs/QRScanner.tsx`
```tsx
// Línea 92
<div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive">
// Cambiar a:
<div className="p-3 bg-destructive-light border border-destructive-border rounded-lg flex items-center gap-2 text-sm text-destructive">
```

---

### 🟡 Media Prioridad (Componentes de Páginas)

#### `src/pages/Home.tsx`
```tsx
// Línea 61
<div className="w-full h-[calc(100vh-12rem)] min-h-[400px] rounded-lg border flex items-center justify-center bg-muted/50">
// Cambiar a:
<div className="w-full h-[calc(100vh-12rem)] min-h-[400px] rounded-lg border flex items-center justify-center bg-muted-light">
```

#### `src/pages/Transactions.tsx`
```tsx
// Línea 378
className={`p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
// Cambiar a:
className={`p-4 border rounded-lg hover:bg-muted-light transition-colors ${
```

#### `src/pages/Contacts.tsx`
```tsx
// Línea 314
className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
// Cambiar a:
className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted-light transition-colors"
```

#### `src/pages/Accounts.tsx`
```tsx
// Línea 74
className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
// Cambiar a:
className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted-light transition-colors"
```

#### `src/pages/Settings.tsx`
```tsx
// Línea 334
className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
// Cambiar a:
className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted-light transition-colors"
```

#### `src/pages/Send.tsx`
```tsx
// Línea 283
<div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
// Cambiar a:
<div className="flex items-center gap-2 p-2 border rounded-lg bg-muted-light">
```

---

### 🟢 Baja Prioridad (Componentes de Utilidades)

#### `src/components/home/RecentMountainLogsList.tsx`
```tsx
// Línea 105
className="block p-3 border rounded-lg hover:bg-muted/50 transition-colors"
// Cambiar a:
className="block p-3 border rounded-lg hover:bg-muted-light transition-colors"
```

#### `src/components/mountainLogs/RouteMap.tsx`
```tsx
// Línea 377
className="h-96 w-full rounded-lg border overflow-hidden bg-muted/50 flex items-center justify-center"
// Cambiar a:
className="h-96 w-full rounded-lg border overflow-hidden bg-muted-light flex items-center justify-center"

// Línea 527
className="flex items-start gap-3 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
// Cambiar a:
className="flex items-start gap-3 p-2 rounded-lg border bg-card hover:bg-muted-light transition-colors"
```

#### `src/components/mountainLogs/PlaneacionForm.tsx`
```tsx
// Línea 294
<Card className="bg-muted/50">
// Cambiar a:
<Card className="bg-muted-light">
```

#### `src/components/mountainLogs/ImageGallery.tsx`
```tsx
// Línea 138 (complejo - tiene lógica condicional)
className={`absolute top-4 right-16 h-10 w-10 bg-black/50 hover:bg-black/70 text-white z-20 ${showMetadata ? 'bg-primary/80' : ''}`}
// Cambiar a (revisar lógica):
className={`absolute top-4 right-16 h-10 w-10 bg-black/50 hover:bg-black/70 text-white z-20 ${showMetadata ? 'bg-primary-hover' : ''}`}

// Línea 190
<Card className="absolute bottom-0 left-0 right-0 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md bg-background/98 backdrop-blur-sm z-30 max-h-[80vh] sm:max-h-[60vh] overflow-hidden flex flex-col rounded-t-xl sm:rounded-lg shadow-2xl border-t-2 sm:border-t border-primary/20">
// Cambiar a:
<Card className="absolute bottom-0 left-0 right-0 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md bg-background/98 backdrop-blur-sm z-30 max-h-[80vh] sm:max-h-[60vh] overflow-hidden flex flex-col rounded-t-xl sm:rounded-lg shadow-2xl border-t-2 sm:border-t border-primary-border">

// Línea 202
className="h-9 w-9 flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
// Cambiar a:
className="h-9 w-9 flex-shrink-0 hover:bg-destructive-light hover:text-destructive"
```

---

### Componentes de Utilidades/Herramientas

Estos componentes tienen muchos usos de `bg-muted/50` y pueden actualizarse en batch:

- `src/components/WebAuthnManager.tsx` - Línea 125
- `src/components/SignVerify.tsx` - Líneas 113, 188, 223
- `src/components/Transactions.tsx` - Líneas 222, 355, 406
- `src/components/StorageQueries.tsx` - Líneas 342, 372, 389, 428
- `src/components/SS58Format.tsx` - Línea 60
- `src/components/PalletsExplorer.tsx` - Líneas 914, 936, 992, 1047
- `src/components/RuntimeApisExplorer.tsx` - Líneas 304, 321, 462, 468
- `src/components/KeyringManager.tsx` - Líneas 121, 198
- `src/components/EthereumDerivation.tsx` - Línea 89
- `src/components/EncryptDecrypt.tsx` - Líneas 246, 280
- `src/components/AccountInfo.tsx` - Línea 78
- `src/components/BlockExplorer.tsx` - Línea 209

**Patrón de actualización**:
```tsx
// Buscar y reemplazar:
bg-muted/50 → bg-muted-light
bg-muted/30 → bg-muted-subtle
hover:bg-muted/50 → hover:bg-muted-light
bg-destructive/10 → bg-destructive-light
bg-destructive/5 → bg-destructive-subtle
border-destructive/50 → border-destructive-border-medium
border-destructive/20 → border-destructive-border
```

---

## 📝 Guía de Actualización Rápida

### Variables Disponibles

#### Primary
- `bg-primary-subtle` → `bg-primary/5`
- `bg-primary-light` → `bg-primary/10`
- `border-primary-border` → `border-primary/20`
- `border-primary-border-medium` → `border-primary/50`
- `hover:bg-primary-hover` → `hover:bg-primary/90`

#### Destructive
- `bg-destructive-subtle` → `bg-destructive/5`
- `bg-destructive-light` → `bg-destructive/10`
- `border-destructive-border` → `border-destructive/20`
- `border-destructive-border-medium` → `border-destructive/50`
- `hover:bg-destructive-hover` → `hover:bg-destructive/90`

#### Muted
- `bg-muted-subtle` → `bg-muted/30`
- `bg-muted-light` → `bg-muted/50`
- `hover:bg-muted-hover` → `hover:bg-muted/80`

#### Accent
- `bg-accent-subtle` → `bg-accent/10`
- `bg-accent-light` → `bg-accent/20` o `bg-accent/50`

---

## 🎯 Priorización

1. **Alta Prioridad**: Componentes de emergencias (críticos para UX)
2. **Media Prioridad**: Páginas principales (Home, Transactions, Contacts, etc.)
3. **Baja Prioridad**: Componentes de utilidades y herramientas

---

## ✅ Checklist de Actualización

Para cada componente:

- [ ] Buscar todas las opacidades hardcodeadas
- [ ] Reemplazar con variables semánticas
- [ ] Verificar que funciona en light mode
- [ ] Verificar que funciona en dark mode
- [ ] Probar interactividad (hover, focus, etc.)
- [ ] Actualizar este documento marcando como completado

---

**Última actualización**: 2024
**Estado**: En progreso - ~15% completado
