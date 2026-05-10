# Diseño: sanitización contractual (México) + PII estructural

Este documento define cómo conviven **dos familias de detección** antes de enviar texto al LLM, sin confundir “plantilla legal” con “PII clásico” (CURP, correo, etc.).

## 1. Objetivos

| Objetivo | Descripción |
|----------|-------------|
| O1 | Reducir **datos sensibles en contexto** (montos, folios, escrituras, huecos de borrador) en instrumentos **tipo México**. |
| O2 | Mantener **PII por formatos** (email, teléfono, IBAN ES, DNI/NIE, RFC, CURP) como primera línea, ya implementada. |
| O3 | Dejar trazabilidad **original → placeholder** (`NELAI_*`) en UI y en `privacySubstitutions` del mensaje. |
| O4 | Permitir **evolución por “packs”** de reglas (por familia de contrato) sin reescribir todo el agente. |

## 2. No-alcance (explícito)

- No sustituye **revisión jurídica** ni cumplimiento normativo.
- No pretende **NER** de nombres propios en prosa en la v0 (alto coste de falsos positivos/negativos).
- No define aún un **catálogo formal de tipos de contrato** en producto; la v0 usa un **pack genérico MX** activable por flag.

## 3. Arquitectura en capas

```text
Texto (PDF / editor / mensaje)
        │
        ▼
┌───────────────────────────────┐
│ Capa A: PII estructural       │  email, teléfono, IBAN, DNI/NIE, RFC, CURP
│ (piiDetect.ts — existente)    │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│ Capa B: Contrato MX (v0)      │  montos M.N., marcadores de borrador,
│ (contractMxDetect.ts)        │  escritura/folio (regex conservadoras)
└───────────────────────────────┘
        │
        ▼
  mergeOverlapping (una sola pasada)
        │
        ▼
  anonymizePlainText / anonymizeDocAndMessage
```

- **Un solo merge de solapes** al final evita duplicar placeholders en regiones superpuestas.
- **Tipos (`PiiKind`)** amplían el enum: `AMOUNT_MXN`, `CONTRACT_SLOT`, `ESCRITURA_REF`, `REGISTRY_FOLIO` (nombres orientados a auditoría, no a taxonomía legal formal).

## 4. Modelo de datos (evolución)

### 4.1 Hoy (v0)

- Reglas **fijas en código** en `contractMxDetect.ts`, agrupadas y documentadas con comentarios.
- Activación global: `VITE_CONTRACT_MX_REDACT` (`false` desactiva la capa B).

### 4.2 Futuro (v1+)

- **`ContractRulePack`**: `{ id, version, locale: 'es-MX', rules: ContractRule[] }`.
- **`ContractRule`**: `{ id, kind, pattern, flags, description, priority?, contractFamilies?: string[] }`.
- Packs ejemplo: `hipotecario-basico`, `laboral-sindical`, `arrendamiento` (solo metadatos hasta que existan reglas revisadas por negocio).

Los packs pueden **apilar**: genérico MX + pack familia; el merge respeta prioridad y longitud de match.

## 5. Reglas v0 (pack genérico MX)

Implementadas de forma conservadora; se amplián según feedback jurídico.

| `kind` | Intención | Ejemplo de patrón (idea) |
|--------|-----------|---------------------------|
| `AMOUNT_MXN` | Monto en pesos con leyenda típica | `$… (… M.N.)`, variantes con `pesos` y `/100` |
| `CONTRACT_SLOT` | Huecos de borrador muy frecuentes | `Nombre entidad`, `EL nombre`, `LA nombre`, `Nombre notario` |
| `ESCRITURA_REF` | Referencia a escritura y número | `Escritura Pública número …` |
| `REGISTRY_FOLIO` | Folio electrónico RPP | `folio electrónico número …` (variantes con/sin tilde en “electrónico”) |

**Ajuste fino**: si un patrón genera demasiados falsos positivos en corpus real, se estrecha o se mueve a un pack específico, no al genérico.

## 6. UI / UX

- Mismo **diálogo de revisión** y **pestaña Privacidad**: las nuevas filas aparecen con su `kind` y el texto original sustituido.
- En el diálogo, el usuario puede **desmarcar filas** para no aplicar esa sustitución; la **vista previa sanitizada** se recalcula al instante (PDF y envío al LLM).
- Mensajes vacíos de capa B: el aviso existente (“sin coincidencias de patrones”) sigue siendo válido para **ambas** capas agregadas.

## 7. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Falso positivo en “EL nombre” fuera de contrato | Patrones acotados a formas típicas de minuta; revisión en packs sectoriales. |
| Sustituir montos rompe análisis del modelo | Opcional futuro: “solo marcar, no sustituir” por tipo `AMOUNT_MXN` en ajustes de usuario. |
| Sobreposición con RFC | El merge conserva el match más largo / reglas de prioridad en v1. |

## 8. Roadmap sugerido

1. **v0 (actual)**: capa B genérica + flag `.env`.
2. **v1**: packs JSON/YAML cargados por tipo de documento seleccionado en UI.
3. **v2**: integración opcional con **modelo NER** o API externa para nombres/domicilios (con coste y revisión humana).

## 9. Referencias

- Flujo general privacidad / LLM: `docs/LLM_PRIVACY_PII_FLOW.md`.
- Código: `src/services/privacy/piiDetect.ts`, `contractMxDetect.ts`, `piiAnonymize.ts`.
