# Despliegue de CriterIA en Railway

Guía operativa que continúa donde el plan
[`deploy_criteria_en_railway`](../.cursor/plans/deploy_criteria_en_railway_6a46fd52.plan.md)
termina. Todo el código y los Dockerfiles ya están en el repo; este documento
detalla los pasos manuales en Railway, Stripe, Google Cloud y MailerSend.

> Asumimos un único proyecto Railway con cuatro servicios: `criteria-postgres`
> (managed), `etherpad-postgres` (managed), `etherpad` (Docker), `criteria-api`
> (Docker, único con dominio público).

## 1. Crear el proyecto y los servicios

### 1.1 Postgres principal (`criteria-postgres`)

1. Railway dashboard → **New Project** → nombre `criteria` (o el que prefieras).
2. **Add → Database → PostgreSQL**. Renombra el servicio a `criteria-postgres`.
3. Anota la variable que expone: `DATABASE_URL` (usaremos `${{criteria-postgres.DATABASE_URL}}` como referencia).

### 1.2 Postgres dedicado para Etherpad (`etherpad-postgres`)

1. **Add → Database → PostgreSQL** otra vez. Renombra a `etherpad-postgres`.
2. Anota credenciales (`PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`).
   - Internamente Railway las publica también como `${{etherpad-postgres.PGHOST}}`, etc.

> Mantener Postgres separados aísla el blast radius: si el contenedor Etherpad
> revienta su esquema interno, los datos de CriterIA no se ven afectados.

### 1.3 Servicio `etherpad`

1. **Add → GitHub Repo** apuntando al repo de CriterIA.
2. En **Settings → Source** marca:
   - **Root Directory: vacío** (raíz del repositorio — **no** uses solo
     `nelai-pwa/etherpad`). El `Dockerfile` copia rutas `nelai-pwa/etherpad/…`
     respecto a la raíz del monorepo; si el contexto es solo la subcarpeta,
     falla `COPY` con `entrypoint.sh not found`.
   - **Dockerfile path:** `nelai-pwa/etherpad/Dockerfile` (en la UI de Railway:
     *Settings → Build → Dockerfile path*, o equivalente según la versión del
     dashboard).
   - Alternativa válida: Root Directory `nelai-pwa` y Dockerfile path
     `etherpad/Dockerfile` **solo si** adapatas el Dockerfile a rutas relativas
     a esa carpeta; la configuración recomendada es raíz del repo + rutas fijas
     como arriba.
3. **Networking**: NO añadas dominio público. Habilita "Private Networking"
   (viene activo por defecto). Etherpad solo se llama desde `criteria-api` por
   `${{etherpad.RAILWAY_PRIVATE_DOMAIN}}`.
4. **Volumes**: añade un volumen persistente montado en `/opt/etherpad-lite/var`
   (1–5 GB es suficiente para empezar).
5. **Variables**:

   ```env
   # DB (apunta al Postgres dedicado)
   DB_TYPE=postgres
   DB_HOST=${{etherpad-postgres.PGHOST}}
   DB_PORT=${{etherpad-postgres.PGPORT}}
   DB_USER=${{etherpad-postgres.PGUSER}}
   DB_PASS=${{etherpad-postgres.PGPASSWORD}}
   DB_NAME=${{etherpad-postgres.PGDATABASE}}

   # Comportamiento
   AUTHENTICATION_METHOD=apikey
   TITLE=CriterIA Etherpad
   REQUIRE_SESSION=true
   EDIT_ONLY=true
   SOCKETIO_MAX_HTTP_BUFFER_SIZE=10000000
   SOFFICE=/usr/bin/soffice

   # API key — se materializa en /opt/etherpad-lite/APIKEY.txt vía entrypoint.sh
   # Generala en local con:  openssl rand -hex 32
   ETHERPAD_API_KEY=<string-aleatorio-≥32-bytes-hex>

   # Admin opcional (solo si quieres entrar a /admin)
   # ETHERPAD_ADMIN_PASSWORD=algo
   ```

6. Despliega. Verifica en logs que aparece
   `[CriterIA-Etherpad] APIKEY.txt escrito desde ETHERPAD_API_KEY (longitud=...)`.

