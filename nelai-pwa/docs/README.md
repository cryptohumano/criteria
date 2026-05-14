# `nelai-pwa/docs/` — guías técnicas de la app

Documentación específica de la PWA y del backend. Para arquitectura de alto
nivel del producto ver [`../../docs/`](../../docs/).

## Índice

### Cuentas, identidad y firma

- [`KEYRING_FLOW.md`](KEYRING_FLOW.md) — flujo del keyring Polkadot:
  importación, derivación, firma y unlock.
- [`ACTIVE_ACCOUNT_CONTEXT.md`](ACTIVE_ACCOUNT_CONTEXT.md) — contexto React
  que mantiene la cuenta activa y su sincronización con el pad.
- [`WEBAUTHN_IMPLEMENTATION.md`](WEBAUTHN_IMPLEMENTATION.md) — implementación
  de WebAuthn para desbloquear el keyring sin contraseña.

### Documentos y editor

- [`DOCUMENT_EDITING_AND_SIGNING_PLAN.md`](DOCUMENT_EDITING_AND_SIGNING_PLAN.md) —
  plan del flujo de edición → revisión → firma.
- [`DOCUMENT_STRUCTURE_PLAN.md`](DOCUMENT_STRUCTURE_PLAN.md) — estructura
  interna de un "documento" en CriterIA: secciones, metadatos, versiones.
- [`CONTRACT_SANITIZATION_DESIGN.md`](CONTRACT_SANITIZATION_DESIGN.md) —
  diseño de la sanitización de contratos (cómo se prepara texto antes de
  llegar al LLM).

### Privacidad y LLM

- [`LLM_PRIVACY_PII_FLOW.md`](LLM_PRIVACY_PII_FLOW.md) — flujo de redacciones
  reversibles de PII (CURP, RFC, emails, montos…) antes de mandar texto al
  agente, y cómo se restituyen en el pad.

### API

- [`API_DESIGN.md`](API_DESIGN.md) — diseño general de la API REST del
  backend.
- [`API_IMPLEMENTATION_EXAMPLES.md`](API_IMPLEMENTATION_EXAMPLES.md) —
  ejemplos `curl` y JS de los endpoints principales.

### Almacenamiento

- [`INDEXEDDB_STRUCTURE.md`](INDEXEDDB_STRUCTURE.md) — esquema de IndexedDB
  en el cliente: stores, índices y migraciones.
- [`STORAGE_PLATFORMS.md`](STORAGE_PLATFORMS.md) — opciones de
  almacenamiento (IndexedDB, OPFS, exportación) y cuándo usar cada una.

### PWA

- [`PWA_FEATURES.md`](PWA_FEATURES.md) — capacidades activas de la PWA.
- [`PWA_OFFLINE_CAPABILITIES.md`](PWA_OFFLINE_CAPABILITIES.md) — qué
  funciona sin red y cómo se reconcilia al reconectar.
- [`PWA_UPDATES_AND_DATA_PERSISTENCE.md`](PWA_UPDATES_AND_DATA_PERSISTENCE.md) —
  estrategia de actualización del service worker y persistencia de datos.

### Operación local

- [`LOCALHOST_RUN_SETUP.md`](LOCALHOST_RUN_SETUP.md) — cómo levantar el
  entorno local completo.
- [`DEBUGGING.md`](DEBUGGING.md) — pistas para depurar el cliente y el
  backend.
- [`MANUAL_USUARIO.md`](MANUAL_USUARIO.md) — manual de usuario (escrito
  para usuarios finales no técnicos).
- [`DEVELOPMENT_ROADMAP.md`](DEVELOPMENT_ROADMAP.md) — roadmap de
  funcionalidades pendientes y exploraciones.

### Tutoriales (contenido de producto)

[`tutoriales/`](tutoriales/) — tutoriales en Markdown que se importan como
módulos en la PWA y aparecen en `/help`. Modificar uno equivale a actualizar
el contenido visible al usuario.

- `00_WALLET_Y_POR_QUE.md`
- `01_CREAR_DOCUMENTO_ACADEMICO.md`
- `02_PERFILES_DEL_AGENTE.md`
- `03_EXPORTAR_MARKDOWN.md`
- `04_CUENTA_CRITERIA_VS_SUBSTRATE.md`
- `05_PII_Y_PRIVACIDAD.md`
- `06_GUIA_SPOTLIGHT_DOCUMENTOS_INICIO.md` — primer inicio: spotlight de acciones de documentos
- `07_GUIA_SPOTLIGHT_EDITOR_ETHERPAD.md` — primera vez en el editor Etherpad: barra y panel
- `08_GUIA_SPOTLIGHT_EDITOR_QUILL.md` — primera vez en el editor local Quill: barra, formato y vista previa
