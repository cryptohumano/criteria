# Guía de Uso de Colores - AndinoWalletPWA

## 🎨 Paleta de Colores

### Colores Principales

#### Primary (Azul)
- **Light Mode**: `#0477BF` (HSL: `200 96% 38%`)
- **Dark Mode**: `#05C7F2` (HSL: `195 96% 48%`)
- **Uso**: Botones principales, acciones primarias, enlaces, elementos destacados
- **Ejemplo**: `<Button variant="default">` usa `bg-primary`

#### Accent (Rosa/Rojo)
- **Ambos Modos**: `#F21667` (HSL: `340 88% 52%`)
- **Uso**: Elementos destacados, selecciones activas, estados especiales
- **Ejemplo**: Tema seleccionado en ThemeToggle

#### Destructive (Rojo)
- **Light Mode**: Rojo medio (HSL: `0 84.2% 60.2%`)
- **Dark Mode**: Rojo oscuro (HSL: `0 62.8% 30.6%`)
- **Uso**: Errores, acciones destructivas, alertas críticas
- **Ejemplo**: Botón de eliminar, mensajes de error

### Colores de Fondo

#### Background
- **Light Mode**: Azul muy claro (HSL: `217 91% 98%`)
- **Dark Mode**: Azul muy oscuro (HSL: `222.2 47.4% 11.2%`)
- **Uso**: Fondo principal de la aplicación

#### Card
- **Light Mode**: Blanco azulado (HSL: `217 91% 99%`)
- **Dark Mode**: Azul oscuro (HSL: `217 33% 19%`)
- **Uso**: Fondos de cards, contenedores elevados

#### Muted
- **Light Mode**: Azul muy claro (HSL: `217 91% 97%`)
- **Dark Mode**: Gris azulado oscuro (HSL: `217 20% 25%`)
- **Uso**: Fondos sutiles, elementos deshabilitados, hover states

### Colores de Texto

#### Foreground
- **Light Mode**: Casi negro (HSL: `222.2 84% 4.9%`)
- **Dark Mode**: Casi blanco (HSL: `210 40% 98%`)
- **Uso**: Texto principal

#### Muted Foreground
- **Light Mode**: Gris medio (HSL: `215.4 16.3% 46.9%`)
- **Dark Mode**: Gris claro (HSL: `215 20.2% 65.1%`)
- **Uso**: Texto secundario, labels, hints

---

## 📐 Variables de Opacidad

Para evitar opacidades hardcodeadas, se han creado variables semánticas:

### Primary Opacities

| Variable | Valor | Uso | Clase Tailwind |
|----------|-------|-----|----------------|
| `--primary-subtle` | `5%` | Fondos muy sutiles | `bg-primary-subtle` |
| `--primary-light` | `10%` | Fondos sutiles, highlights | `bg-primary-light` |
| `--primary-border` | `20%` | Bordes sutiles | `border-primary-border` |
| `--primary-border-medium` | `50%` | Bordes más visibles | `border-primary-border-medium` |
| `--primary-hover` | `90%` | Estados hover | `hover:bg-primary-hover` |

### Accent Opacities

| Variable | Valor | Uso | Clase Tailwind |
|----------|-------|-----|----------------|
| `--accent-subtle` | `10%` | Fondos sutiles | `bg-accent-subtle` |
| `--accent-light` | `20%` | Fondos más visibles | `bg-accent-light` |

### Destructive Opacities

| Variable | Valor | Uso | Clase Tailwind |
|----------|-------|-----|----------------|
| `--destructive-subtle` | `5%` | Fondos muy sutiles (emergencias) | `bg-destructive-subtle` |
| `--destructive-light` | `10%` | Fondos sutiles (alertas) | `bg-destructive-light` |
| `--destructive-border` | `20%` | Bordes sutiles | `border-destructive-border` |
| `--destructive-border-medium` | `50%` | Bordes más visibles | `border-destructive-border-medium` |
| `--destructive-hover` | `90%` | Estados hover | `hover:bg-destructive-hover` |

### Muted Opacities

| Variable | Valor | Uso | Clase Tailwind |
|----------|-------|-----|----------------|
| `--muted-subtle` | `30%` | Fondos muy sutiles | `bg-muted-subtle` |
| `--muted-light` | `50%` | Fondos sutiles (muy común) | `bg-muted-light` |
| `--muted-hover` | `80%` | Estados hover en elementos muted | `hover:bg-muted-hover` |

---

## ✅ Uso Correcto

### Usar Variables Semánticas

```tsx
// ✅ Correcto - Usar variables semánticas
<Card className="bg-primary-light border-primary-border">
<Button variant="default"> // Usa bg-primary automáticamente
<div className="bg-primary-subtle"> // Fondo muy sutil
```

