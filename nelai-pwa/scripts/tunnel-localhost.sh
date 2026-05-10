#!/bin/bash
# Script para crear túnel HTTPS usando localhost.run
# Más información: https://localhost.run/docs/

set -e

PORT=${1:-5173}
USE_NOKEY=${2:-false}  # Usar nokey@localhost.run para túneles gratuitos sin clave SSH

echo "🌐 Creando túnel HTTPS con localhost.run..."
echo ""
echo "Uso: yarn tunnel [puerto] [nokey]"
echo "  puerto: Puerto local (default: 5173)"
echo "  nokey: Usar 'nokey' para túnel gratuito sin clave SSH"
echo ""
echo "Uso: yarn tunnel [puerto] [nokey]"
echo "  puerto: Puerto local (default: 5173)"
echo "  nokey: Usar 'nokey' para túnel gratuito sin clave SSH"
echo ""

# Verificar que el servidor esté corriendo y respondiendo
echo "🔍 Verificando servidor en puerto $PORT..."
if ! lsof -i :$PORT > /dev/null 2>&1; then
    echo "⚠️  ADVERTENCIA: No se detecta ningún servidor corriendo en el puerto $PORT"
    echo ""
    echo "📝 Por favor, inicia el servidor de desarrollo en otra terminal:"
    echo "   yarn dev"
    echo "   O si usas HTTPS local:"
    echo "   yarn dev:https"
    echo ""
    echo "   Luego ejecuta este script nuevamente."
    echo ""
    read -p "¿Continuar de todos modos? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    echo ""
else
    # Verificar que el servidor responda
    HTTP_TEST=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null || echo "000")
    HTTPS_TEST=$(curl -k -s -o /dev/null -w "%{http_code}" "https://localhost:$PORT" 2>/dev/null || echo "000")
    
    if [ "$HTTP_TEST" = "000" ] && [ "$HTTPS_TEST" = "000" ]; then
        echo "⚠️  ADVERTENCIA: El servidor está corriendo pero no responde"
        echo "   HTTP test: $HTTP_TEST"
        echo "   HTTPS test: $HTTPS_TEST"
        echo ""
        echo "   Esto puede indicar que:"
        echo "   - El servidor está iniciando (espera unos segundos)"
        echo "   - Hay un problema con la configuración del servidor"
        echo ""
        read -p "¿Continuar de todos modos? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
        echo ""
    fi
fi

echo "🔗 Presiona Ctrl+C para detener el túnel"
echo ""

# Verificar que SSH esté disponible
if ! command -v ssh &> /dev/null; then
    echo "❌ SSH no está instalado."
    echo ""
    echo "Instalación:"
    echo "  Ubuntu/Debian: sudo apt install openssh-client"
    echo "  macOS: Ya viene instalado"
    echo ""
    exit 1
fi

# Crear túnel
echo "🚇 Conectando a localhost.run..."
echo ""
echo "💡 Tip: Para dominios más estables, configura tu clave SSH:"
echo "   yarn setup:ssh"
echo "   Luego agrega tu clave en https://admin.localhost.run"
echo ""

# Crear archivo temporal para capturar la URL
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

# Función para extraer y mostrar URL
show_url() {
    local url="$1"
    if [ -n "$url" ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "✅ Túnel creado exitosamente!"
        echo ""
        echo "📱 URL HTTPS pública:"
        echo ""
        echo "   🔗 $url"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "🌍 Esta URL es accesible desde cualquier dispositivo con internet"
        echo "   No necesitas estar en la misma red WiFi"
        echo ""
        echo "📲 Para instalar la PWA en tu móvil:"
        echo "   1. Abre esta URL en el navegador móvil:"
        echo "      $url"
        echo "   2. El certificado será válido automáticamente"
        echo "   3. Instala la PWA desde el menú del navegador"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
    fi
}

# Verificar si el servidor está accesible y qué protocolo usa
echo "🔍 Verificando servidor local..."
HTTP_CODE_HTTPS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://localhost:$PORT" 2>/dev/null || echo "000")
HTTP_CODE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null || echo "000")

# Determinar si usamos túnel gratuito (nokey) o con clave SSH
IS_FREE_TUNNEL=false
if [ "$USE_NOKEY" = "true" ] || [ "$USE_NOKEY" = "nokey" ]; then
    IS_FREE_TUNNEL=true
