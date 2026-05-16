# Manual de usuario (CriterIA PWA)

Este manual describe **qué hace la webapp** y **cómo usarla** desde la perspectiva del usuario final.

## Conceptos clave

- **Sesión de plataforma (SaaS)**: tu sesión de organización (login). Sirve para acceder a funciones del workspace (documentos, agente, etc.).
- **Llave local (Substrate keyring)**: tus claves viven **en tu dispositivo** y se guardan **cifradas** (IndexedDB).  
  - Por seguridad, al recargar la app el almacén puede estar **bloqueado** (las claves privadas no están en memoria).
  - Para **crear o firmar** documentos, necesitas **desbloquear** ese almacén.

## Inicio rápido

1. **Inicia sesión** (si aplica).
2. Si ves **«Llave local bloqueada»**, pulsa **Desbloquear** y usa **WebAuthn** (huella, rostro o PIN del dispositivo) o la **contraseña del almacén local**, según cómo lo configuraste.
3. Ve a **Documentos** → **Crear documento**.
4. Edita el documento en el editor colaborativo (Etherpad).
5. Cuando necesites, usa **Exportar Markdown**.

## Llave local: bloqueo, desbloqueo y cuentas

### ¿Por qué se bloquea al recargar?

La app no mantiene claves privadas en memoria de forma permanente. Tras un refresco (o al abrir en un dispositivo nuevo) el almacén vuelve a estado **bloqueado**.

### Cómo desbloquear (sin ir a «Cuentas»)

Cuando la app detecta que ya hay un almacén guardado pero está bloqueado, verás un banner:

- **Llave local bloqueada** → botón **Desbloquear**

Al desbloquear:

- el banner desaparece
- ya puedes crear o firmar documentos

### Protección del almacén

Puede ser de dos maneras (según lo que elegiste al crear la primera identidad en este navegador):

- **WebAuthn (recomendado en navegadores compatibles)**: no hace falta inventar una segunda contraseña para el vault; el dispositivo pide huella, rostro o PIN.
- **Contraseña solo en el navegador**: una contraseña **local** cifra el vault; **no es** la contraseña del login de la plataforma.

Todas las cuentas guardadas en ese dispositivo comparten **el mismo tipo de protección** del vault.

### Ver la frase de recuperación

En **Configuración → Seguridad → Frase de recuperación** puedes mostrar la frase cuando la necesites (con WebAuthn o con la contraseña del almacén, según corresponda).

### Crear una cuenta (primera vez)

1. Ve a **Cuentas** → **Crear cuenta** (flujo clásico con frase visible), **o** deja que el asistente cree la identidad al abrir un documento (flujo breve con WebAuthn o contraseña local, según el navegador).
2. Si el flujo te muestra la frase, guárdala en un lugar seguro.
3. Si usas solo contraseña local, esa será la del vault en este equipo.

### Importar una cuenta

Ve a **Cuentas** → **Importar** y elige un método:

- **Mnemonic** (12 o 24 palabras)
- **URI/Seed**
- **JSON** (Polkadot.js)

Si el dispositivo ya tiene vault:

- con **WebAuthn**, se pedirá verificación del dispositivo para guardar la cuenta importada;
- con **contraseña local**, se pedirá esa contraseña.

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

### «No puedo crear documentos después de recargar»

Causa: el almacén de la llave local está **bloqueado**.

Solución: usa el banner **Llave local bloqueada → Desbloquear**.

### «Me pide crear cuenta cuando ya tenía cuentas»

Normalmente indica:

- vault no accesible temporalmente (IndexedDB/permiso), o
- el almacén sigue bloqueado y aún no se desbloqueó

Solución: desbloquear desde el banner; si persiste, revisar permisos del navegador (almacenamiento/cookies) o probar en una ventana normal (no incógnito).

### «Warnings de traducción en consola (Etherpad plugins)»

Son warnings de i18n del editor (no afectan el funcionamiento). Se pueden personalizar después.

---

## Para administradores / despliegue

Este documento es para usuarios. Para operación técnica/verificación de setup, ver:

- `../README.md` (visión general del paquete)
- `../server/README.md` (backend/API)
