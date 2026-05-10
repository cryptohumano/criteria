# Flujo del usuario y zonas de código (Nelai en Andino Wallet)

Documento de referencia: qué hace el usuario y en qué archivos/partes del código de Andino Wallet se trabaja para el Paso 1 (firma de metadata para evidencias). La capa Nelai usa **nombres genéricos** (evidencia, contenido firmado, verificación); ver `ESTRATEGIA_GENERALIZACION_NELAI.md`.

---

## 1. Flujo del usuario (evidencias en bitácora)

1. **Entrada:** El usuario abre una bitácora de montaña (activa o histórica) desde la lista → entra a **detalle de bitácora** (`MountainLogDetail`).
2. **Milestones:** La bitácora tiene uno o más **milestones** (checkpoint, campamento, cumbre, foto, etc.). Cada milestone puede llevar **imágenes** (y en históricas, también **archivos**).
3. **Añadir imagen:**
   - El usuario hace clic en **agregar imagen** en un milestone (botón que abre el diálogo “Agregar Imagen al Milestone”).
   - En el diálogo elige:
     - **Desde archivo:** se abre el selector de archivos (o cámara en móvil con `capture="environment"`). Al elegir/capturar, se procesa el archivo y se guarda la imagen en el milestone.
     - **Capturar con cámara:** se captura una foto (getUserMedia o similar), se convierte a base64 y se procesa igual.
4. **Guardado actual:** La app construye un objeto `MountainLogImage` (id, data base64, thumbnail, metadata con filename, mimeType, size, capturedAt, gpsMetadata), lo añade al array `milestone.images`, actualiza la bitácora en estado y llama a `saveMountainLog(updatedLog)` (IndexedDB).
5. **Lo que añade Nelai (Paso 1):** Tras crear ese `MountainLogImage` (y antes o justo al guardar), se calcula `contentHash` del blob, se construye metadata canónica (mapeable a C2PA) y se firma con la cuenta Polkadot activa. Se guarda en la imagen `signedMetadata` (o equivalente). Opcionalmente se muestra “Firmar con mi cuenta” o se firma automáticamente al añadir.

**Resumen del flujo:** Bitácora → Detalle → Milestone → “Agregar imagen” (archivo o cámara) → procesar imagen → **[NUEVO: firmar metadata]** → guardar bitácora.

---

## 2. Partes de código donde se trabaja

| Área | Archivo / ubicación | Qué se hace hoy | Qué haremos (Nelai) |
|------|---------------------|------------------|----------------------|
| **Tipos** | `nelai-pwa/src/types/mountainLogs.ts` | `MountainLogImage` tiene `id`, `data`, `thumbnail`, `metadata` (filename, mimeType, size, capturedAt, gpsMetadata). `MountainLogFile` tiene id, name, type, data, size, uploadedAt. | Añadir campos opcionales: `contentHash?: string`, `signedMetadata?: { metadata, signature, signer }` (o tipo dedicado) a ambos. |
| **Creación de imagen (archivo)** | `nelai-pwa/src/pages/MountainLogDetail.tsx` | `handleImageFile`: lee el archivo, obtiene GPS, crea `MountainLogImage`, actualiza log, `saveMountainLog`. Creación de imagen ~líneas 1049–1061. | Después de crear el objeto `image`, llamar al módulo de firma con el blob/data y la cuenta activa; asignar `contentHash` y `signedMetadata` a `image` antes de hacer `updatedLog` y guardar. |
| **Creación de imagen (cámara)** | `nelai-pwa/src/pages/MountainLogDetail.tsx` | `processImageFromBase64`: recibe dataUrl y milestoneId, crea `MountainLogImage`, actualiza log, `saveMountainLog`. Creación de imagen ~líneas 775–788. | Igual: tras construir `image`, llamar al módulo de firma (pasando dataUrl/blob), asignar `contentHash` y `signedMetadata` a `image` antes de guardar. |
| **Persistencia** | `nelai-pwa/src/utils/mountainLogStorage.ts` | `saveMountainLog(log)` guarda el objeto completo en IndexedDB; no hay esquema aparte. | Sin cambios de API; los nuevos campos van dentro de `MountainLogImage` / `MountainLogFile`. |
| **Módulo nuevo** | `nelai-pwa/src/services/nelai/` (ej. `evidenceSigning.ts`) | No existe. | Crear módulo **genérico**: `signEvidenceMetadata(blob, authorAddress, keyringPair, options)` → `{ contentHash, signedMetadata }`. Nombres genéricos (evidencia, no "mountain"). Reutilizar patrón de `SubstrateSigner` / keyring. |
| **Cuenta activa** | Uso del keyring en Andino | En otros flujos se usa la cuenta seleccionada (p. ej. documentos). | Obtener la cuenta activa (mismo patrón que en firma de documentos) para pasar al módulo de firma. |

No se ha encontrado en el código actual un flujo de UI que añada `MountainLogFile` a un milestone (solo está el tipo y `files?: MountainLogFile[]` en el milestone). El **Paso 1** se puede hacer solo para **imágenes**; el mismo módulo de firma servirá después para archivos cuando exista ese flujo.

---

## 3. Orden de implementación sugerido (Paso 1)

1. **Tipos** (`mountainLogs.ts`): extender `MountainLogImage` (y opcionalmente `MountainLogFile`) con `contentHash?` y `signedMetadata?`.
2. **Módulo de firma** (nuevo): construir metadata canónica, contentHash, firma Polkadot; exportar función tipo `signEvidenceMetadata(blob, authorAddress, keyringPair, options?)` → `{ contentHash, signedMetadata }`.
3. **Integración en `MountainLogDetail.tsx`:**  
   - En `processImageFromBase64`: después de crear `image`, obtener cuenta activa y blob (desde dataUrl), llamar al módulo de firma, asignar `image.contentHash` y `image.signedMetadata`, luego seguir con `updatedLog` y `saveMountainLog`.  
   - En `handleImageFile`: igual en el camino donde se construye `image` (dentro del `reader.onload` / `img.onload`), antes de `updatedLog` y guardar.
4. **(Opcional para MVP)** UI explícita “Firmar con mi cuenta” (botón o checkbox) en lugar de firmar siempre automáticamente; por simplicidad el primer entregable puede ser “firmar siempre al añadir imagen”.

Con esto el flujo del usuario sigue igual (añadir imagen desde archivo o cámara); la diferencia es que cada imagen queda con metadata firmada y contentHash para el Verificador y para futura alineación C2PA.
