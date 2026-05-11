# syntax=docker/dockerfile:1.7

# CriterIA — imagen única para Express + PWA + reverse-proxy a Etherpad.
# Multi-stage:
#   1) deps    — instala dependencias con yarn berry (cacheable)
#   2) build   — corre prisma generate + tsc + vite build
#   3) runtime — Node bookworm-slim con dist/, server/, prisma/, node_modules/
#
# Se usa Debian bookworm (no Alpine) porque @contentauth/c2pa-node y bcryptjs
# enlazan mejor con glibc; con musl hay que recompilar binarios nativos.

ARG NODE_VERSION=22.20.0

############################
# Stage 1: dependencias
############################
FROM node:${NODE_VERSION}-bookworm AS deps
WORKDIR /app

ENV CI=true \
    YARN_ENABLE_TELEMETRY=0

# Toolchain mínimo por si algún módulo nativo necesita compilar.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

# Contexto de build = raíz del monorepo (Railway envía el repo completo cuando
# Root Directory está vacío; en local: `docker build -f nelai-pwa/Dockerfile .`).
# Copiamos solo el manifiesto de dependencias para que `yarn install` sea cacheable.
COPY nelai-pwa/package.json nelai-pwa/yarn.lock nelai-pwa/.yarnrc.yml ./
COPY nelai-pwa/.yarn/patches ./.yarn/patches

# Sin `--mount=type=cache`: Railway exige un prefijo `cacheKey` específico
# del builder en el id del mount, incompatible con un Dockerfile portable.
# Se acepta el coste extra de descargar el cache de yarn cada build.
RUN yarn install --immutable

############################
# Stage 2: build
############################
FROM node:${NODE_VERSION}-bookworm AS build
WORKDIR /app

ENV NODE_ENV=production \
    CI=true \
    YARN_ENABLE_TELEMETRY=0

RUN corepack enable

# Reusar dependencias del stage anterior.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarn ./.yarn

# Código fuente del paquete (solo nelai-pwa/, no el resto del monorepo).
COPY nelai-pwa/ ./

# `prisma.config.ts` exige `DATABASE_URL` al cargar el módulo; `prisma generate` no abre
# conexión real. En Docker build (p. ej. Railway) esa variable no existe aún: placeholder.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/_prisma_generate_only?schema=public"

# Generar cliente Prisma antes de compilar (los imports de @prisma/client lo necesitan).
RUN npx prisma generate

# Build de la PWA. Forzamos `VITE_BASE_URL=/` para que los assets cuelguen de la raíz
# (Railway sirve un único dominio para PWA + API). Las flags de "same-origin" hacen
# que el cliente apunte a sus propios endpoints sin variables runtime.
# `VITE_APP_MODE=saas` es build-time (Vite); sin esto la PWA compilada sería modo wallet.
ENV VITE_BASE_URL=/ \
    VITE_API_USE_SAME_ORIGIN=true \
    VITE_LLM_PROXY_USES_SERVER_KEY=true \
    VITE_APP_MODE=saas
RUN yarn build

############################
# Stage 3: runtime
############################
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3456

# Dependencias runtime mínimas: openssl es requerido por Prisma engines.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        openssl \
        tini \
    && rm -rf /var/lib/apt/lists/*

# tsx ya viene en node_modules; no es necesario instalarlo global. Sí necesitamos
# que `node` y `npx` estén disponibles (vienen en la imagen base).

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/prisma ./prisma
# Prisma 7: la URL del datasource vive en prisma.config.ts (no en schema.prisma).
# Sin este archivo, `migrate deploy` en runtime falla con "datasource.url property is required".
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json

# Crear usuario sin privilegios; los certs ya viven dentro de server/certs.
RUN useradd --system --create-home --shell /usr/sbin/nologin app \
    && chown -R app:app /app
USER app

EXPOSE 3456

# Healthcheck básico (Railway tiene su propio healthcheck via railway.json,
# este es para corridas locales del contenedor).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||3456) +'/api/c2pa-health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Tini como init para reapear procesos hijos (tsx spawnea workers).
ENTRYPOINT ["/usr/bin/tini", "--"]

# `prisma migrate deploy` aplica migraciones pendientes; idempotente.
CMD ["sh", "-c", "npx prisma migrate deploy && exec npx tsx server/c2pa-sign.ts"]