fi

# IMPORTANTE: Los túneles gratuitos solo soportan HTTP (puerto 80)
# localhost.run redirige automáticamente HTTP a HTTPS, así que siempre usamos puerto 80
if [ "$IS_FREE_TUNNEL" = true ]; then
    echo "✅ Túnel gratuito detectado"
    echo "   Usando túnel HTTP (puerto 80) - El plan gratuito solo soporta HTTP"
    echo "   Nota: localhost.run redirige automáticamente HTTP a HTTPS"
    echo ""
    
    # Verificar si el servidor local solo acepta HTTPS
    if echo "$HTTP_CODE_HTTP" | grep -qE "000|52"; then
        if echo "$HTTP_CODE_HTTPS" | grep -qE "200|301|302|404"; then
            echo "⚠️  ADVERTENCIA: Tu servidor local solo acepta HTTPS"
            echo "   El túnel gratuito requiere que el servidor acepte HTTP"
            echo ""
            echo "   Soluciones:"
            echo "   1. Usa 'yarn dev' (HTTP) en lugar de 'yarn dev:https' (HTTPS)"
            echo "   2. O usa un túnel con clave SSH para soportar HTTPS (requiere plan de pago)"
            echo ""
            echo "   El túnel intentará funcionar, pero puede no responder correctamente."
            echo ""
        fi
    fi
    
    TUNNEL_PORT=80
elif echo "$HTTP_CODE_HTTPS" | grep -qE "200|301|302|404"; then
    echo "✅ Servidor HTTPS detectado (código: $HTTP_CODE_HTTPS)"
    echo "   Usando túnel con TLS passthrough (puerto 443)..."
    echo "   Nota: Requiere plan de pago para TLS passthrough"
    echo ""
    TUNNEL_PORT=443
elif echo "$HTTP_CODE_HTTP" | grep -qE "200|301|302|404"; then
    echo "✅ Servidor HTTP detectado (código: $HTTP_CODE_HTTP)"
    echo "   Usando túnel HTTP estándar (puerto 80)..."
    echo "   Nota: localhost.run redirige automáticamente HTTP a HTTPS"
    echo ""
    TUNNEL_PORT=80
else
    echo "⚠️  No se pudo verificar el servidor local"
    echo "   HTTP code HTTPS: $HTTP_CODE_HTTPS"
    echo "   HTTP code HTTP: $HTTP_CODE_HTTP"
    echo ""
    echo "   Asegúrate de que el servidor esté corriendo:"
    echo "   - yarn dev (para HTTP)"
    echo "   - yarn dev:https (para HTTPS)"
    echo ""
    echo "   Usando HTTP por defecto (puerto 80)..."
    echo ""
    TUNNEL_PORT=80
fi

# Variable para rastrear si ya mostramos la URL
URL_SHOWN=false
LINE_COUNT=0

# Determinar el usuario SSH
if [ "$USE_NOKEY" = "true" ] || [ "$USE_NOKEY" = "nokey" ]; then
    SSH_USER="nokey"
    echo "ℹ️  Usando túnel gratuito sin clave SSH (nokey@localhost.run)"
    echo "   Nota: El dominio cambiará cada vez que reconectes"
    echo ""
else
    SSH_USER=""
    echo "ℹ️  Usando autenticación con clave SSH (si está configurada)"
    echo "   Para usar túnel gratuito sin clave: yarn tunnel 5173 nokey"
    echo ""
fi

# Opciones SSH para mantener la conexión estable (keepalives)
SSH_OPTS="-o ServerAliveInterval=60 -o ServerAliveCountMax=3"

# Verificar si autossh está disponible (para auto-healing)
if command -v autossh &> /dev/null; then
    echo "✅ autossh detectado - Usando auto-healing para mantener el túnel activo"
    echo ""
    SSH_CMD="autossh -M 0 $SSH_OPTS"
else
    SSH_CMD="ssh $SSH_OPTS"
    echo "💡 Tip: Instala 'autossh' para auto-healing automático:"
    echo "   Ubuntu/Debian: sudo apt install autossh"
    echo "   macOS: brew install autossh"
    echo ""
