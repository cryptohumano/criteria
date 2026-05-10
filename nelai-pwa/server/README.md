# Servidor CriterIA (C2PA + proxy LLM + auth B2B demo)

Este proceso de Node expone **C2PA** en PDFs, un **proxy de Gemini** (CORS) y **auth B2B** (memoria si no hay `DATABASE_URL`, o **PostgreSQL + Prisma ORM 7.8** si está configurada). En producción: JWT firmados, Stripe, etc.

## Requisitos

- **Node.js ≥ 20.19** (recomendado: **22.x**), por [Prisma ORM 7](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7) y Vite 7. En el repo hay `.nvmrc` (22.14.0):

  ```bash
  nvm install
  nvm use
  ```

- **PostgreSQL** si usas `DATABASE_URL` (auth B2B con Prisma). Sin `DATABASE_URL`, el auth sigue en memoria solo para pruebas locales.
- Certificados de prueba en `server/certs/` (ver abajo)

### Prisma (PostgreSQL)

1. Define `DATABASE_URL` en `.env` en la raíz del proyecto (ver `.env.example`).
2. Genera el cliente (obligatorio tras instalar dependencias o cambiar el schema):

   ```bash
   yarn prisma:generate
   ```

3. Crea tablas (primera vez o tras cambios de modelo):

   ```bash
   yarn prisma:migrate
   ```

