#!/bin/sh
# CriterIA — entrypoint para el contenedor de Etherpad.
#
# Si la variable `ETHERPAD_API_KEY` está presente, la materializamos en el
# archivo `APIKEY.txt` que Etherpad usa para autenticar las llamadas al
# `Etherpad HTTP API`. Esto evita commitear el archivo al repo y permite
# rotar la key vía variables de entorno (Railway, k8s secret, etc.).
#
# Si la variable no está, asumimos que el operador ya proveyó el archivo
# (montado como volumen / inyectado por la plataforma) y dejamos que
# Etherpad arranque con el comportamiento por defecto (lo autogenera la
# primera vez si está ausente — solo recomendable en entornos efímeros).

set -e

API_KEY_FILE="/opt/etherpad-lite/APIKEY.txt"

if [ -n "${ETHERPAD_API_KEY:-}" ]; then
  # En dev, docker-compose puede montar APIKEY.txt como read-only; si no podemos
  # escribir, no abortamos (set -e) — caemos a usar el valor montado.
  if printf '%s' "${ETHERPAD_API_KEY}" > "${API_KEY_FILE}" 2>/dev/null; then
    chmod 600 "${API_KEY_FILE}" 2>/dev/null || true
    echo "[CriterIA-Etherpad] APIKEY.txt escrito desde ETHERPAD_API_KEY (longitud=${#ETHERPAD_API_KEY})"
  else
    echo "[CriterIA-Etherpad] WARN: ETHERPAD_API_KEY definida pero APIKEY.txt no es escribible (¿montado :ro?); usando el archivo existente"
  fi
else
  if [ -s "${API_KEY_FILE}" ]; then
    echo "[CriterIA-Etherpad] ETHERPAD_API_KEY no definida; usando APIKEY.txt existente"
  else
    echo "[CriterIA-Etherpad] WARN: ETHERPAD_API_KEY no definida y APIKEY.txt vacío; Etherpad generará una al arrancar"
  fi
fi

exec "$@"
