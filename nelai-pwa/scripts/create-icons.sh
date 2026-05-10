#!/bin/bash
# Script para crear iconos placeholder para la PWA

set -e

echo "🎨 Creando iconos placeholder para la PWA..."

mkdir -p public

# Verificar si ImageMagick está instalado
if command -v convert &> /dev/null; then
    echo "✅ ImageMagick encontrado, creando iconos..."
    
    # Crear icono 192x192
    convert -size 192x192 xc:#6366f1 -gravity center -pointsize 72 -fill white -annotate +0+0 "PWA" public/pwa-192x192.png
    
    # Crear icono 512x512
    convert -size 512x512 xc:#6366f1 -gravity center -pointsize 180 -fill white -annotate +0+0 "PWA" public/pwa-512x512.png
    
    # Crear apple-touch-icon (180x180)
    convert -size 180x180 xc:#6366f1 -gravity center -pointsize 72 -fill white -annotate +0+0 "PWA" public/apple-touch-icon.png
    
    echo "✅ Iconos creados en public/"
else
    echo "⚠️  ImageMagick no está instalado."
    echo ""
    echo "Instalación:"
    echo "  Ubuntu/Debian: sudo apt install imagemagick"
    echo "  macOS: brew install imagemagick"
    echo ""
    echo "O crea los iconos manualmente:"
    echo "  - public/pwa-192x192.png (192x192px)"
    echo "  - public/pwa-512x512.png (512x512px)"
    echo "  - public/apple-touch-icon.png (180x180px)"
    echo ""
    echo "Puedes usar herramientas online como:"
    echo "  - https://www.favicon-generator.org/"
    echo "  - https://realfavicongenerator.net/"
fi

