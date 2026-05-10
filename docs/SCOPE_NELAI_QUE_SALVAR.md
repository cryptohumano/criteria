# Scope Nelai: qué salvar después de analizar Andino Wallet PWA

Documento de decisión tras **clonar** el repo [andino-wallet-pwa](https://github.com/cryptohumano/andino-wallet-pwa) y revisar su código. Comparación con el scope estratégico que realizaste con otro agente (KILT, C2PA, Aura Wallet, etc.) y recomendaciones sobre qué **conservar**, **adaptar** o **diferir**.

---

## 1. Estado del clone

- **Ubicación:** `nelai/nelai-pwa/`
- **Stack verificado:** Vite 7, React 18, TypeScript, Tailwind, pdf-lib, @polkadot/keyring, Dedot, IndexedDB, PWA (Workbox).

---

## 2. Qué hay realmente en Andino (resumen)

| Área | Estado en Andino |
|------|------------------|
| **Identidad / firma** | Keyring Polkadot (sr25519/ed25519). `SubstrateSigner.ts`: firma el **hash del PDF** con `pair.sign(hashBytes)`, guarda `signer`, `signature`, `hash` en `DocumentSignature`. Metadatos X.509 simulados en el PDF (Author = dirección SS58). |
| **Verificación** | `SignatureVerifier.ts`: verifica firmas substrate (hash actual vs hash firmado), autográfica, x509 (no impl.), híbrida. **No** verifica la firma criptográfica contra publicKey (solo coincidencia de hash). |
| **Documentos** | Tipos ricos: `Document`, `DocumentSignature`, `DocumentMetadata`, `GPSMetadata`. Firmas múltiples, `signatureStatus`, `requiredSigners`. |
| **Bitácoras / fotos** | `MountainLog`, `MountainLogImage` con metadata (filename, mimeType, size, capturedAt, gpsMetadata, exifData). **No** hay firma ni `contentHash` por imagen hoy. |
| **API externas** | **Dos sistemas:** (1) `ExternalAPIConfig` en tipos + IndexedDB (`documentStorage.saveExternalAPIConfig`, `getAllExternalAPIConfigs`) con webhooks, auth (api_key/jwt/oauth2). (2) En **Settings.tsx** un `ApiConfig` simplificado guardado en **localStorage** (name, baseUrl, apiKey, type). La UI de Settings **no** usa IndexedDB; por tanto la “config de APIs” funcional hoy es solo localStorage. |
| **C2PA / KILT / IPFS / DKG** | **No** hay referencias en el código. |

---

## 3. Ajustes de nomenclatura (scope vs repo)

- El scope habla de **“Aura Wallet”**; el repo se llama **Andino Wallet**. Se asume que es el mismo producto (PWA para montañistas/uso profesional) o un rebrand. Para el hackathon y la doc, unificar: **Andino Wallet** como base y **Nelai** como capa de verificación de origen.

---

## 4. Qué **SALVAR** del scope (mantener y usar)

| Elemento del scope | Motivo |
|--------------------|--------|
| **Nombre y tagline Nelai** | “Verifica el origen. Confía en la verdad.” y la etimología (nelli + ai) encajan con el Track 2 y con verificación de autenticidad. |
| **Propuesta de valor** | Agente de verificación de origen que combine identidad soberana + metadata criptográfica + grafos de conocimiento. Andino ya da identidad (Polkadot); falta capa de metadata firme y DKG. |
| **Flujo conceptual** | Contenido → Firma con identidad del creador → Publicación opcional en DKG → Agente verifica y reporta ✅/⚠️/❌. Reutilizar este flujo sobre Andino. |
| **Criterios de “terminado” para el hackathon** | Recibe hash/archivo → devuelve reporte con explicación; al menos 1 Knowledge Asset de demo; video con flujo firma → publicación → verificación; repo público MIT/Apache. |
| **Demo: abogado / evidencia / juez** | Caso de uso claro (evidencia firmada, verificable). En Andino el caso “montañista + emergencia + bitácora” es análogo: evidencia fotográfica o documento firmado que un tercero pueda verificar. Mantener el **patrón** (creador firma → verificador consulta), aunque el dominio sea montañismo o legal. |
| **FODA** | Fortalezas y oportunidades siguen aplicando (stack existente, offline-first, pocos proyectos DID+verificación+DKG). Debilidades y mitigaciones (híbrido on/off-chain, UX que no expone “blockchain”) también. |
| **Próximos pasos por semanas** | Estructura Semana 1/2/3 (validación, integración, pulido) es útil; ajustar ítems a lo que **sí** existe en Andino (ver abajo). |
| **Pitch y mensajes clave** | “No solo detecta deepfakes: prueba quién creó el contenido original” y “Nelai es el módulo de verificación de origen integrado en [Andino] Wallet.” |

---

## 5. Qué **ADAPTAR** (alinear con Andino)

| Elemento del scope | Adaptación recomendada |
|--------------------|-------------------------|
| **Identidad** | Scope: KILT / Polkadot. **Andino ya usa Polkadot** (keyring, People Chain). **Mantener Polkadot** como base; **no** introducir KILT en el MVP a menos que sea requisito explícito (KILT añade complejidad y otro ecosistema). Si más adelante se quiere VCs/credenciales verificables, se puede evaluar KILT como capa adicional. |
| **Metadata criptográfica** | Scope: C2PA / Content Credentials. **Andino** no tiene C2PA. Opciones: (1) **MVP sin C2PA:** metadata propia firmada (como en `PLAN.md` y `SCHEMA_METADATA_FIRMA.md`): hash del contenido + firma con keyring sobre hash de metadata. (2) **Fase posterior:** integrar SDK C2PA (p. ej. c2pa-js) para lectura/escritura de manifiestos en imágenes/PDFs y que Nelai pueda **leer** C2PA cuando exista y **complementar** con firma Substrate. Recomendación: **MVP con metadata firmada propia**; C2PA como mejora post-demo. |
| **Conocimiento** | Scope: OriginTrail DKG. **Mantener.** Andino no tiene DKG; añadir dkg.js y publicar Knowledge Assets (hash, autor, fecha) es coherente con el plan ya escrito. |
| **Agente** | Scope: Python + LangChain/LlamaIndex + MCP. **Andino es frontend (React/TS).** Opciones: (1) Agente en **backend** (Python) que exponga REST; la PWA llama a ese endpoint (API key guardada en Andino). (2) Agente **en el cliente** con respuestas por plantillas (sin LLM) o llamando a un API de LLM desde el cliente. Para el hackathon, **plantillas en cliente + opcional backend con LLM** reduce dependencias y muestra el flujo completo. |
| **Storage** | Scope: IPFS/Arweave + MongoDB. **Andino** usa IndexedDB y opcionalmente blockchain (Polkadot) para emergencias. Para el MVP: **no** añadir IPFS/Arweave/MongoDB; contenido pesado sigue en IndexedDB/local; solo hashes (y opcionalmente UAL) on-chain/DKG. Si más adelante se necesita persistencia distribuida de archivos, se puede añadir. |
| **Frontend** | Scope: “PWA existente (Aura Wallet)”. **Unificar:** base = Andino Wallet PWA; Nelai = módulo/pantallas de “Verificar origen” + flujo de firma de metadata para documentos/fotos. |

---

## 6. Qué **NO usar o diferir** (para no sobrecargar el MVP)

| Elemento del scope | Recomendación |
|--------------------|----------------|
| **KILT como capa de identidad principal** | Andino ya tiene Polkadot/People Chain. Diferir KILT (DIDs/VCs específicos de KILT) a una fase posterior para no duplicar identidad y mantener un solo stack (Polkadot). |
| **C2PA en el primer entregable** | Diferir a post-MVP. Implementar primero metadata + firma Substrate (hash de contenido + metadata); luego, si hay tiempo, añadir lectura (y opcionalmente escritura) de C2PA. |
| **Python + LangChain como núcleo del agente** | Si se hace agente en backend, se puede usar Python; pero para el demo no es obligatorio. Verificación criptográfica (firma + contentHash) y reporte por plantillas en TS en el cliente pueden ser suficientes para el video. Diferir orquestación compleja (LangChain/MCP) si no hay tiempo. |
| **IPFS/Arweave/MongoDB** | No incluir en el alcance del hackathon; Andino ya persiste en IndexedDB y blockchain para emergencias. |
| **Caso Adalmex (2000+ abogados)** | Mantener como **historia de impacto** o caso futuro; no condicionar el MVP a integraciones específicas con Adalmex. El demo puede ser genérico “usuario firma evidencia → verificador muestra reporte”. |

---

## 7. Resumen ejecutivo

- **Salvar:** Nombre Nelai, tagline, propuesta de valor, flujo verificación (firma → DKG → reporte ✅/⚠️/❌), criterios de “terminado”, estructura del demo (creador firma, verificador consulta), FODA, próximos pasos por semanas, pitch.
- **Adaptar:** Identidad = Polkadot (ya en Andino); metadata = esquema propio firmado (MVP), C2PA opcional después; agente = cliente (plantillas) + opcional backend LLM; storage = IndexedDB + chain/DKG para hashes; frontend = Andino Wallet PWA como base.
- **Diferir / no usar en MVP:** KILT, C2PA obligatorio, stack Python/LangChain/MCP como requisito, IPFS/Arweave/MongoDB, dependencia del caso Adalmex.

Con esto el scope queda **alineado con lo que Andino ya tiene** y con el plan en `PLAN.md` y `docs/`, sin sobrecomprometer el primer entregable del hackathon.
