# Integración Andino Wallet + OriginTrail DKG (Nelai)

Puntos de enlace entre la base Andino y el DKG para firma, trazabilidad y verificación.

---

## 1. Qué aporta cada uno

| Capa | Andino Wallet PWA | OriginTrail DKG |
|------|-------------------|------------------|
| Identidad / Firma | Keyring Polkadot (sr25519/ed25519), dirección SS58 | No reemplaza; usamos la misma identidad como “autor” en Knowledge Assets |
| Persistencia local | IndexedDB, bitácoras, documentos, fotos | No; DKG es publicación opcional |
| Inmutabilidad | Firma local; opcional anclar tx on-chain (Polkadot) | Knowledge Assets con UAL (replicación en nodos) |
| Verificación por terceros | Verificar firma con publicKey + metadata | Cualquiera con UAL puede `asset.get(UAL)` y ver assertions públicas |
| Trazabilidad | Avisos de salida, emergencias en chain | Provenance en grafo (JSON-LD, Schema.org) |

---

## 2. Flujo propuesto

### 2.1 Crear contenido en Andino

1. Usuario crea documento / sube foto / registra entrada de bitácora.
2. **Siempre:** se genera metadata canónica y se firma con keyring (ver `SCHEMA_METADATA_FIRMA.md`).
3. Se guarda en IndexedDB: contenido + metadata + signature + publicKey.

### 2.2 Publicar en DKG (opcional)

1. Usuario elige “Proteger en DKG” o “Publicar evidencia”.
2. **Agente Guía** explica qué se publicará (p. ej. contentHash, autor, fecha; no el archivo completo).
3. App construye un Knowledge Asset (JSON-LD):
   - Public: `@type`, autor (address), `contentHash`, fecha, tipo de recurso.
   - Private (opcional): datos sensibles que solo guarda el nodo del usuario.
4. Cliente usa **dkg.js** contra un gateway DKG (configurado por API key o endpoint en Andino).
5. Se recibe UAL; se guarda en la entrada local del documento (ej. `metadata.dkgUAL`).
6. Cualquier tercero con el UAL puede verificar vía `dkg.asset.get(UAL)`.

### 2.3 Verificar contenido recibido (Agente Verificador)

1. Usuario recibe un archivo + metadata + firma, o solo un UAL.
2. Si hay metadata + firma: verificación criptográfica en cliente (firma + contentHash).
3. Si hay UAL: `dkg.asset.get(UAL)` y resumir assertions (autor, tipo, fechas).
4. Reporte unificado: “Dónde está la data, quién firmó, integridad, riesgos”.

---

## 3. Configuración técnica

- **dkg.js** en el frontend (Andino ya usa Vite/React); conexión a gateway DKG (local o hospedado).
- **Blockchain en DKG:** según [docs](https://docs.origintrail.io/dkg-v6-current-version/dkg-sdk/dkg-v6-js-client), opciones mainnet/testnet/devnet (Base, Gnosis, Neuroweb). Para hackathon puede usarse testnet/devnet.
- **Claves:** En browser, dkg.js puede usar MetaMask u otra wallet; para mantener una sola identidad, idealmente usar la misma cuenta Polkadot vía keyring para firmar la metadata, y si hace falta una wallet EVM para las tx del DKG, documentar que el usuario puede usar la misma dirección (si tiene equivalente EVM) o una dedicada.
- **API Keys (Andino):** Almacenar endpoint del gateway DKG y, si aplica, API key para un OT-Node hospedado, usando el módulo de API Keys (por implementar o completar en Andino).

---

## 4. Privacidad

- **On-chain (Polkadot):** Lo que Andino ya envía (emergencias, etc.); el Guía debe explicar qué es público.
- **DKG público:** Solo hashes, autor (address), fechas y tipo; sin coordenadas ni PII en assertions públicas salvo que el usuario lo acepte explícitamente.
- **DKG privado:** Datos sensibles en assertions privadas; solo el nodo que publicó los tiene; el Verificador solo podrá resumir lo que esté en público o lo que el usuario tenga acceso.

---

## 5. Próximos pasos

1. Levantar Andino localmente y localizar dónde se firma y dónde están las API keys.
2. Añadir dependencia `dkg.js` y un módulo `dkg-publish` que, dado metadata + firma, cree el Knowledge Asset y devuelva el UAL.
3. En la UI: botón “Proteger en DKG” en documentos/evidencias y flujo de Verificador con campo UAL.
4. Documentar en README de Nelai/Andino el uso de testnet DKG y la configuración del gateway.
