# `docs/` — diseño y arquitectura del producto

Documentación de alto nivel del proyecto **CriterIA**: visión, arquitectura y
decisiones de diseño que aplican al producto en su conjunto. Para guías
operativas (cómo correr, desplegar, etc.) ver [`../README.md`](../README.md) y
[`../nelai-pwa/RAILWAY_DEPLOY.md`](../nelai-pwa/RAILWAY_DEPLOY.md).

## Índice

### Agente y arquitectura

- [`AGENTE_GUIA_ARQUITECTURA.md`](AGENTE_GUIA_ARQUITECTURA.md) — diseño del
  agente LLM: profiles, system prompts, herramientas, integración con el pad.
- [`AGENTES_IMPLEMENTACION.md`](AGENTES_IMPLEMENTACION.md) — detalles de
  implementación del agente (server-side y cliente-side).

### Verificación y firma criptográfica

- [`CONTENT_CREDENTIALS_C2PA_VINCULACION.md`](CONTENT_CREDENTIALS_C2PA_VINCULACION.md) —
  cómo CriterIA inserta manifiestos C2PA (Content Credentials) en los PDFs y
  los vincula a la identidad Polkadot del usuario.
- [`SCHEMA_METADATA_FIRMA.md`](SCHEMA_METADATA_FIRMA.md) — esquema JSON-LD que
  acompaña cada firma (campos, hashes, autoría, timestamps).

### Persistencia y privacidad

- [`ARQUITECTURA_SIN_BLOCKCHAIN.md`](ARQUITECTURA_SIN_BLOCKCHAIN.md) — por
  qué la blockchain es **opcional**: los documentos siguen siendo válidos con
  solo la firma local + C2PA, y cómo persiste la información sin requerir
  on-chain.

### PWA

- [`PWA_WEB_WORKERS.md`](PWA_WEB_WORKERS.md) — service worker, web workers y
  estrategias de cache.

## Documentación relacionada en otras carpetas

- [`../nelai-pwa/docs/`](../nelai-pwa/docs/) — guías técnicas de la app:
  IndexedDB, keyring, sanitización de PII, plan de edición, tutoriales.
- [`../nelai-pwa/server/README.md`](../nelai-pwa/server/README.md) —
  endpoints del backend, billing Stripe, MailerSend, certificados C2PA.
- [`../nelai-pwa/RAILWAY_DEPLOY.md`](../nelai-pwa/RAILWAY_DEPLOY.md) —
  despliegue paso a paso en Railway.
