#!/bin/bash

# Script para instalar componentes de shadcn/ui para Aura Wallet
# Prioriza experiencia de menos de 3 clicks

# Cambiar al directorio raíz del proyecto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

echo "🚀 Instalando componentes de shadcn/ui para Aura Wallet..."
echo "📁 Directorio: $PROJECT_ROOT"
echo ""

# Componentes de Prioridad Alta (Core)
echo "📦 Instalando componentes de Prioridad Alta..."
echo ""

HIGH_PRIORITY=(
  "input"
  "label"
  "select"
  "sonner"  # Toast (alternativa a toast)
  "sidebar"
  "table"
  "form"
  "avatar"
  "skeleton"
  "alert"
  "alert-dialog"
  "sheet"
  "drawer"
  "tabs"
  "command"
  "calendar"
  "popover"
  # "combobox"  # No disponible directamente, crear con popover + command
  # "date-picker"  # No disponible directamente, crear con calendar + popover
)

for component in "${HIGH_PRIORITY[@]}"; do
  echo "Instalando: $component"
  if ! npx shadcn@latest add "$component" --yes 2>/dev/null; then
    echo "⚠️  Error al instalar $component, continuando..."
  fi
done

echo ""
echo "✅ Componentes de Prioridad Alta instalados"
echo ""

# Componentes de Prioridad Media
read -p "¿Instalar componentes de Prioridad Media? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📦 Instalando componentes de Prioridad Media..."
  echo ""

  MEDIUM_PRIORITY=(
    "data-table"
    "navigation-menu"
    "breadcrumb"
    "checkbox"
    "radio-group"
    "switch"
    "textarea"
    "tooltip"
    "dropdown-menu"
    "context-menu"
    "progress"
    "spinner"
    "chart"
    "empty"
    "pagination"
    "scroll-area"
    "aspect-ratio"
    "toast"  # Alternativa a sonner (opcional)
  )

  for component in "${MEDIUM_PRIORITY[@]}"; do
    echo "Instalando: $component"
    if ! npx shadcn@latest add "$component" --yes 2>/dev/null; then
      echo "⚠️  Error al instalar $component, continuando..."
    fi
  done

  echo ""
  echo "✅ Componentes de Prioridad Media instalados"
  echo ""
fi

# Componentes de Prioridad Baja (Opcional)
read -p "¿Instalar componentes de Prioridad Baja (opcionales)? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📦 Instalando componentes de Prioridad Baja..."
  echo ""

  LOW_PRIORITY=(
    "accordion"
    "collapsible"
    "separator"
    "carousel"
    "resizable"
    "toggle"
    "toggle-group"
    "input-otp"
    "slider"
    "hover-card"
    "input-group"
    "field"
    "item"
    "kbd"
    "typography"
    "menubar"
    "native-select"
  )

  for component in "${LOW_PRIORITY[@]}"; do
    echo "Instalando: $component"
    if ! npx shadcn@latest add "$component" --yes 2>/dev/null; then
      echo "⚠️  Error al instalar $component, continuando..."
    fi
  done

  echo ""
  echo "✅ Componentes de Prioridad Baja instalados"
  echo ""
fi

echo ""
echo "🎉 Instalación completada!"
echo ""
echo "📝 Nota: Algunos componentes pueden requerir dependencias adicionales:"
echo "   - form: react-hook-form, zod"
echo "   - data-table: @tanstack/react-table"
echo "   - chart: recharts"
echo "   - sonner: sonner"
echo ""
echo "💡 Ejecuta 'yarn install' si hay dependencias faltantes"

