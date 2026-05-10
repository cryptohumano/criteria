# Migración al Estándar shadcn/ui

## ✅ Migración Completada

Se ha migrado el proyecto para seguir **100% el estándar oficial de shadcn/ui** usando opacidades de Tailwind directamente en lugar de variables CSS personalizadas.

---

## 🔄 Cambios Realizados

### 1. **Eliminadas Variables de Opacidad Personalizadas**

**Antes**:
```css
--primary-subtle: 200 96% 38% / 0.05;
--primary-light: 200 96% 38% / 0.1;
--primary-border: 200 96% 38% / 0.2;
--primary-hover: 200 96% 38% / 0.9;
/* ... más variables */
```

**Después**:
```css
/* Variables eliminadas - ahora usamos opacidades de Tailwind directamente */
```

### 2. **Actualizados Componentes UI Base**

Todos los componentes ahora usan opacidades de Tailwind según el estándar:

#### Button
```tsx
// Antes: hover:bg-primary-hover
// Después: hover:bg-primary/90 ✅
```

#### Badge
```tsx
// Antes: hover:bg-primary-hover
// Después: hover:bg-primary/80 ✅
```

#### Table
```tsx
// Antes: bg-muted-light, hover:bg-muted-light
// Después: bg-muted/50, hover:bg-muted/50 ✅
```

#### Slider, Progress, Skeleton
```tsx
// Antes: bg-primary-border, bg-primary-light
// Después: bg-primary/20, bg-primary/10 ✅
```

### 3. **Actualizados Componentes de Páginas**

- `MountainLogDetail.tsx`: `bg-primary/10 border-primary/20`
- `AvisoSalidaForm.tsx`: `border-primary/50 bg-primary/5`
- `ActiveMountainLogCard.tsx`: `border-primary/20 bg-primary/5`
- `QuickActionsGrid.tsx`: `border-primary/20 bg-primary/5`
- `ImportAccount.tsx`: `bg-primary/10`
- `AccountDetail.tsx`: `bg-primary/10 border-primary/20`
- `Settings.tsx`: `bg-primary/10`

### 4. **Actualizados Componentes de Layout**

- `Header.tsx`: `bg-primary/10`
- `BottomNav.tsx`: `hover:bg-primary/90`, `border-primary/40`
- `RouteMap.tsx`: `bg-primary/10`

### 5. **Limpiado tailwind.config.ts**

Eliminadas todas las referencias a variables de opacidad personalizadas.

---

## 📋 Mapeo de Opacidades

### Primary
| Uso | Opacidad Tailwind | Ejemplo |
|-----|-------------------|---------|
| Fondo muy sutil | `bg-primary/5` | Cards destacadas |
| Fondo sutil | `bg-primary/10` | Highlights, avatares |
| Borde sutil | `border-primary/20` | Bordes de cards |
| Borde medio | `border-primary/50` | Bordes más visibles |
| Hover | `hover:bg-primary/90` | Botones, badges |

### Destructive
| Uso | Opacidad Tailwind | Ejemplo |
|-----|-------------------|---------|
| Fondo muy sutil | `bg-destructive/5` | Cards de emergencia |
| Fondo sutil | `bg-destructive/10` | Alertas |
| Borde sutil | `border-destructive/20` | Bordes de alertas |
| Borde medio | `border-destructive/50` | Bordes más visibles |
| Hover | `hover:bg-destructive/90` | Botones destructivos |

### Muted
| Uso | Opacidad Tailwind | Ejemplo |
|-----|-------------------|---------|
| Fondo sutil | `bg-muted/30` | Fondos muy sutiles |
| Fondo medio | `bg-muted/50` | Fondos comunes (tablas, listas) |
| Hover | `hover:bg-muted/80` | Estados hover |

### Accent
| Uso | Opacidad Tailwind | Ejemplo |
|-----|-------------------|---------|
| Fondo sutil | `bg-accent/50` | Estados activos |

---

## ✅ Ventajas del Estándar

1. **Compatibilidad 100%** con shadcn/ui
2. **Menos código** - No necesitamos mantener variables adicionales
3. **Más flexible** - Puedes usar cualquier opacidad (5%, 10%, 20%, etc.)
4. **Familiar** - Cualquier desarrollador que conozca shadcn/ui entenderá el código
5. **Funciona automáticamente** - Tailwind maneja las opacidades con variables CSS

---

## 🎯 Uso Correcto (Estándar shadcn/ui)

```tsx
// ✅ Correcto - Opacidades de Tailwind
<Card className="bg-primary/10 border-primary/20">
<Button className="hover:bg-primary/90">
<div className="bg-muted/50">
<Badge className="hover:bg-destructive/80">
```

---

## ❌ Evitar

```tsx
// ❌ Incorrecto - Variables personalizadas (ya no existen)
<Card className="bg-primary-light border-primary-border">
<Button className="hover:bg-primary-hover">
```

---

## 📚 Referencias

- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui Button Source](https://github.com/shadcn-ui/ui/blob/main/apps/www/registry/new-york/ui/button.tsx)
- [Tailwind CSS Opacity Modifiers](https://tailwindcss.com/docs/opacity)

---

**Fecha de migración**: 2024
**Estado**: ✅ Completado - 100% compatible con estándar shadcn/ui
