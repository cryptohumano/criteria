# Estrategia de generalización — Nelai

Objetivo: que la solución sea **genérica** en nombres y flujos (entendible como herramienta de procedencia y autenticidad), sin quitar las bitácoras ni el dominio montañista; incluir **documentos** (crear + firmar) con agente de ayuda; y dejar claro que el producto final no manipulable lo da Nelai, con el estándar abierto (C2PA) como puente a futuro (p. ej. redes sociales).

---

## 1. Principios

- **Bitácoras siguen siendo bitácoras:** uso montañista, nombres de dominio (MountainLog, milestone, etc.) se mantienen en rutas, tipos y UI de esa sección.
- **Capa genérica en Nelai:** el código y la UI **nuevos** que añadamos (firma de evidencias, verificación, agentes) usan **términos genéricos**: evidencia, contenido firmado, procedencia, verificación. Así cualquier adoptante o fork entiende que sirve para “cualquier” contenido, no solo montaña.
- **Documentos ya existen:** el flujo de Documentos (crear, editar, firmar) es otro punto de uso. Ahí se añade un **agente que ayude a crear y firmar** (Guía en creación + Guía antes de firmar; mismo Verificador para documentos y para evidencias de bitácora).
- **Datos no manipulables desde el origen:** el flujo está pensado para que el usuario cree/firme en Nelai y obtenga un resultado (archivo + metadata firmada, o PDF firmado, o manifest C2PA) que sea el **producto final** para sus fines; no asumimos que ese contenido se edite después en redes sociales de forma nativa.
- **Estándar abierto:** C2PA como formato canónico ayuda a que, si en el futuro plataformas (TikTok, Instagram, etc.) integran Content Credentials, el contenido generado con Nelai pueda ser consumido por sus validadores sin que Nelai sea “nativo” en esas apps. No construimos integración nativa con redes sociales ahora.

---

## 2. Nombres: capa genérica vs dominio

### 2.1 Dónde usar nombres genéricos

| Ámbito | Enfoque | Ejemplo |
|--------|---------|--------|
| **Módulos y tipos nuevos de Nelai** | Genérico | `SignedEvidence`, `EvidenceMetadata`, `signEvidenceMetadata()`, `verifyEvidence()`, `VerificationReport`. Así el código de firma/verificación no dice "mountain" ni "log". |
| **UI nueva compartida** | Genérico | Pantalla "Verificar procedencia"; modal "Contenido firmado"; botón "Firmar con mi cuenta"; "Reporte de verificación". Labels como "Evidencia firmada", "Autor (cuenta)". |
| **Constantes y esquemas C2PA** | Genérico | Assertion `org.nelai.polkadot`; tipo de claim "signed_evidence" o estándar C2PA; campos `author`, `contentHash`, `createdAt` (ya genéricos). |

### 2.2 Dónde mantener nombres de dominio

| Ámbito | Enfoque | Ejemplo |
|--------|---------|--------|
| **Tipos y rutas existentes de bitácoras** | Sin cambiar de raíz | `MountainLog`, `MountainLogImage`, `MountainLogFile`, `MountainLogMilestone`; rutas `/mountain-logs`, `/mountain-logs/:id`. La bitácora es **un uso** del concepto genérico "log con evidencias firmadas". |
| **Tipos y rutas de documentos** | Sin cambiar | `Document`, `DocumentSignature`, `/documents`, `/documents/new`, `/documents/:id`. Los documentos son **un uso** del concepto "contenido firmado". |
| **UI de secciones existentes** | Mantener títulos de sección | "Bitácoras", "Documentos", "Emergencias". Dentro de Bitácoras: "Agregar imagen al milestone", "Milestone", etc. |
| **Navegación** | Mantener | Sidebar/BottomNav: Bitácoras, Documentos, etc. |

### 2.3 Puente en código

- **Bitácoras:** `MountainLogImage` (y `MountainLogFile`) tendrán `contentHash` y `signedMetadata`. Al llamar al módulo de firma de Nelai, se construye un **payload genérico** (blob, author, tipo "photo" o "file") y se recibe `{ contentHash, signedMetadata }` que se guardan en la imagen/archivo. El módulo de Nelai no conoce "MountainLog"; solo "evidencia" (blob + metadata).
- **Documentos:** Ya tienen `DocumentSignature` y firma con Substrate. Cuando unifiquemos con C2PA, el mismo módulo genérico de firma/verificación puede servir para "document" (PDF) y para "evidence" (imagen/archivo). En la UI de documentos, el agente "ayuda a crear y firmar" usa los mismos términos genéricos (qué datos se firman, qué va on-chain, etc.).

