# Manual de usuario (CriterIA PWA)

Este manual describe **qué hace la webapp** y **cómo usarla** desde la perspectiva del usuario final.

## Conceptos clave

- **Sesión de plataforma (SaaS)**: tu sesión de organización (login). Sirve para acceder a funciones del workspace (documentos, agente, etc.).
- **Wallet local (Substrate keyring)**: tus llaves viven **en tu dispositivo** y se guardan **encriptadas** (IndexedDB).  
  - Por seguridad, al recargar la app la wallet puede estar **bloqueada** (las llaves privadas no están en memoria).
  - Para **crear/firmar** documentos, necesitas **desbloquear** la wallet.

## Inicio rápido

1. **Inicia sesión** (si aplica).
2. Si ves el aviso **“Wallet bloqueada”**, pulsa **Desbloquear** y escribe tu contraseña (o WebAuthn si está disponible).
3. Ve a **Documentos** → **Crear documento**.
4. Edita el documento en el editor colaborativo (Etherpad).
5. Cuando necesites, usa **Exportar Markdown**.

## Wallet: bloqueo, desbloqueo y cuentas

### ¿Por qué se bloquea al recargar?

La app no mantiene llaves privadas en memoria permanentemente. Tras un refresh (o al abrir en un dispositivo nuevo) la wallet vuelve a estado **bloqueado**.

### Cómo desbloquear (sin ir a “Cuentas”)

Cuando la app detecta que existe una wallet guardada pero está bloqueada, verás un banner:

- **Wallet bloqueada** → botón **Desbloquear**

Al desbloquear:

- el banner desaparece
- ya puedes crear/firmar documentos

### Una sola contraseña por wallet (vault)

La wallet del dispositivo funciona como un **vault**: todas las cuentas guardadas comparten **una sola contraseña**.

- **Crear una cuenta adicional**: usa la **misma contraseña** que usas para desbloquear.
- **Importar una cuenta**: si el vault ya existe, la contraseña del wallet es **requerida**.

Esto evita un problema clásico: “solo funciona la última contraseña”.

### Crear una cuenta (primera vez)

Si es tu primera vez (no hay cuentas guardadas):

1. Ve a **Cuentas** → **Crear cuenta**
2. Genera una frase de recuperación (mnemonic)
3. Guarda la frase en un lugar seguro
4. Define una contraseña (esta se convierte en la contraseña del vault del dispositivo)

### Importar una cuenta

Ve a **Cuentas** → **Importar** y elige un método:

- **Mnemonic** (12 o 24 palabras)
- **URI/Seed**
- **JSON** (Polkadot.js)

Si el dispositivo ya tiene vault:

- se te pedirá la **contraseña del wallet** para poder guardar la cuenta importada

## Documentos

### Crear documento

1. Ve a **Documentos** → **Crear documento**
2. Selecciona la cuenta que será el **autor** (cuenta activa)
3. Se abre el editor colaborativo (Etherpad) embebido

### Editar (Etherpad)

Dentro del editor colaborativo puedes:

- escribir y editar en tiempo real
- usar **headings** (títulos)
- usar **tabla de contenidos** (TOC)
- usar fórmulas **LaTeX** (si aplica)

Nota: el editor corre en un `iframe` bajo el mismo origen para evitar bloqueos de cookies.

### Exportar Markdown

En el editor colaborativo (pantalla de edición) encontrarás el botón:

- **Exportar Markdown**

Esto descarga un archivo `.md` del contenido actual del pad.

## Privacidad / PII (redacción)

En el editor de documentos hay un panel de **PII** para:

- escanear patrones (email, teléfono, RFC/CURP, etc.)
- generar una vista redactada
- aplicar la redacción al pad

## Agente (asistencia de redacción y revisión)

El panel del **Agente** trabaja sobre el texto del pad. Flujo recomendado:

1. Ejecuta **PII** y aplica redacción si corresponde
2. Usa el **Agente** para:
   - reescritura / estilo
   - checklist legal / consistencia
   - propuestas de cambios (antes/después)

## Solución de problemas (FAQ)

### “No puedo crear documentos después de recargar”

Causa: la wallet está **bloqueada**.

Solución: usa el banner **Wallet bloqueada → Desbloquear**.

### “Me pide crear cuenta cuando ya tenía cuentas”

Normalmente indica:

- vault no accesible temporalmente (IndexedDB/permiso), o
- la wallet está bloqueada y aún no se desbloqueó

Solución: desbloquear desde el banner; si persiste, revisar permisos del navegador (almacenamiento/cookies) o probar en una ventana normal (no incógnito).

### “Warnings de traducción en consola (Etherpad plugins)”

Son warnings de i18n del editor (no afectan el funcionamiento). Se pueden personalizar después.

---

## Para administradores / despliegue

Este documento es para usuarios. Para operación técnica/verificación de setup, ver:

- `../README.md` (visión general del paquete)
- `../server/README.md` (backend/API)
- `../RAILWAY_DEPLOY.md` (despliegue en Railway)
- `KEYRING_FLOW.md` (flujo de keyring)