### 1.4 Servicio `criteria-api`

1. **Add → GitHub Repo** (el mismo repo).
2. **Settings → Source**:
   - **Root Directory: vacío** (raíz del repo, igual que `etherpad`).
   - **Dockerfile path:** `nelai-pwa/Dockerfile`.
   - El Dockerfile copia rutas con prefijo `nelai-pwa/` desde la raíz del
     monorepo, así que ambos servicios comparten el mismo contexto y
     `.dockerignore` raíz.
3. **Settings → Deploy** (no se leen `railway.json` cuando Root Directory está
   vacío y el archivo vive en `nelai-pwa/railway.json`; configura manualmente):
   - **Custom Start Command:** `npx prisma migrate deploy && npx tsx server/c2pa-sign.ts`
   - **Healthcheck Path:** `/api/c2pa-health`
   - **Healthcheck Timeout:** 30
   - **Restart Policy:** `On failure` con 5 reintentos.
3. **Networking**: genera un dominio público (Railway-managed o custom). Lo
   referenciaremos como `${{RAILWAY_PUBLIC_DOMAIN}}`.
4. **Variables** (ver sección [§2](#2-variables-de-entorno-de-criteria-api)).
5. Despliega.

> El primer deploy ejecuta `npx prisma migrate deploy` antes de arrancar el
> servidor (definido en `CMD` del Dockerfile y replicado en el `startCommand`
> del `railway.json`). Las migraciones de Prisma se aplican idempotentes.

## 2. Variables de entorno de `criteria-api`

### Qué **no** hace falta copiar del servicio Postgres

El plugin PostgreSQL de Railway expone muchas variables (`PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT`, `POSTGRES_*`, `DATABASE_PUBLIC_URL` para el proxy TCP externo, etc.). **En `criteria-api` no las pegues todas**: la app y Prisma en runtime solo usan **`DATABASE_URL`** (cadena completa). Referencia la del servicio de base de datos, por ejemplo:

`DATABASE_URL=${{criteria-postgres.DATABASE_URL}}`

(si el servicio de Postgres se llama distinto en tu proyecto, cambia el prefijo antes del punto). El `Dockerfile` ya define un `DATABASE_URL` ficticio **solo en la fase de build** para que `npx prisma generate` no falle cuando Railway aún no inyecta la URL real.

Mínimas para arrancar:

```env
# === Core ===
NODE_ENV=production
# PORT lo inyecta Railway; no setear.

# === DB principal ===
DATABASE_URL=${{criteria-postgres.DATABASE_URL}}

# === Etherpad (red privada) ===
ETHERPAD_INTERNAL_URL=http://${{etherpad.RAILWAY_PRIVATE_DOMAIN}}:9001
# El API usa ETHERPAD_INTERNAL_URL si falta ETHERPAD_BASE_URL (misma URL en Railway).
ETHERPAD_PUBLIC_URL=/pad
ETHERPAD_API_KEY=<MISMO valor que el servicio etherpad>

# === Autenticación / origen público ===
AUTH_API_PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
AUTH_FRONTEND_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}

# === LLM ===
# Opción A: clave global de servidor
GEMINI_API_KEY=AIza...
# Opción B (o adicional): permitir guardar claves cifradas en BD
CRITERIA_PLATFORM_LLM_SECRET=<≥16 caracteres aleatorios; ≥32 recomendado>

# === Stripe (test al principio) ===
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...           # se llena tras crear el webhook (§3)
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...         # opcional
STRIPE_SUCCESS_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/settings?billing=success
STRIPE_CANCEL_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/settings?billing=cancel
STRIPE_PORTAL_RETURN_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}/settings

# === Google OAuth ===
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://${{RAILWAY_PUBLIC_DOMAIN}}/api/auth/google/callback

# === MailerSend ===
MAILERSEND_API_TOKEN=mlsn....
MAILERSEND_FROM_EMAIL=noreply@<tu-subdominio>.mlsender.net   # o tu dominio verificado
MAILERSEND_FROM_NAME=CriterIA

# === Cuotas (opcional; si no, usa defaults de planCatalog) ===
# PLAN_TRIAL_LLM_TOKENS_PER_FORTNIGHT=50000
# PLAN_STARTER_LLM_TOKENS_PER_MONTH=2000000
# PLAN_PRO_LLM_TOKENS_PER_MONTH=10000000
# PLAN_ENTERPRISE_LLM_TOKENS_PER_MONTH=0
```

Recomendación: empieza con Stripe **test mode** y MailerSend en **sandbox**.
Cuando el smoke test pase, conmuta a live cambiando solo las claves.

## 3. Configuración externa post-deploy

Necesitas el dominio público de `criteria-api` para los siguientes pasos.

### 3.1 Stripe webhook

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://<dominio>/api/billing/webhook`.
3. Eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copia el **Signing secret** (`whsec_...`) a `STRIPE_WEBHOOK_SECRET` en
   Railway y redeploya `criteria-api`.
5. Habilita el **Customer Portal** en Settings → Billing si aún no lo está.

### 3.2 Google OAuth redirect URI

1. Google Cloud Console → **APIs & Services → Credentials → OAuth 2.0 Client IDs**.
2. Selecciona el client de CriterIA.
3. Añade a **Authorized redirect URIs**:
   `https://<dominio>/api/auth/google/callback`
4. Si usas un dominio personalizado, añade también `https://app.criteria.app/...`.

### 3.3 MailerSend

1. Confirma que el dominio (o subdominio sandbox) está verificado.
2. Token con permiso **Sending access**.
3. `MAILERSEND_FROM_EMAIL` debe pertenecer al dominio verificado.
4. Test de humo desde tu máquina local (con vars en `.env`):
   ```
   yarn mailersend:test
   ```

## 4. Seed del superadmin (primer arranque)

Una vez `criteria-api` esté arriba y la migración aplicada:

1. Variables temporales en `criteria-api` (Railway → Variables):
   ```env
   NELAI_SUPERADMIN_EMAIL=tu-correo@dominio.com
   NELAI_SUPERADMIN_PASSWORD=<contraseña-fuerte-temporal>
   NELAI_SUPERADMIN_NAME=Operaciones
   ```
2. **Service → Settings → Open Shell** (o `railway run` desde el CLI).
3. Ejecuta:
   ```
   yarn db:seed:superadmin
   ```
4. Comprueba que el comando termina con `OK` y los datos llegaron a Postgres.
5. Quita las tres variables `NELAI_SUPERADMIN_*` y rota la contraseña dentro de
   la app (en `/platform`).

> Si solo tienes el `node` runtime instalado en la imagen y no `yarn`,
> alternativa: `node scripts/seed-superadmin.mjs`.

## 5. Smoke tests

Sustituye `<dominio>` por la URL pública del API. Todos los `curl` deberían
retornar 2xx salvo donde se indique.

1. **Health del C2PA**
   ```
   curl -s https://<dominio>/api/c2pa-health | jq
   ```
   Espera: `{"ok": true, "c2pa": true}`.
2. **Frontend SPA**
   ```
   curl -sI https://<dominio>/ | head -5
   ```
   Espera 200 + `text/html`. Abre la PWA en el navegador y revisa la consola:
   - Sin 404 a `/nelai/...`.
   - Service worker registrado en `/`.
3. **Registro + verificación + login**
   - Crea un usuario nuevo desde la PWA (formulario o Google).
   - Para email/password, recibe el correo de verificación (MailerSend).
   - Tras verificar, inicia sesión.
4. **Etherpad embebido**
   - Crea un documento en la app.
   - Abre el editor: el iframe debe cargar `/pad/p/<id>` y la WebSocket debe
     conectar (`/socket.io`). En DevTools → Network → WS, status 101.
   - Escribe → cierra → reabre: el contenido persiste.
5. **Catálogo de planes**
   ```
   curl -s https://<dominio>/api/billing/plans | jq
   ```
   Verifica que `tokenPeriod` aparece como `fortnight` para `trial` y `month`
   para los demás. No debe haber `maxDocumentsPerMonth` (lo eliminamos).
6. **Stripe checkout (test mode)**
   - En la PWA → Ajustes → Facturación, inicia checkout del plan Starter.
   - Paga con `4242 4242 4242 4242` / cualquier CVC / fecha futura.
   - Vuelve a `/settings?billing=success`.
   - En Postgres, `organizations.plan = 'starter'` y `stripeSubscriptionId` no
     es null. Webhook log debería mostrar `checkout.session.completed`.
7. **Agente LLM**
   - Crea un mensaje al agente desde un documento.
   - Revisa `GET /api/usage/llm` (con Bearer): `usedTokensThisMonth` aumenta y
     `tokenPeriod` corresponde al plan activo.
   - Si la organización está en plan `trial`, el contador se reinicia cada 15
     días desde la fecha de creación de la organización.

## 6. Troubleshooting

| Síntoma | Causa más probable | Acción |
| --- | --- | --- |
| Build `criteria-api`: `--mount=type=cache ... missing the cacheKey prefix from its id` o `is missing an id argument` | El builder de Railway no acepta cache mounts portables (exige prefijo `s/<service-id>-…`) | Eliminados del Dockerfile: el build no usa cache mount. Tras pull, redeploy. |
| Build `etherpad`: `"/entrypoint.sh": not found` | Root Directory mal: el contexto no incluye `entrypoint.sh` donde el Dockerfile lo espera | Usa **raíz del repo** + Dockerfile path `nelai-pwa/etherpad/Dockerfile` (ver §1.3). No uses solo `nelai-pwa/etherpad` salvo que adaptes el Dockerfile. |
| Build `criteria-api`: `".yarn/patches": not found` o `"package.json": not found` | Root Directory vacío + Dockerfile que no usa prefijo `nelai-pwa/` | Asegura **Dockerfile path:** `nelai-pwa/Dockerfile`; el Dockerfile actual ya hace `COPY nelai-pwa/...`. |
| 502 al cargar `/pad` | `ETHERPAD_INTERNAL_URL` mal o servicio etherpad caído | Revisa logs del servicio etherpad y la variable. |
| Pads no sincronizan | `upgrade` no llega al proxy | Verifica `attachEtherpadWebSocketUpgrade` en logs y que `ws: true` esté en el middleware. |
| Webhook Stripe falla | `STRIPE_WEBHOOK_SECRET` desactualizado tras recrear el endpoint | Copia el nuevo `whsec_...` y redeploya. |
| Login Google: `redirect_uri_mismatch` | URI no autorizado | Añade exactamente `https://<dominio>/api/auth/google/callback` en Google Console. |
| Google OAuth o **enlace del correo de verificación** abre la app y sale **404** (React Router) | El Service Worker (PWA) servía `index.html` para navegaciones a `/api/...` | Despliega el build que excluye `/api/` del `navigateFallback` de Workbox (`vite.config.ts`). Luego borra datos del sitio o anula el SW en DevTools y recarga. |
| Consola: `no-response` en rutas SPA (`/documents/…/edit-quill`, etc.) | Workbox aplicaba `NetworkFirst` a todo HTTPS, incluido el mismo origen | Build con `sameOrigin` excluido de la regla externa en `vite.config.ts`. Borra datos del sitio una vez para quitar el SW antiguo. |
| `503` en `/api/docs/…/pad/session` o `pad/content` | Falta Etherpad o solo definiste `ETHERPAD_INTERNAL_URL` en una versión antigua del API | En `criteria-api`: `ETHERPAD_INTERNAL_URL`, `ETHERPAD_API_KEY`, `ETHERPAD_PUBLIC_URL=/pad`; servicio `etherpad` desplegado en red privada. Redeploy del API. |
| `runtime.lastError: Receiving end does not exist` | Extensión del navegador (p. ej. wallet) | Ignorar o probar en ventana de incógnito sin extensiones. |
| Enlace del correo apunta a `http://127.0.0.1:3456/...` | Falta URL pública en el servidor | Define `AUTH_API_PUBLIC_URL=https://<tu-dominio>` (o solo `AUTH_FRONTEND_ORIGIN` si PWA y API comparten el mismo origen; el API deduce la base para el correo). |
| Rate limits bloquean a todos | falta `app.set('trust proxy', 1)` | Ya está aplicado; si lo cambiaste, restaura. |
| PWA pide `/nelai/...` | build sin `VITE_BASE_URL=/` | El Dockerfile lo fuerza; si compilaste local, exporta la var antes de `yarn build`. |
| Prisma migra al arrancar pero queda colgado | versión de engine vs OpenSSL | Imagen base `bookworm-slim` ya incluye `openssl`; comprueba que no la cambiaste a Alpine. |
| Log: «Prisma schema loaded…» y luego error / deploy caído | Suele ser la **línea siguiente** del log (conexión, SSL o migración SQL). Si el fallo es SSL con Postgres gestionado, añade a `DATABASE_URL` `?sslmode=require` (o `&sslmode=require` si ya hay query). |
| `datasource.url property is required` al arrancar (`migrate deploy`) | La imagen runtime debe incluir `prisma.config.ts` (donde está `DATABASE_URL` en Prisma 7). Además, en el servicio `criteria-api` define **`DATABASE_URL`** apuntando al Postgres (p. ej. `${{criteria-postgres.DATABASE_URL}}`). |
| `migrate deploy` en BD nueva: error sobre `email_verification_tokens` inexistente | Orden de migraciones corregido en repo (ALTER fusionado en la migración que crea la tabla). Vuelve a desplegar con la última `main`. |

## 7. Custom domain (opcional)

Ejemplo: **`criteria.peranto.app`** apunta al único servicio público (`criteria-api`: PWA + API mismo origen).

### 7.1 Railway

1. Servicio **`criteria-api`** → **Settings → Networking → Public Networking → Custom Domain**.
2. Añade **`criteria.peranto.app`** y confirma.
3. Railway mostrará el registro DNS esperado (normalmente **CNAME** del host `criteria` hacia un target tipo `xxxx.up.railway.app` o lo que indique el panel). Espera a que el dominio quede **Active / Verified** (propagación DNS puede tardar minutos u horas).

### 7.2 DNS en `peranto.app`

En tu proveedor (Cloudflare, Route53, etc.), crea:

| Tipo | Nombre / host | Valor / target |
|------|----------------|----------------|
| **CNAME** | `criteria` | El hostname que te dé Railway (sin `https://`) |

No uses el dominio `.railway.internal` para el navegador; eso es solo red privada entre servicios.

### 7.3 Variables en Railway (`criteria-api`)

Sustituye cualquier URL antigua (`*.up.railway.app`) por **`https://criteria.peranto.app`** (sin barra final):

- `AUTH_API_PUBLIC_URL`
- `AUTH_FRONTEND_ORIGIN`
- `CORS_ORIGIN` (recomendado igual que el origen público)
- `GOOGLE_OAUTH_REDIRECT_URI` → `https://criteria.peranto.app/api/auth/google/callback`
- `STRIPE_SUCCESS_URL` → `https://criteria.peranto.app/settings?billing=success`
- `STRIPE_CANCEL_URL` → `https://criteria.peranto.app/settings?billing=cancel`
- `STRIPE_PORTAL_RETURN_URL` → `https://criteria.peranto.app/settings`

Guarda y **redeploy** el servicio para aplicar variables.

### 7.4 Proveedores externos

1. **Google Cloud** (OAuth): en el cliente OAuth, **Authorized redirect URIs** debe incluir exactamente  
   `https://criteria.peranto.app/api/auth/google/callback`  
   (y puedes dejar la URI antigua de Railway un tiempo hasta migrar del todo).
2. **Stripe**: webhook §3.1 → endpoint  
   `https://criteria.peranto.app/api/billing/webhook`  
   Si creas un endpoint nuevo, copia el nuevo **`STRIPE_WEBHOOK_SECRET`** (`whsec_...`).
3. **MailerSend**: los enlaces de verificación usan `AUTH_API_PUBLIC_URL` o, si falta, `AUTH_FRONTEND_ORIGIN` (mismo origen). Alinea ambas con §7.3.

### 7.5 Certificado HTTPS

Railway gestiona TLS para el dominio personalizado una vez verificado el DNS; no necesitas subir cert manual en la app Node habitualmente.