Así no renombramos todo Andino a "Evidence"; **añadimos una capa genérica (Nelai)** que habla en términos de evidencia/contenido firmado/verificación, y los dominios (bitácoras, documentos) siguen con sus nombres y solo **usan** esa capa.

---

## 3. Visual y textos (UI)

- **Nuevas pantallas/modales de Nelai:** títulos y descripciones genéricos:
  - "Verificar procedencia" (no "Verificar imagen de bitácora").
  - "Este contenido fue firmado por la cuenta **{address}**. Integridad verificada."
  - "Firmar con mi cuenta" (igual para bitácora o documento).
  - "Reporte de verificación" con secciones: Autor, Integridad, Fecha, DKG/on-chain (si aplica).
- **Dentro de Bitácoras:** se puede mantener "Agregar imagen al milestone" y "Bitácora"; al mostrar el sello de firma en una imagen, texto genérico: "Evidencia firmada" o "Contenido firmado por tu cuenta".
- **Dentro de Documentos:** "Crear documento", "Firmar documento"; el agente: "Asistente para crear y firmar" o "Guía: qué se firma y qué va on-chain".

Con esto la app se entiende como **herramienta genérica de procedencia y autenticidad**, con "Bitácoras" y "Documentos" como dos flujos de uso claros.

---

## 4. Flujo de documentos: agente para crear y firmar

- **Dónde:** `DocumentEditor` (crear/editar) y el flujo de firma en `DocumentDetail` (o donde se llame a `signDocumentWithSubstrate`).
- **Qué hace el agente (Guía):**
  - **En creación/edición:** (opcional) panel o paso "Asistente" que sugiere tipo de documento, campos útiles (título, descripción, tipo), o plantillas. MVP puede ser texto fijo: "Al guardar, podrás firmar este documento con tu cuenta. La firma incluirá el hash del PDF y tu identidad."
  - **Antes de firmar:** modal o panel "Antes de firmar" con texto tipo: "Al firmar, estos datos quedarán asociados de forma verificable: autor (tu cuenta), hash del documento, fecha. Si más adelante registras on-chain, esos datos serán públicos en la blockchain." Con botón "Entendido" / "Firmar".
- **Producto final:** el documento firmado (PDF con firma Substrate y, cuando aplique, manifest C2PA + assertion Polkadot) es el **resultado no manipulable** que el usuario usa para sus fines (presentar, archivar, compartir). No asumimos integración nativa con redes; el estándar abierto facilita que otras plataformas, si adoptan C2PA, puedan verificar ese contenido.

---

## 5. Redes sociales y estándar abierto

- **Situación:** No construimos integración nativa con TikTok/Instagram. Es más plausible que esas plataformas integren Content Credentials en su lado a que cada usuario de Nelai lleve contenido a "la economía digital de redes" a mano.
- **Ventaja del estándar (C2PA):** Si el contenido que sale de Nelai lleva un manifest C2PA válido (y opcionalmente assertion Polkadot), cualquier validador que entienda C2PA (incluidas futuras herramientas de redes sociales) podrá mostrar "creado por X, no alterado". Así Nelai entrega un **producto estándar**; la adopción en redes depende de ellas.
- **Resumen:** Diseñamos para estándar abierto y producto final no manipulable; la integración en redes queda del lado de las plataformas.

---

## 6. Resumen para implementación

| Qué | Cómo |
|-----|------|
| **Tipos nuevos de Nelai** | Nombres genéricos: `SignedEvidenceMetadata`, `EvidenceSigningResult`, `VerificationReport`. No `Mountain*` en esa capa. |
| **Módulo de firma** | API genérica: `signEvidenceMetadata(blob, authorAddress, keyringPair, options)` → `{ contentHash, signedMetadata }`. Usado desde MountainLogDetail (para imágenes) y luego desde flujo de documentos si unificamos. |
| **UI nueva (Verificador, Guía)** | Textos genéricos: "Verificar procedencia", "Contenido firmado", "Firmar con mi cuenta", "Reporte de verificación". |
| **Bitácoras** | Sin renombrar; solo añadir campos a `MountainLogImage`/`MountainLogFile` y llamar al módulo genérico. |
| **Documentos** | Añadir agente Guía en editor y antes de firmar; mismo Verificador para documentos y evidencias. |
| **C2PA** | Formato canónico; assertion `org.nelai.polkadot`; producto final estándar para interoperabilidad futura. |

Así se mantiene la claridad para montañistas (bitácoras) y para documentos, y al mismo tiempo la solución es genérica en la capa Nelai y comprensible para cualquier adoptante o fork.
