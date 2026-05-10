# Esquema de metadata y flujo de firma (Nelai)

Documento técnico complementario a `PLAN.md`: formato de metadata firmable y flujo de firma/verificación.

**Estándar de referencia:** El formato canónico de procedencia y autenticidad es **Content Credentials (C2PA)**. El stack y este esquema se alinean a C2PA (claim + assertions estándar); la identidad Polkadot se expresa como assertion custom `org.nelai.polkadot` para redundancia y resiliencia. Ver `CONTENT_CREDENTIALS_C2PA_VINCULACION.md`.

---

## 1. Objetivo

Cualquier documento o archivo creado en la app debe tener:

- **Metadata** en formato canónico (reproducible).
- **Hash del contenido** del archivo (si aplica).
- **Firma criptográfica** del hash de la metadata (con identidad Polkadot del usuario).
- **Persistencia** de `metadata + signature + publicKey` (y opcionalmente UAL/blockchain).

---

## 2. Esquema de metadata (borrador)

Este esquema es el modelo lógico que **mapea a assertions C2PA** (p. ej. `c2pa.hash.data`, `c2pa.metadata`, `c2pa.actions`); al generar manifiestos C2PA conformes, estos campos se expresan en el formato de la spec. Mientras tanto sirve como contrato para firma/verificación y como fallback (metadata externa o JSON junto al archivo).

Campos mínimos sugeridos para el objeto que se firmará:

```json
{
  "version": "1",
  "type": "document | photo | log_entry | departure_notice | emergency",
  "contentHash": "sha256:hex del contenido del archivo",
  "createdAt": "ISO8601",
  "author": "ss58_address o DID",
  "geolocation": { "lat": 0, "lon": 0 },
  "relatedIds": ["id_bitacora", "id_emergencia"],
  "mimeType": "image/jpeg",
  "filename": "nombre-original.ext"
}
```

- **Canonicalización:** Ordenar claves alfabéticamente y serializar JSON sin espacios (o usar JSON-LD con algoritmo de normalización) para que el mismo contenido siempre genere el mismo hash.
- **contentHash:** Si es un archivo binario, `SHA-256(blob)`; si es JSON (ej. entrada de bitácora), `SHA-256(JSON_canonical)`.

---

## 3. Flujo de firma (cliente)

1. Usuario crea/edita documento o sube archivo.
2. App construye objeto `metadata` según el esquema; calcula `contentHash` y lo asigna.
3. `payloadToSign = canonical(metadata)` → `hash = blake2b(payloadToSign)` (o sha256 si se prefiere compatibilidad).
4. Llamar keyring Polkadot: `sign(message: hash)` con la cuenta seleccionada.
5. Guardar:
   - `metadata`
   - `signature` (hex)
   - `publicKey` o `address` (para verificación posterior)
   - Opcional: `blockchain`, `blockNumber`, `txHash` si se ancla on-chain.

---

## 4. Flujo de verificación (Agente Verificador)

1. Input: archivo + metadata adjunta, o solo metadata + signature + publicKey (y opcionalmente UAL).
2. Recomputar `contentHash` del archivo y comparar con `metadata.contentHash`.
3. Reconstruir `payloadToSign = canonical(metadata)` y hash.
4. Verificar firma: `signatureVerify(hash, signature, publicKey)` (Polkadot.js crypto).
5. Si hay UAL: `dkg.asset.get(UAL)` y resumir assertions (autor, tipo, fechas) en el reporte.

---

## 5. Integración con Knowledge Assets (DKG)

Al publicar en OriginTrail, el payload del Knowledge Asset puede incluir:

- `@type`: p. ej. `CreativeWork` o tipo custom.
- Referencia al `contentHash` y autor (address).
- Fecha, tipo de recurso.
- **Público:** lo mínimo para que un tercero verifique que “este hash fue firmado por esta cuenta en esta fecha”.
- **Privado:** datos sensibles que solo el nodo del usuario almacene (opcional).

Así el Verificador puede, dado un UAL, decir “esta evidencia está anclada en DKG, firmada por X, integridad Y”.

---

## 6. Referencias de implementación (Polkadot.js)

- Keyring: `@polkadot/keyring`, `sign(message, { withType: true })`.
- Verificación: `@polkadot/util-crypto` / `signatureVerify`.
- Hashing: `@polkadot/util-crypto` blake2 o `crypto.subtle` SHA-256 en browser.

Este esquema se puede implementar en un módulo `metadata-signing` dentro del repo Andino o en Nelai.
