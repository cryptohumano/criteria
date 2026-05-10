# Próximos pasos — Cómo proceder con Nelai

Orden recomendado para implementar sobre `nelai-pwa` (rama `feature/async-logbook`).

**Estándar:** Procedencia y autenticidad se alinean a **Content Credentials (C2PA)**; la identidad Polkadot va como assertion custom `org.nelai.polkadot` para redundancia. Ver `CONTENT_CREDENTIALS_C2PA_VINCULACION.md`.

---

## Paso 1 — Firma de metadata para evidencias (prioridad)

**Objetivo:** Que cada foto o archivo adjunto en una bitácora (milestone) tenga procedencia verificable: **manifiesto C2PA** (o metadata equivalente que mapee a C2PA) + **assertion Polkadot** (contentHash + firma con keyring).

**Tareas:**
1. **Tipos:** Extender `MountainLogImage` y `MountainLogFile` (en `nelai-pwa/src/types/mountainLogs.ts`) con campos opcionales: `contentHash?: string`, `signedMetadata?: { metadata, signature, signer }` (o estructura equivalente que luego mapee a C2PA + assertion `org.nelai.polkadot`).
2. **Módulo de firma:** Crear un módulo que:
   - Construya metadata canónica (version, type, contentHash, createdAt, author, etc.) según `SCHEMA_METADATA_FIRMA.md` (mapeable a assertions C2PA).
   - Calcule SHA-256 del blob (imagen/archivo) → contentHash.
   - Genere hash del payload canónico y llame al keyring Polkadot para firmar (reutilizar lógica de `SubstrateSigner` o `pair.sign`).
   - Devuelva `{ metadata, signature, signer }` para guardar junto al recurso (y, cuando se implemente escritura C2PA, alimentar claim + assertion `org.nelai.polkadot`).
3. **Integración en flujo de guardado:** Al añadir una foto a un milestone (o un archivo en histórica), después de guardar el blob, ofrecer “Firmar con mi cuenta” y persistir la firma en el objeto imagen/archivo y en la bitácora.

**Entregable:** Fotos/archivos en milestones con metadata firmada; cualquier cambio en el archivo invalida la verificación.

---

## Paso 2 — Agente Verificador (MVP)

**Objetivo:** Pantalla o modal “Verificar archivo / UAL” que reciba archivo + metadata + firma (o UAL) y muestre un reporte legible.

**Tareas:**
1. **Verificación:** Si hay manifest C2PA: validar claim + assertions + firma (c2pa-js o equivalente). Si hay assertion Polkadot o metadata nuestra: reconstruir payload canónico, verificar firma con `@polkadot/util-crypto` y comprobar contentHash del archivo.
2. **Reporte por plantillas:** Generar texto tipo: “Firmado por **{address}**. Integridad: **válida/no válida**. Fecha: **{createdAt}**.”
3. **UI:** Ruta o modal “Verificar” (p. ej. en Settings o en el menú) con input de archivo + JSON de metadata (o pegar UAL más adelante).

**Entregable:** Usuario sube archivo + metadata; ve un reporte ✅/⚠️/❌ con explicación.

---

## Paso 3 — Integración DKG (OriginTrail)

**Objetivo:** Poder publicar una evidencia (o documento) como Knowledge Asset y consultar por UAL.

**Tareas:**
1. Añadir dependencia `dkg.js` en Andino.
2. Módulo (o servicio) que, dado metadata + firma, cree un Knowledge Asset (JSON-LD, Schema.org) con contentHash, autor, fecha; conectar a gateway DKG (config o API key).
3. Guardar UAL devuelto en el recurso (documento o en metadata de imagen/milestone).
4. En el Verificador: si el input es un UAL, llamar `dkg.asset.get(UAL)` y resumir en el reporte.

**Entregable:** “Proteger en DKG” en evidencias/documentos; Verificador puede leer por UAL.

---

## Paso 4 — Agente Guía

**Objetivo:** Antes de “Registrar on-chain” o “Publicar en DKG”, mostrar texto explicativo (qué va on-chain, riesgos, verificabilidad).

**Tareas:**
1. Identificar en la UI los puntos donde el usuario confirma envío on-chain o publicación DKG.
2. Modal o panel con texto (plantillas por tipo de acción) que explique qué datos serán públicos, cuáles no, y riesgos de privacidad.
3. Opcional: conectar a LLM vía API key (usando config de Andino) para respuestas más ricas.

**Entregable:** Usuario ve explicación clara antes de confirmar; menos fricción y más confianza.

---

## Paso 5 — API Keys funcionales (opcional para demo)

**Objetivo:** Que la configuración de APIs externas (DKG gateway, LLM) use IndexedDB y el tipo `ExternalAPIConfig` en lugar de solo localStorage.

**Tareas:**
1. En Settings, usar `saveExternalAPIConfig` / `getAllExternalAPIConfigs` de `documentStorage.ts` (IndexedDB).
2. Unificar el tipo que usa la UI con `ExternalAPIConfig` (o mapear) para no perder webhooks/auth si se necesitan después.
3. Cifrado de API keys si ya existe capa en Andino; si no, guardar en claro en IndexedDB de momento (y documentar que es solo para desarrollo/demo).

**Entregable:** Configuración de APIs persistida y reutilizable por DKG y por el agente (LLM).

---

## Orden sugerido

| Orden | Paso              | Dependencias     |
|-------|-------------------|------------------|
| 1     | Firma metadata    | Ninguna          |
| 2     | Verificador MVP  | Paso 1           |
| 3     | DKG               | Paso 1; API key opcional |
| 4     | Agente Guía       | Ninguna          |
| 5     | API Keys          | Opcional         |

Para el **hackathon**, el mínimo viable es: **Paso 1 + Paso 2** (firma de evidencias + Verificador que lee metadata y devuelve reporte). Paso 3 (DKG) da mucho valor si hay tiempo; Pasos 4 y 5 mejoran la experiencia y la configuración.

---

## Cómo empezar ahora

**Siguiente acción concreta:** Implementar **Paso 1** dentro de `nelai-pwa`:

1. En `src/types/mountainLogs.ts`: añadir a `MountainLogImage` y `MountainLogFile` los campos de metadata firmada (p. ej. `signedMetadata` con metadata, signature, signer).
2. Crear `src/utils/nelaiMetadataSigning.ts` (o `src/services/nelai/...`) con:
   - `buildMetadataForEvidence(type, contentBase64, author, options)` → objeto metadata canónico + contentHash.
   - `signMetadata(metadata, pair)` → firma con keyring, devuelve signature + signer.
   - `verifySignedMetadata(metadata, signature, signer, contentBase64?)` → boolean.
3. En el flujo donde se agrega una imagen a un milestone (`MountainLogDetail.tsx` o componente de galería), después de crear el `MountainLogImage`, llamar al nuevo módulo, adjuntar `signedMetadata` al objeto imagen y guardar la bitácora.

Si quieres, el siguiente mensaje puede ser: *“Implementa el Paso 1”* y se hace ese código en el repo Andino.
