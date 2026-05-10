#!/bin/bash
# Script para ayudar a configurar la clave SSH para localhost.run
# Esto permite obtener dominios más estables y mejor rendimiento

set -e

echo "🔑 Configuración de Clave SSH para localhost.run"
echo ""
echo "Este script te ayudará a configurar tu clave SSH para obtener:"
echo "  ✅ Dominios más estables"
echo "  ✅ Mejor rendimiento"
echo "  ✅ Autenticación automática"
echo ""

# Verificar si SSH está instalado
if ! command -v ssh &> /dev/null; then
    echo "❌ SSH no está instalado."
    echo ""
    echo "Instalación:"
    echo "  Ubuntu/Debian: sudo apt install openssh-client"
    echo "  macOS: Ya viene instalado"
    echo ""
    exit 1
fi

# Buscar claves SSH existentes
SSH_DIR="$HOME/.ssh"
KEY_TYPES=("id_ed25519" "id_rsa" "id_ecdsa")

echo "🔍 Buscando claves SSH existentes..."
echo ""

FOUND_KEYS=()
for key_type in "${KEY_TYPES[@]}"; do
    if [ -f "$SSH_DIR/$key_type.pub" ]; then
        FOUND_KEYS+=("$key_type")
        echo "  ✅ Encontrada: $key_type.pub"
    fi
done

if [ ${#FOUND_KEYS[@]} -eq 0 ]; then
    echo "  ⚠️  No se encontraron claves SSH"
    echo ""
    read -p "¿Quieres generar una nueva clave SSH? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "Generando nueva clave SSH (ed25519)..."
        read -p "Ingresa tu email (opcional, para identificación): " EMAIL
        if [ -z "$EMAIL" ]; then
            ssh-keygen -t ed25519 -f "$SSH_DIR/id_ed25519" -N ""
        else
            ssh-keygen -t ed25519 -f "$SSH_DIR/id_ed25519" -C "$EMAIL" -N ""
        fi
        FOUND_KEYS=("id_ed25519")
        echo ""
        echo "✅ Clave SSH generada exitosamente"
        echo ""
    else
        echo ""
        echo "Para generar una clave SSH manualmente, ejecuta:"
        echo "  ssh-keygen -t ed25519 -C 'tu-email@ejemplo.com'"
        echo ""
        exit 0
    fi
fi

# Seleccionar clave
if [ ${#FOUND_KEYS[@]} -eq 1 ]; then
    SELECTED_KEY="${FOUND_KEYS[0]}"
    echo "Usando clave: $SELECTED_KEY"
else
    echo ""
    echo "Selecciona la clave que quieres usar:"
    for i in "${!FOUND_KEYS[@]}"; do
        echo "  $((i+1)). ${FOUND_KEYS[$i]}"
    done
    read -p "Opción (1-${#FOUND_KEYS[@]}): " SELECTION
    SELECTED_KEY="${FOUND_KEYS[$((SELECTION-1))]}"
fi

PUBLIC_KEY_FILE="$SSH_DIR/$SELECTED_KEY.pub"

# Mostrar la clave pública
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Tu clave SSH pública:"
echo ""
cat "$PUBLIC_KEY_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Intentar copiar al portapapeles
if command -v xclip &> /dev/null; then
    cat "$PUBLIC_KEY_FILE" | xclip -selection clipboard
    echo "✅ Clave copiada al portapapeles (xclip)"
elif command -v xsel &> /dev/null; then
    cat "$PUBLIC_KEY_FILE" | xsel --clipboard --input
    echo "✅ Clave copiada al portapapeles (xsel)"
elif command -v pbcopy &> /dev/null; then
    cat "$PUBLIC_KEY_FILE" | pbcopy
    echo "✅ Clave copiada al portapapeles (pbcopy)"
else
    echo "💡 Tip: Copia manualmente la clave de arriba"
fi

echo ""
echo "📝 Siguiente paso:"
echo ""
echo "1. Ve a: https://admin.localhost.run"
echo "2. Si no tienes cuenta:"
echo "   - Haz clic en 'Sign up' o 'Register'"
echo "   - Crea una cuenta con tu email"
echo "   - Verifica tu email si es necesario"
echo "3. Inicia sesión"
echo "4. Ve a la sección 'SSH Keys' (en el menú o dashboard)"
echo "5. Haz clic en 'Add SSH Key' o el botón '+'"
echo "6. Completa el formulario:"
echo "   - Description: Un nombre descriptivo (ej: 'Mi PC de desarrollo')"
echo "   - SSH public key: Pega la clave que se mostró arriba"
echo "7. Guarda la clave"
echo ""
echo "⚠️  Si ves 'User [email] not found':"
echo "   - Asegúrate de haber creado la cuenta primero"
echo "   - Verifica que estés usando el mismo email con el que te registraste"
echo "   - Intenta cerrar sesión y volver a iniciar sesión"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Después de agregar la clave, cuando ejecutes 'yarn tunnel', verás:"
echo "   'authenticated as tu-usuario'"
echo ""
echo "   En lugar de:"
echo "   'authenticated as anonymous user'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "¿Quieres abrir https://admin.localhost.run en tu navegador? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open "https://admin.localhost.run"
    elif command -v open &> /dev/null; then
        open "https://admin.localhost.run"
    elif command -v start &> /dev/null; then
        start "https://admin.localhost.run"
    else
        echo "No se pudo abrir el navegador automáticamente"
        echo "Por favor, abre manualmente: https://admin.localhost.run"
    fi
fi

echo ""
echo "✨ ¡Listo! Después de agregar tu clave SSH, tus túneles serán más estables."
echo ""

