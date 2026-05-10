#!/bin/bash
# Script para configurar HTTPS local con mkcert

set -e

echo "🔐 Configurando HTTPS local para desarrollo..."

# Verificar si mkcert está instalado
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert no está instalado."
    echo ""
    echo "Instalación:"
    echo "  Ubuntu/Debian: sudo apt install libnss3-tools && wget -O mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64 && chmod +x mkcert && sudo mv mkcert /usr/local/bin/"
    echo "  macOS: brew install mkcert"
    echo "  Windows: choco install mkcert"
    echo ""
    exit 1
fi

# Crear directorio para certificados si no existe
mkdir -p .certs

# Instalar CA local si no está instalado
if ! mkcert -CAROOT &> /dev/null; then
    echo "📜 Instalando CA local..."
    mkcert -install
fi

# Obtener la IP local
LOCAL_IP=$(hostname -I | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ip route get 1.1.1.1 | awk '{print $7; exit}')
fi

echo "🌐 IP local detectada: $LOCAL_IP"

# Generar certificados
echo "🔑 Generando certificados SSL..."
mkcert -key-file .certs/key.pem -cert-file .certs/cert.pem localhost 127.0.0.1 ::1 $LOCAL_IP

echo ""
echo "✅ Certificados generados en .certs/"
echo ""
echo "📱 Para acceder desde tu móvil:"
echo "   1. Asegúrate de que tu PC y móvil estén en la misma red WiFi"
echo "   2. En tu móvil, abre: https://$LOCAL_IP:5173"
echo "   3. Acepta el certificado (será marcado como no confiable, es normal en desarrollo)"
echo ""
echo "🚀 Inicia el servidor con: yarn dev:https"

