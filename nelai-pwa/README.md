# CriterIA · PWA + servidor Express

Aplicación principal de CriterIA: una **PWA** (Vite 7 + React 18) servida en el
mismo proceso Node que actúa como **API**, **proxy LLM** y **reverse-proxy** a
Etherpad. Pensada para producir **documentos legales y académicos
verificables** con asistencia de un agente y firma criptográfica.

> El agente y la UI operan principalmente en **español**.

---

## Capacidades del producto

- **Editor colaborativo** (Etherpad) embebido *same-origin* vía reverse-proxy
  del backend. Sesiones, cursores, presencia, export PDF/DOCX/ODT con
  LibreOffice.
- **Agente LLM** (Gemini): proxyado en backend para ocultar la API key,
  flujo *propose → review → apply* sobre el pad, y profiles configurables.
- **PII por patrones**: redacciones reversibles (CURP, RFC, emails, montos,
  etc.) antes de enviar contenido al LLM. Ver `src/services/privacy/`.
- **Documentos no-repudiables**: firma C2PA (PDF) en el server + firma
  Substrate/Polkadot (sr25519/ed25519) en el cliente.
- **B2B y B2C**: `OrganizationKind` (`team` vs `personal`) con cuotas de
  tokens por plan; cada organización tiene su periodo de facturación.
- **Stripe Billing**: checkout, webhook, customer portal y catálogo de planes
  expuesto vía `/api/billing/plans`.
- **Auth**: email/password con verificación por correo (MailerSend), Google
  OAuth, sesiones JWT en BD, panel `superadmin` para multi-tenant.
- **PWA offline-first**: service worker con precache de UI y tutoriales.

---

## Stack

| Capa | Tecnologías |
| --- | --- |
| Frontend | Vite 7, React 18, TypeScript, Tailwind 4, Radix UI / shadcn, vite-plugin-pwa |
| Editor | Etherpad 2.7 (servicio Docker aparte) + Quill (vistas no colaborativas) |
| Backend | Express 5, Prisma 7, PostgreSQL, http-proxy-middleware, bcryptjs |
| LLM | Google Gemini (vía proxy server) |
| C2PA | `@contentauth/c2pa-node`, certificados X.509 |
| Cripto cliente | `@polkadot/util-crypto`, `@polkadot/keyring`, `dedot` |
| Billing | Stripe (subs, webhooks, portal) |
| Email | MailerSend (transaccional + welcome) |

---

## Estructura del paquete

```
nelai-pwa/
├── README.md                ← este archivo
├── RAILWAY_DEPLOY.md        ← guía operativa de despliegue en Railway
├── Dockerfile               ← imagen de criteria-api (PWA + server + proxy)
├── railway.json             ← builder Dockerfile + healthcheck
├── docker-compose.yml       ← Postgres + Etherpad para dev local
├── etherpad/                ← imagen Docker custom de Etherpad (entrypoint propio)
├── prisma/                  ← schema y migraciones
├── server/                  ← Express (auth, billing, agente LLM, C2PA, proxy)
├── src/                     ← React PWA
├── docs/                    ← documentación técnica del producto
├── scripts/                 ← seed superadmin, mailersend test, tunnel HTTPS, etc.
└── .env.example             ← variables (anotadas por bloques: auth, Stripe, etc.)
```

---

## Arrancar en local

### Requisitos

- Node ≥ 20.19 (recomendado 22.x; el repo trae `.nvmrc`).
- Docker + Docker Compose (para Postgres y Etherpad locales).
- Yarn 4 berry vía `corepack` (lo activa Node 22).

### Pasos

```bash
nvm use && corepack enable
yarn install

cp .env.example .env       # ajusta DATABASE_URL, GEMINI_API_KEY, etc.
yarn docker:db:up          # levanta Postgres principal + Etherpad + Postgres-Etherpad
yarn prisma:generate
yarn prisma:migrate        # aplica migraciones en BD local
yarn dev:saas:all          # Vite (5173) + API Express (3456) en paralelo
```

Variables principales (todas documentadas en `.env.example`):

- `DATABASE_URL` — PostgreSQL principal.
- `ETHERPAD_BASE_URL`, `ETHERPAD_PUBLIC_URL`, `ETHERPAD_API_KEY` — embed.
- `GEMINI_API_KEY` o `CRITERIA_PLATFORM_LLM_SECRET` — agente LLM.
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_*`, `STRIPE_WEBHOOK_SECRET` — billing.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` — OAuth.
- `MAILERSEND_API_TOKEN`, `MAILERSEND_FROM_EMAIL` — correos transaccionales.

### Scripts útiles

```bash
yarn dev                  # solo Vite (modo wallet, sin SaaS)
yarn dev:saas             # solo Vite, modo SaaS (login antes del editor)
yarn dev:saas:all         # Vite + servidor Express en paralelo
yarn c2pa-server          # solo el backend (Express + C2PA + proxy)
yarn build                # build PWA producción (a dist/)
yarn typecheck:server     # TypeScript del backend
yarn db:seed:superadmin   # crea superadmin con NELAI_SUPERADMIN_*
yarn mailersend:test      # smoke test de MailerSend
```

---

## Backend en breve

`server/c2pa-sign.ts` es el punto de entrada del proceso Express. Monta:

- `/api/auth/*` — registro, login, verificación email, Google OAuth.
- `/api/billing/*` — checkout, webhook, portal, catálogo de planes.
- `/api/usage/*` — consulta de tokens consumidos por organización.
- `/api/c2pa-sign`, `/api/c2pa-health` — firma C2PA en PDFs.
- `/api/llm-proxy` — proxy Gemini (server-side key).
- `/api/docs/*` — sesiones de Etherpad, lectura del pad, agente *run/apply*.
- `/api/platform/*` — endpoints superadmin (multi-tenant).
- `/pad`, `/socket.io`, `/p`, `/ep`, `/static`, `/locales`, `/pluginfw`,
  `/jserror` — reverse-proxy a Etherpad si `ETHERPAD_INTERNAL_URL` está
  definido (ver `server/etherpad/proxy.ts`).
- `dist/` (PWA construida) y fallback SPA al final.

Detalle completo y ejemplos en [`server/README.md`](server/README.md).

---

## Despliegue

Para producción usamos Railway: 4 servicios en un proyecto (API, Etherpad y dos
Postgres managed). Guía paso a paso en
[`RAILWAY_DEPLOY.md`](RAILWAY_DEPLOY.md), incluida configuración de Stripe,
Google OAuth y MailerSend.

---

## Documentación adicional

- [`docs/`](docs/) — contiene decisiones de diseño y guías técnicas:
  flujo de keyring, PII en LLM, sanitización de contratos, plan de edición y
  firma de documentos, estructura de IndexedDB, etc.
- [`docs/tutoriales/`](docs/tutoriales/) — tutoriales que se importan como
  contenido en la PWA (visibles en `/help`).
- [`server/README.md`](server/README.md) — endpoints, Stripe, Etherpad,
  MailerSend y certificados C2PA.

---

## Licencia

Distribuido bajo **FSL-1.1-MIT** (Functional Source License con MIT future).
Permitido sin más: uso personal, educativo y de investigación. **Prohibido**
ofrecerlo como servicio comercial competitivo. A los **dos años** de cada
release, esa versión queda automáticamente bajo MIT.

Texto íntegro en [`LICENSE`](../LICENSE).
