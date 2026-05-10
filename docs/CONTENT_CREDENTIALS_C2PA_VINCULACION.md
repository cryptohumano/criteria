# Content Credentials (C2PA) y Nelai: estándar base + Polkadot

**Decisión estratégica:** Usar **Content Credentials (C2PA)** como estándar principal de procedencia y autenticidad, y **Polkadot** como capa adicional de identidad soberana. Ambas conviven para redundancia y resiliencia; el formato y la verificación se alinean al estándar C2PA para que cualquier adoptante o fork pueda interoperar con el ecosistema (validadores, herramientas, spec 2.3).

---

## 1. Estrategia: C2PA como base, Polkadot como capa adicional

- **Por qué C2PA primero:** Polkadot no define un estándar de procedencia de contenido; Content Credentials (C2PA) sí. Ajustar todo al estándar C2PA da interoperabilidad: cualquier validador o herramienta que entienda Content Credentials puede consumir lo que Nelai produce; cualquiera puede usar o forkear Nelai sin depender de un formato propio.
- **Redundancia y resiliencia:** El mismo activo lleva un **manifiesto C2PA conforme** (claim + assertions + firma según spec) y, opcionalmente, una **assertion personalizada** con identidad/firma Polkadot. Así:
  - Herramientas estándar C2PA ven un credential válido.
  - Nelai (y forks) pueden verificar además la capa Polkadot (soberanía, on-chain si se desea).

**Implicación:** El stack y el JSON actuales (metadata, contentHash, firma) se **adaptan al modelo C2PA**: claim, assertions estándar (p. ej. `c2pa.hash.data`, `c2pa.actions`, `c2pa.metadata`) y, como extensión, una assertion tipo `org.nelai.polkadot` con `address` (ss58), `signature` y referencia al payload firmado. La firma del claim C2PA puede ser X.509 (máxima compatibilidad) o, en un primer momento, solo la assertion Polkadot mientras se integra un certificado.

---

## 2. Qué son Content Credentials / C2PA

- **C2PA** (Coalition for Content Provenance and Authenticity): estándar abierto para **procedencia y autenticidad** de contenido (fotos, vídeo, audio, PDF).
- **Content Credentials**: la marca/iniciativa de uso (por ejemplo en cámaras, Adobe, etc.); la **tecnología** es C2PA.
- En la práctica: un **manifiesto** (claims + firmas) que va **dentro del archivo** (por ejemplo en un JPEG, PDF o MP4). Cualquier herramienta que entienda C2PA puede **leer** ese manifiesto y mostrar “quién creó/editó, con qué herramienta, cuándo”.
- Ventaja: la prueba **viaja con el archivo**; no hace falta una base de datos externa para ver la procedencia (aunque las firmas pueden referenciar certificados externos).

---

## 3. Diseño dual: C2PA estándar + assertion Polkadot

| Aspecto | Enfoque Nelai (alineado a C2PA) |
|--------|----------------------------------|
| **Formato principal** | Manifiesto C2PA conforme (claim v2, assertions estándar, firma COSE). Spec de referencia: [C2PA 2.3](https://spec.c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html). |
| **Dónde vive** | Manifiesto **dentro** del archivo cuando el formato lo permita (JPEG, PDF, etc.); o manifest externo (`.c2pa`) / referencia en metadata. |
| **Identidad estándar** | Credencial en el claim C2PA (X.509 para máxima compatibilidad con validadores genéricos). |
| **Identidad Polkadot** | Assertion personalizada (p. ej. `org.nelai.polkadot`): `address` (ss58), `signature` sobre el mismo payload que el claim, opcionalmente `signedPayload` o referencia. Así cualquier validador C2PA ve un credential válido; Nelai y forks verifican además la firma Polkadot. |
| **Verificación** | 1) Validación C2PA estándar (claim, assertions, firma). 2) Si existe assertion Polkadot: verificar firma con `address` (Polkadot.js / sr25519-ed25519). |

**Mapeo de nuestro esquema actual a C2PA:**

- `contentHash` → assertion `c2pa.hash.data` (hard binding).
- `author`, `createdAt`, `type`, `filename`, `mimeType`, `geolocation`, `relatedIds` → assertion `c2pa.metadata` (o assertions estándar) + `c2pa.actions` (p. ej. `c2pa.created`).
- Firma Polkadot → assertion custom `org.nelai.polkadot` (redundancia y resiliencia; no reemplaza la firma del claim C2PA).

Así **ambas viven al mismo tiempo**: el estándar Content Credentials es la base; la capa Polkadot es extensión para identidad soberana y posible anclaje on-chain.

---
## 4. Qué hace falta en el stack

- **Generación de manifiestos C2PA:**  
  - Construir claim (instanceID, claim_generator_info, created_assertions, signature ref).  
  - Añadir assertions estándar: `c2pa.hash.data` (contentHash), `c2pa.actions` (p. ej. `c2pa.created`), `c2pa.metadata` (author, createdAt, tipo, etc.).  
  - Añadir assertion custom `org.nelai.polkadot` con address + firma Polkadot sobre el payload relevante.  
  - Firmar el claim (COSE): con X.509 para compatibilidad total o, en fase inicial, documentar que la verificación "completa" la hace Nelai usando la assertion Polkadot.

- **Inyección en el activo:**  
  - Usar c2pa-js (o SDK que escriba C2PA) para empaquetar el manifest e inyectarlo en JPEG/PDF/etc. cuando el entorno (browser/servidor) lo permita.  
  - Si no se puede embeber: guardar manifest como `.c2pa` o en metadata externa y referenciarlo.

- **Verificación:**  
  - Validar el manifest C2PA (spec 2.3): claim, assertions, firma.  
  - Si existe `org.nelai.polkadot`: verificar firma con la clave pública derivada de `address` (Polkadot.js).  
  - Reporte unificado: "Content Credentials válidos" + "Firma Polkadot verificada (cuenta X)" cuando aplique.

- **Identidad C2PA (signer del claim):**  
  - Opción A: certificado X.509 (p. ej. self-signed o emitido por KILT/otro) para que cualquier validador C2PA reconozca el credential.  
  - Opción B: en MVP, firma del claim con herramienta que acepte claves no-X.509 si el SDK lo permite; la assertion Polkadot sigue siendo la prueba de identidad soberana para Nelai/forks.

---

## 5. Orden sugerido (C2PA como estándar base)

| Fase | Qué hacer |
|------|-----------|
| **MVP** | Definir esquema de manifest C2PA que vamos a producir (claim + assertions estándar + `org.nelai.polkadot`). Implementar **lectura** con c2pa-js en el Verificador y verificación de la assertion Polkadot. Opcionalmente seguir generando temporalmente nuestro JSON actual como fallback o puente. |
| **Siguiente** | **Escritura** de manifiestos C2PA al firmar: generar e inyectar (o adjuntar) el manifest; incluir siempre la assertion Polkadot. Unificar el stack para que el formato canónico sea C2PA. |
| **Después** | Certificado X.509 para el signer del claim C2PA (para que validadores estándar den "trusted" sin depender de Nelai). Mantener la assertion Polkadot para redundancia y soberanía. |

Con esto, **Content Credentials y Polkadot viven al mismo tiempo**; el estándar C2PA es la base para adopción e interoperabilidad, y la capa Polkadot aporta resiliencia e identidad soberana.