### Usar Opacidades con Variables

```tsx
// ✅ Correcto - Usar variables de opacidad
<Card className="bg-primary-light border-primary-border">
<div className="bg-primary-subtle">
<Button className="hover:bg-primary-hover">
```

### Usar Colores Semánticos

```tsx
// ✅ Correcto - Colores semánticos
<Button variant="destructive"> // Rojo para acciones destructivas
<Badge variant="default"> // Primary para badges
<div className="bg-muted"> // Fondo sutil
```

---

## ❌ Uso Incorrecto

### Evitar Opacidades Hardcodeadas

```tsx
// ❌ Incorrecto - Opacidades hardcodeadas
<Card className="bg-primary/10 border-primary/20">
<div className="bg-primary/5">
```

**Problema**: Las opacidades hardcodeadas no se adaptan bien entre light/dark mode y son difíciles de mantener.

**Solución**: Usar variables semánticas
```tsx
// ✅ Correcto
<Card className="bg-primary-light border-primary-border">
<div className="bg-primary-subtle">
```

### Evitar Colores Hardcodeados

```tsx
// ❌ Incorrecto - Colores hardcodeados
<div className="bg-blue-500">
<button className="text-red-600">
```

**Problema**: No respetan el tema, no son accesibles, difíciles de mantener.

**Solución**: Usar colores semánticos
```tsx
// ✅ Correcto
<div className="bg-primary">
<button className="text-destructive">
```

### Evitar Mezclar Formatos

```tsx
// ❌ Incorrecto - Mezclar HSL directo con variables
<div className="bg-[hsl(200_96%_38%)]">
<div className="bg-primary">
```

**Solución**: Usar siempre variables CSS
```tsx
// ✅ Correcto
<div className="bg-primary">
```

---

## 🎯 Casos de Uso Comunes

### Card con Énfasis Primary

```tsx
// Card destacada con tinte primary
<Card className="border-primary-border bg-primary-subtle">
  <CardContent>
    {/* Contenido */}
  </CardContent>
</Card>
```

### Botón con Hover

```tsx
// El Button component ya maneja esto automáticamente
<Button variant="default"> // hover:bg-primary-hover automático
```

### Badge o Tag

```tsx
// Badge con color primary
<Badge variant="default"> // bg-primary automático
```

### Input con Estado Activo

```tsx
// Input con borde primary cuando está activo
<Input className="focus:border-primary" />
```

### Skeleton/Loading

```tsx
// Skeleton usa primary-light automáticamente
<Skeleton className="h-4 w-full" />
```

### Progress Bar

```tsx
// Progress usa primary-border para el track
<Progress value={50} />
```

---

## 🌓 Dark Mode

Todos los colores se adaptan automáticamente al dark mode. Las variables CSS cambian según la clase `.dark` en el documento.

### Verificación

Para verificar que los colores funcionan en dark mode:

1. Usar el ThemeToggle para cambiar entre modos
2. Verificar que el contraste es adecuado
3. Asegurar que los textos son legibles

### Ajustes Específicos

Si necesitas un color específico para dark mode:

```tsx
// Usar variante dark: de Tailwind
<div className="bg-primary dark:bg-primary-light">
```

Pero generalmente no es necesario, las variables CSS ya manejan esto.

---

## 📋 Checklist de Uso

Antes de usar un color, verifica:

- [ ] ¿Es un color semántico? (`primary`, `destructive`, `muted`, etc.)
- [ ] ¿Necesito opacidad? Usa variables (`primary-light`, `primary-subtle`)
- [ ] ¿Funciona en dark mode? Las variables CSS lo manejan automáticamente
- [ ] ¿Tiene buen contraste? Usa `foreground` para texto sobre colores
- [ ] ¿Es accesible? Los colores semánticos están optimizados para accesibilidad

---

## 🔧 Agregar Nuevos Colores

Si necesitas agregar un nuevo color:

1. **Agregar variable en `index.css`**:
```css
@theme {
  --nuevo-color: 200 96% 38%;
}

.dark {
  --nuevo-color: 195 96% 48%;
}
```

2. **Exponer en `@theme inline`**:
```css
@theme inline {
  --color-nuevo-color: var(--nuevo-color);
}
```

3. **Agregar a `tailwind.config.ts`** (si es necesario):
```typescript
colors: {
  'nuevo-color': 'hsl(var(--nuevo-color))',
}
```

4. **Documentar en esta guía**

---

## 📚 Referencias

- [Análisis de Configuración de Colores](./ANALISIS_CONFIGURACION_COLORES.md)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)

---

**Última actualización**: 2024
**Versión**: 1.0
