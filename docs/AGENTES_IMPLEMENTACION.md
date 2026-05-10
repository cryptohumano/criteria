# Implementación de agentes (Nelai)

Opciones concretas para el **Agente Guía** y el **Agente Verificador**, alineados con Track 2 y con uso mínimo de dependencias externas al inicio.

---

## 1. Agente Verificador (recomendado primero)

**Objetivo:** Dado un archivo + metadata + firma (o un UAL), devolver un reporte legible: dónde está la data, quién firmó, si la firma y el contentHash son válidos.

### 1.1 MVP sin LLM

- **Input:** Archivo (opcional) + JSON de metadata + signature + publicKey; o solo UAL.
- **Proceso:**
  1. Verificación criptográfica en cliente (signature + contentHash) como en `SCHEMA_METADATA_FIRMA.md`.
  2. Si hay UAL: `dkg.asset.get(UAL)` y parsear assertions (autor, tipo, fechas).
  3. Generar texto con **plantillas**: “La metadata fue firmada por la cuenta **{address}**. Integridad del contenido: **válida/no válida**. Datos on-chain: **sí/no**. DKG UAL: **{UAL o N/A}**.”
- **Salida:** Reporte en español, posiblemente con indicadores (verde/amarillo/rojo) según verificación e integridad.

### 1.2 Con LLM (opcional)

- Mismo input; se envía al backend (o a un proveedor con API key configurada en Andino) un resumen **sin PII**: tipo de recurso, resultado de verificación (ok/fail), presencia de UAL.
- El LLM devuelve un párrafo explicativo para el usuario.
- Ventaja: reporte más natural; desventaja: latencia y dependencia de API.

---

## 2. Agente Guía (“¿Qué va dónde?”)

**Objetivo:** Antes de que el usuario confirme “registrar on-chain” o “publicar en DKG”, explicar qué datos serán públicos, cuáles privados, riesgos de privacidad y qué implica la verificabilidad.

### 2.1 MVP con plantillas

- **Trigger:** Usuario está en el paso “Confirmar envío on-chain” o “Publicar en DKG”.
- **Input:** Tipo de acción + lista de campos que se enviarán (ej. `author`, `contentHash`, `createdAt`, `geolocation`).
- **Salida:** Texto fijo por tipo de acción, p. ej.:
  - “Al registrar on-chain, estos datos serán **públicos y permanentes**: tu dirección de cuenta, el hash del contenido y la fecha. Las coordenadas GPS pueden incluirse si las activaste; cualquiera podrá verlas en el explorador de la blockchain.”
  - “En DKG, la parte pública incluye… La parte privada queda solo en tu nodo…”
- Se puede tener un JSON de “tipos de acción” → “plantilla” y rellenar `{campos}`.

### 2.2 Con LLM (opcional)

- Mismo trigger; se envía al backend: `actionType`, `fieldsToPublish` (solo nombres, sin valores sensibles).
- Prompt del tipo: “Eres un asistente de confianza y seguridad digital. El usuario va a [acción]. Los campos que se publicarán son: [lista]. Explica en 2–3 frases qué va on-chain, qué queda off-chain, riesgos de privacidad y qué significa la verificabilidad.”
- Respuesta en español, tono claro y no alarmista.

---

## 3. Dónde vivirían en la app

- **Verificador:** Pantalla o modal “Verificar archivo / UAL”: el usuario pega metadata+signature o UAL, opcionalmente sube el archivo; el agente muestra el reporte.
- **Guía:** Modal o panel lateral en los flujos de “Firmar y registrar on-chain” y “Publicar en DKG”, justo antes del botón “Confirmar”, con el texto explicativo y un “Entendido” que cierra el modal y permite continuar.

---

## 4. API Keys (Andino)

Para LLM o gateway DKG:

- Almacenar en IndexedDB (cifrado como el resto de la wallet) una entrada por “servicio”: nombre, endpoint, API key (opcional).
- En tiempo de ejecución: leer la key del servicio “OpenAI” o “DKG Gateway” y usarla en las llamadas desde el cliente (o desde un backend propio que el usuario configure).
- Si el módulo de API Keys en Andino no está funcional, implementar un mínimo: formulario “Añadir servicio” → guardar en IndexedDB con la misma capa de cifrado que las cuentas.

---

## 5. Orden sugerido de implementación

1. **Verificador MVP** (solo verificación criptográfica + plantillas).
2. **Guía MVP** (plantillas por tipo de acción en los flujos existentes).
3. Integración **DKG** (publicar + obtener por UAL) y enlazar con el Verificador.
4. **API Keys** funcionales.
5. Opcional: conectar ambos agentes con LLM vía API key configurada.

Con esto se tiene una base sólida para el demo del hackathon y se puede iterar después sobre explicaciones más ricas o más automatización.
