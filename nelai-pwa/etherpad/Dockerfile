FROM etherpad/etherpad:3.1.0

# Plugins a instalar en build (separados por espacios).
ARG ETHERPAD_PLUGINS="ep_tables5"

# Habilita export/import avanzado (PDF/DOCX/ODT) instalando LibreOffice.
# Nota: incrementa el tamaño de la imagen (esperado en dev).
USER root
RUN apk add --no-cache \
  libreoffice \
  fontconfig \
  ttf-dejavu \
  ttf-liberation \
  font-noto

# Customizaciones mínimas de UI para embed (iframe):
# - Ocultar el botón "Home" para evitar navegación al home de la webapp.
RUN mkdir -p /opt/etherpad-lite/src/static/custom

# Contexto de build: raíz del repositorio (Railway suele enviar el repo completo).
# Desde `nelai-pwa/` en local: ver docker-compose (context: ..).
COPY nelai-pwa/etherpad/custom/pad.css /opt/etherpad-lite/src/static/custom/pad.css

# Entrypoint: materializa APIKEY.txt desde la variable ETHERPAD_API_KEY al arrancar.
# Permite rotar la key sin reconstruir la imagen ni commitear secretos.
COPY nelai-pwa/etherpad/entrypoint.sh /usr/local/bin/criteria-etherpad-entrypoint.sh
RUN chmod +x /usr/local/bin/criteria-etherpad-entrypoint.sh \
  && touch /opt/etherpad-lite/APIKEY.txt \
  && chown etherpad:etherpad /opt/etherpad-lite/APIKEY.txt

# Etherpad espera el binario en /usr/bin/soffice cuando se configura SOFFICE.
USER etherpad

# Instalar plugins en build (para no depender de instalación en runtime).
RUN if [ -n "$ETHERPAD_PLUGINS" ]; then \
    cd /opt/etherpad-lite && pnpm run plugins install $ETHERPAD_PLUGINS; \
  fi

# Mantenemos el CMD original de la imagen base (`pnpm run prod`) y solo
# anteponemos nuestro entrypoint para sembrar APIKEY.txt antes del start.
ENTRYPOINT ["/usr/local/bin/criteria-etherpad-entrypoint.sh"]
CMD ["pnpm", "run", "prod"]