fi

# Construir el comando SSH completo
if [ -n "$SSH_USER" ]; then
    SSH_TARGET="${SSH_USER}@localhost.run"
else
    SSH_TARGET="localhost.run"
fi

# Función para procesar líneas en tiempo real
process_line() {
    local line="$1"
    
    # Mostrar todas las líneas que contengan información relevante (incluyendo URLs)
    if echo "$line" | grep -qE '(Welcome|authenticated|tunneled|https://|connection id|QR)'; then
        echo "$line"
    fi
    
    # Buscar URL real del túnel en diferentes formatos posibles
    # Formato 1: https://algo.lhr.life o https://algo.localhost.run (en la misma línea)
    # Formato 2: Puede estar en una línea separada después de "tunneled"
    # Formato 3: "tunneled with tls termination, https://..."
    # Formato 4: "algo.lhr.life tunneled with tls termination, https://..."
    if echo "$line" | grep -qE '(https://[a-zA-Z0-9-]+\.(lhr\.life|localhost\.run)|tunneled with tls|[a-zA-Z0-9-]+\.lhr\.life.*tunneled)'; then
        # Extraer todas las URLs y filtrar las incorrectas
        URL=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9-]+\.(lhr\.life|localhost\.run)' | \
            grep -vE '(admin|docs|www|twitter)\.localhost\.run' | \
            grep -vE 'localhost\.run/docs' | \
            grep -vE 'localhost\.run/custom' | \
            head -1)
        
        # Si no se encuentra con https://, buscar el dominio antes de "tunneled"
        if [ -z "$URL" ] && echo "$line" | grep -qE '[a-zA-Z0-9-]+\.lhr\.life.*tunneled'; then
            POTENTIAL_DOMAIN=$(echo "$line" | grep -oE '[a-zA-Z0-9-]+\.lhr\.life' | head -1)
            if [ -n "$POTENTIAL_DOMAIN" ]; then
                URL="https://$POTENTIAL_DOMAIN"
            fi
        fi
        
        if [ -n "$URL" ] && [ "$URL_SHOWN" = false ]; then
            URL_SHOWN=true
            show_url "$URL"
        fi
    fi
    
    # También buscar patrones alternativos que localhost.run puede usar
    # A veces la URL aparece sin el prefijo https:// o en formato diferente
    if echo "$line" | grep -qE '[a-zA-Z0-9-]+\.(lhr\.life|localhost\.run)([^a-zA-Z]|$)'; then
        POTENTIAL_URL=$(echo "$line" | grep -oE '[a-zA-Z0-9-]+\.(lhr\.life|localhost\.run)' | \
            grep -vE '(admin|docs|www|twitter)\.localhost\.run' | \
            grep -vE 'localhost\.run/docs' | \
            grep -vE 'localhost\.run/custom' | \
            head -1)
        
        if [ -n "$POTENTIAL_URL" ] && [ "$URL_SHOWN" = false ] && [ -n "$POTENTIAL_URL" ]; then
            # Agregar https:// si no lo tiene
            if [[ ! "$POTENTIAL_URL" =~ ^https:// ]]; then
                POTENTIAL_URL="https://$POTENTIAL_URL"
            fi
            URL_SHOWN=true
            show_url "$POTENTIAL_URL"
        fi
    fi
}

# Crear túnel y procesar salida en tiempo real
# Usar stdbuf si está disponible para desactivar buffering y ver la salida inmediatamente
if command -v stdbuf &> /dev/null; then
    SSH_PIPE="stdbuf -oL -eL $SSH_CMD -R ${TUNNEL_PORT}:localhost:$PORT $SSH_TARGET 2>&1 | stdbuf -oL -eL tee \"$TEMP_FILE\""
else
    SSH_PIPE="$SSH_CMD -R ${TUNNEL_PORT}:localhost:$PORT $SSH_TARGET 2>&1 | tee \"$TEMP_FILE\""
fi

eval "$SSH_PIPE" | while IFS= read -r line || [ -n "$line" ]; do
    # Mostrar TODAS las líneas para debugging (comentar después si es necesario)
    echo "$line"
    
    process_line "$line"
    
    # También buscar en el archivo acumulado periódicamente (cada 2 líneas para respuesta más rápida)
    LINE_COUNT=$((LINE_COUNT + 1))
    if [ $((LINE_COUNT % 2)) -eq 0 ] && [ "$URL_SHOWN" = false ]; then
        # Buscar en el archivo completo (más exhaustivo)
        FINAL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.(lhr\.life|localhost\.run)' "$TEMP_FILE" 2>/dev/null | \
            grep -vE '(admin|docs|www|twitter)\.localhost\.run' | \
            grep -vE 'localhost\.run/docs' | \
            grep -vE 'localhost\.run/custom' | \
            head -1)
        
        # Si no se encuentra con https://, buscar sin prefijo
        if [ -z "$FINAL_URL" ]; then
            POTENTIAL=$(grep -oE '[a-zA-Z0-9-]+\.(lhr\.life|localhost\.run)' "$TEMP_FILE" 2>/dev/null | \
                grep -vE '(admin|docs|www|twitter)\.localhost\.run' | \
                grep -vE 'localhost\.run/docs' | \
                grep -vE 'localhost\.run/custom' | \
                head -1)
            if [ -n "$POTENTIAL" ]; then
                FINAL_URL="https://$POTENTIAL"
            fi
        fi
        
        if [ -n "$FINAL_URL" ]; then
            URL_SHOWN=true
            show_url "$FINAL_URL"
        fi
    fi
done

# Si aún no se encontró la URL, buscar una última vez en el archivo completo
if [ "$URL_SHOWN" = false ]; then
    # Buscar con https://
    FINAL_URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.(lhr\.life|localhost\.run)' "$TEMP_FILE" 2>/dev/null | \
        grep -vE '(admin|docs|www|twitter)\.localhost\.run' | \
        grep -vE 'localhost\.run/docs' | \
        grep -vE 'localhost\.run/custom' | \
        head -1)
    
    # Si no se encuentra, buscar sin prefijo
    if [ -z "$FINAL_URL" ]; then
        POTENTIAL=$(grep -oE '[a-zA-Z0-9-]+\.(lhr\.life|localhost\.run)' "$TEMP_FILE" 2>/dev/null | \
            grep -vE '(admin|docs|www|twitter)\.localhost\.run' | \
            grep -vE 'localhost\.run/docs' | \
            grep -vE 'localhost\.run/custom' | \
            head -1)
        if [ -n "$POTENTIAL" ]; then
            FINAL_URL="https://$POTENTIAL"
        fi
    fi
    
    if [ -n "$FINAL_URL" ]; then
        show_url "$FINAL_URL"
    else
        echo ""
        echo "⚠️  No se pudo extraer la URL del túnel automáticamente"
        echo ""
        echo "📋 Busca manualmente en la salida una línea que contenga:"
        echo "   https://algo.lhr.life"
        echo "   O"
        echo "   https://algo.localhost.run"
        echo ""
        echo "   (NO debe ser admin.localhost.run ni docs.localhost.run)"
        echo ""
        echo "💡 Tip: La URL real del túnel suele aparecer después de 'tunneled with tls'"
        echo ""
        echo "🔍 Últimas líneas capturadas del túnel:"
        tail -30 "$TEMP_FILE" 2>/dev/null | grep -E '(https://|tunneled|\.lhr\.life|\.localhost\.run|connection id)' || echo "   (sin líneas relevantes)"
        echo ""
        echo "📝 Diagnóstico:"
        echo "   1. Verifica que el servidor local esté corriendo:"
        echo "      curl http://localhost:$PORT"
        echo "   2. Verifica que el servidor escuche en 0.0.0.0 (no solo localhost):"
        echo "      lsof -i :$PORT | grep LISTEN"
        echo "      Debe mostrar 0.0.0.0:$PORT, no 127.0.0.1:$PORT"
        echo "   3. El doble NAT NO debería afectar (la conexión SSH es saliente)"
        echo "   4. Si el túnel se crea pero no funciona, verifica:"
        echo "      - El servidor está corriendo y accesible en localhost:$PORT"
        echo "      - El servidor escucha en 0.0.0.0 (vite.config.ts: host: '0.0.0.0')"
        echo "      - No hay firewall bloqueando el puerto $PORT"
        echo ""
    fi
fi

