# CriterIA

Espacio de trabajo R&D para la generación de conocimiento técnico y la
co-creación de **documentos legales y académicos verificables**, asistido por
agentes LLM y firmado con identidad criptográfica (C2PA + Polkadot/Substrate).

> **Idioma del agente:** la UI y las respuestas del agente operan principalmente
> en español.

## Por qué CriterIA

- **Editor colaborativo** (Etherpad) embebido same-origin, con sesiones,
  presencia y export PDF/DOCX/ODT vía LibreOffice.
- **Agente LLM** (Gemini, vía proxy backend que protege la API key) con flujo
  *propose → review → apply* sobre el pad.
- **Documentos no-repudiables**: firma C2PA en el server + firma Substrate en
  el cliente (sr25519/ed25519, identidad Polkadot del usuario).
- **PII por patrones**: redacciones reversibles dentro del pad antes de enviar
  contenido al LLM.
- **B2B y B2C**: organizaciones de equipo o cuentas personales, con cuotas de
  tokens por plan (ver `nelai-pwa/server/billing/planCatalog.ts`).
- **Stripe Billing** integrado (suscripciones, customer portal, webhook).

## Stack

- **Frontend**: Vite 7 + React 18 + TanStack Table + Tailwind 4 + PWA
  (vite-plugin-pwa). Quill embebido para vistas no colaborativas y Etherpad
  para edición colaborativa.
- **Backend** (`nelai-pwa/server`): Express 5 + Prisma 7 + PostgreSQL.
- **Etherpad** (`nelai-pwa/etherpad`): imagen Docker basada en
  `etherpad/etherpad:3.1.0` con LibreOffice y plugins (`ep_tables5`,
  `ep_headings2`, etc.).
- **Cripto**: `@contentauth/c2pa-node` (firma C2PA), `@polkadot/util-crypto`
  (firmas en cliente), `bcryptjs` (passwords).
- **Infra**: Docker + Docker Compose para dev. Railway (Dockerfile multi-stage)
  para producción.

## Estructura

```
.
├── README.md              ← este archivo
├── LICENSE                ← FSL-1.1-MIT
├── docs/                  ← especificaciones técnicas
└── nelai-pwa/             ← aplicación principal
    ├── README.md          ← cómo correr la app y arquitectura
    ├── RAILWAY_DEPLOY.md  ← guía operativa de despliegue en Railway
    ├── Dockerfile         ← imagen del servicio criteria-api
    ├── railway.json       ← builder Dockerfile + healthcheck
    ├── docker-compose.yml ← Postgres + Etherpad para dev local
    ├── etherpad/          ← imagen Docker de Etherpad (entrypoint propio)
    ├── prisma/            ← schema y migraciones
    ├── server/            ← Express (auth, billing, agente LLM, C2PA, proxy Etherpad)
    └── src/               ← React PWA
```

## Arrancar en local

```bash
cd nelai-pwa
nvm use && corepack enable
yarn install
cp .env.example .env        # ajusta DATABASE_URL, GEMINI_API_KEY, etc.
yarn docker:db:up           # Postgres + Etherpad + Postgres-Etherpad
yarn prisma:generate
yarn prisma:migrate
yarn dev:saas:all           # Vite (5173) + API Express (3456) en paralelo
```

Detalle de variables y *flows*: `nelai-pwa/.env.example` y
`nelai-pwa/server/README.md`.

## Desplegar en Railway

Guía paso a paso: [`nelai-pwa/RAILWAY_DEPLOY.md`](nelai-pwa/RAILWAY_DEPLOY.md).

Resumen del topology: 4 servicios en un solo proyecto Railway:

1. `criteria-postgres` (Postgres managed) — datos principales.
2. `etherpad-postgres` (Postgres managed) — solo Etherpad.
3. `etherpad` (Docker, sin dominio público) — editor colaborativo.
4. `criteria-api` (Docker, dominio público) — Express + PWA + reverse-proxy a
   Etherpad. Mismo origen, sin cookies third-party.

## Licencia

Distribuido bajo la **Functional Source License 1.1 con MIT Future License
(FSL-1.1-MIT)**. En resumen:

- **Permitido sin permiso adicional**: uso personal, educativo, de investigación
  y para tu uso interno.
- **Prohibido**: ofrecer el software como servicio comercial competitivo.
- **Apertura diferida**: en dos años desde la publicación de cada versión, esa
  versión queda automáticamente bajo licencia MIT.

El texto íntegro está en [`LICENSE`](LICENSE). Más sobre el modelo en
<https://fsl.software/>.