Guía oficial: [Quickstart PostgreSQL](https://www.prisma.io/docs/prisma-orm/quickstart/postgresql).

## Uso

```bash
# En una terminal, iniciar el servidor
yarn c2pa-server
```

El servidor escucha en `http://localhost:3456` por defecto. Para cambiar el puerto:

```bash
C2PA_PORT=4000 yarn c2pa-server
```

## Certificados de prueba

Los certificados están en `server/certs/`:

- `es256.pem` - Clave privada (desarrollo)
- `es256.pub` - Cadena de certificados

Se obtienen del repositorio [c2pa-rs](https://github.com/contentauth/c2pa-rs/tree/main/sdk/tests/fixtures/certs).

**Importante:** Estos certificados son solo para desarrollo. En producción debes usar certificados X.509 válidos según el [modelo de confianza C2PA](https://opensource.contentauthenticity.org/docs/signing/get-cert).

## API

### POST /api/c2pa-sign

Embebe un manifiesto C2PA en un PDF.

**Body:**
```json
{
  "pdfBase64": "base64-del-pdf",
  "metadata": {
    "contentHash": "0x...",
    "author": "5GrwvaEF...",
    "signature": "0x...",
    "createdAt": "2025-03-04T...",
    "title": "Mi documento",
    "documentId": "uuid",
    "claimGenerator": "CriterIA"
  }
}
```

**Respuesta:**
```json
{
  "pdfBase64": "base64-del-pdf-con-manifiesto",
  "success": true
}
```

### GET /api/c2pa-health

Comprueba si el servicio está disponible y los certificados cargados.

### POST /api/llm-proxy

**Proxy para Gemini API** — evita CORS y mantiene la API key del lado servidor.

**Modo clásico (clave en el cliente):** body con `apiKey`, `model`, `body` (payload de `generateContent`).

**Modo SaaS (clave solo en servidor):** define `GEMINI_API_KEY` en el entorno del servidor. La PWA envía cabecera `Authorization: Bearer <token>` y body con `useServerKey: true`, `model` y `body` (sin `apiKey`). El token debe provenir de `POST /api/auth/login` o `register` (demo en memoria).

Variables de entorno del servidor:

- `GEMINI_API_KEY` — opcional; habilita el modo anterior sin exponer la clave al navegador.
- `C2PA_PORT` — puerto (por defecto 3456).

En la PWA (Vite): `VITE_API_BASE_URL`, `VITE_APP_MODE=saas`, `VITE_LLM_PROXY_USES_SERVER_KEY=true` (ver `.env.example` en la raíz del proyecto).

### POST /api/auth/register | POST /api/auth/login | GET /api/auth/me

Con **Prisma + PostgreSQL**: registro e inicio devuelven `accessToken`, `user` y `organization` cuando la sesión se crea al momento. Si MailerSend está configurado (`MAILERSEND_*`), el registro con **contraseña** queda pendiente: respuesta **201** con `{ "pendingVerification": true, "email": "..." }` y se envía un **enlace mágico** (`GET /api/auth/verify-email?token=...`) que redirige a la PWA con sesión.

- `POST /api/auth/resend-verification` — body `{ "email" }`; respuesta siempre `{ "ok": true }` si el correo existe y está sin verificar (anti-enumeración). Límites por IP y por correo (cooldown entre envíos).
- `POST /api/auth/delete-account` — Bearer obligatorio; body opcional `{ "password" }` (requerido si la cuenta tiene contraseña). Elimina usuario y organización solo si es el único miembro del tenant. Cuenta la misma ventana de rate limit que login/registro.
- Variables: `AUTH_API_PUBLIC_URL` (base del API en enlaces del correo), `AUTH_FRONTEND_ORIGIN` (redirección tras verificar), `AUTH_REQUIRE_EMAIL_VERIFICATION=false` para desactivar el flujo aunque exista MailerSend.
- Con `MAILERSEND_*` configurado, tras cuenta activa se intenta un **correo de bienvenida** (resumen del plan). Logs: `[welcome-email] …`. Desactivar: `AUTH_WELCOME_EMAIL_DISABLED=true`.

Sin base de datos, el proceso sigue usando **usuarios en memoria** (demo; se pierden al reiniciar).

### Etherpad (editor colaborativo)

Rutas bajo `/api/docs` (Bearer obligatorio): creación de URL para embed, lectura de texto del pad y `agent/run` + `agent/apply`. Variables: `ETHERPAD_BASE_URL`, `ETHERPAD_PUBLIC_URL`, `ETHERPAD_API_KEY` (ver `.env.example`).

En **producción** (Railway u otro hosting) la PWA y el API son el mismo origen, así que el navegador no debe ver el dominio interno de Etherpad. El backend monta un **reverse-proxy** sobre `/pad`, `/socket.io`, `/p`, `/ep`, `/static`, `/locales`, `/pluginfw`, `/jserror` cuando `ETHERPAD_INTERNAL_URL` está definida (ver `server/etherpad/proxy.ts`). El upgrade a WebSocket se conecta manualmente al `httpServer` para que `socket.io` sincronice los pads.

## Integración con la PWA

La PWA llama al servidor cuando el usuario firma un documento (si está disponible). Si el servidor no está corriendo, la firma funciona igual pero sin manifiesto C2PA embebido.

Scripts útiles en el frontend:

- `yarn dev:saas` — PWA en modo organización (sin backend, login demo local).
- `yarn dev:saas:all` — PWA SaaS + este servidor en paralelo.

Configuración opcional en `.env` del proyecto Vite:

```
VITE_C2PA_API_URL=http://localhost:3456
VITE_API_BASE_URL=http://localhost:3456
VITE_APP_MODE=saas
VITE_LLM_PROXY_USES_SERVER_KEY=true
```

## Stripe (modo test / desarrollo)

Sí: en desarrollo se usa **Stripe Test mode** (claves `sk_test_…`, precios `price_…` de test, tarjetas de prueba). No cobras dinero real hasta pasar a **Live mode** y rotar claves.

### Pasos en el Dashboard (test)

1. Crea una **cuenta Stripe** (o usa la existente) y activa **Viewing test data** (interruptor “Test mode” en el Dashboard).
2. **Products** → crea productos (ej. “CriterIA Starter”, “CriterIA Pro”, “CriterIA Enterprise”) y para cada uno un **Price** recurrente mensual (USD o MXN). Copia cada **Price ID** (`price_…`).
3. En el `.env` del servidor (`nelai-pwa/.env`):  
   `STRIPE_SECRET_KEY=sk_test_…`  
   `STRIPE_PRICE_STARTER=price_…`  
   `STRIPE_PRICE_PRO=price_…`  
   `STRIPE_PRICE_ENTERPRISE=price_…` (opcional)  
   URLs de retorno: `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `STRIPE_PORTAL_RETURN_URL` (absolutas, p. ej. `http://localhost:5173/settings?billing=success`).
4. **Webhooks** → **Add endpoint** → URL pública de tu API: `https://<tu-host>/api/billing/webhook` (en local usa [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3456/api/billing/webhook` y copia el `whsec_…` en `STRIPE_WEBHOOK_SECRET`). Eventos mínimos: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
5. **Customer portal**: Settings → **Billing** → **Customer portal** → activar y guardar (necesario para `POST /api/billing/portal`).
6. Catálogo expuesto sin secretos: `GET http://localhost:3456/api/billing/plans` (la PWA Settings lo consume).

### Tras migrar Prisma (`trial_ends_at`)

Con `DATABASE_URL` configurado: `yarn prisma:migrate` (o `npx prisma migrate deploy` en el entorno que corresponda). Las org nuevas reciben **14 días** de trial (`trialEndsAt`); al completar checkout con plan de pago se limpia `trialEndsAt`.

### Cupos por plan y periodo

La única cuota real del producto son los **tokens LLM** consumidos en el periodo del plan. No hay límite de documentos: cada conversación / pad de Etherpad es gratuita en sí misma; el costo lo lleva la interacción con el agente.

| Plan       | Tokens IA       | Periodo de cupos                   |
|------------|-----------------|------------------------------------|
| trial      | 50 000          | Quincena rodante (15 días)         |
| starter    | 2 000 000       | Mes (Stripe si activo, si no UTC)  |
| pro        | 10 000 000      | Mes (Stripe si activo, si no UTC)  |
| enterprise | sin tope        | Mes (Stripe si activo, si no UTC)  |

Override por env (sufijo según `tokenPeriod` del plan):
`PLAN_TRIAL_LLM_TOKENS_PER_FORTNIGHT`, `PLAN_STARTER_LLM_TOKENS_PER_MONTH`, `PLAN_PRO_LLM_TOKENS_PER_MONTH`, `PLAN_ENTERPRISE_LLM_TOKENS_PER_MONTH`.

### Tokens extra (metered) — fase siguiente

En Stripe: crear un **Price** metered (o **usage record** sobre un subscription item), reportar consumo vía API o Billing Meters; enlazarlo al checkout o al portal como add-on. El código actual cubre suscripción base + cupos en base de datos; el cobro variable por “+2M tokens” se integra cuando definas el Price metered y el reporting.

## Despliegue en Railway

Guía operativa completa: [`../RAILWAY_DEPLOY.md`](../RAILWAY_DEPLOY.md). Resumen:

- Imagen Docker multi-stage en [`../Dockerfile`](../Dockerfile) (base `node:22-bookworm` por compatibilidad con `@contentauth/c2pa-node` y `bcryptjs`).
- `railway.json` apunta el builder a Dockerfile y el healthcheck a `/api/c2pa-health`.
- En producción Railway inyecta `PORT`; el server lo respeta y aplica `app.set('trust proxy', 1)` para que los rate limits y cookies "secure" funcionen detrás del edge proxy.
- Etherpad corre como servicio separado en la red privada de Railway; el reverse-proxy del Express lo expone same-origin sobre `/pad`, `/socket.io`, etc.

## Licencia

El servidor es parte del proyecto CriterIA, distribuido bajo **FSL-1.1-MIT**. Texto íntegro en [`../../LICENSE`](../../LICENSE).
