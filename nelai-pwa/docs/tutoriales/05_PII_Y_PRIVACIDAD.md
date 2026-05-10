# PII y privacidad (por qué existe el flujo)

## ¿Qué es PII?

PII (Personally Identifiable Information) es información sensible o identificable, por ejemplo:

- correos, teléfonos
- direcciones, IDs
- RFC/CURP (MX), cuentas bancarias
- cualquier dato que no debe salir a servicios externos

## ¿Por qué CriterIA tiene un flujo PII?

El Agente puede usar **LLMs externos** (por ejemplo Gemini u otros proveedores).  
Aunque el backend minimiza riesgos, la mejor práctica es:

> **No enviar datos sensibles a modelos externos** si no es estrictamente necesario.

Por eso CriterIA incluye un flujo PII que:

- detecta patrones sensibles
- reemplaza por placeholders `[CRITERIA_*]`
- permite aplicar redacción al documento antes de usar el Agente

## Flujo recomendado

1. En el editor, abre la pestaña **PII**.
2. Ejecuta **Escanear PII**.
3. Revisa coincidencias.
4. Aplica la redacción al documento.
5. Ahora usa el **Agente** con menor riesgo de filtrar datos.

## ¿Qué hacen los placeholders `[CRITERIA_*]`?

Son sustituciones opacas. El LLM verá tokens como:

- `[CRITERIA_EMAIL_001]`
- `[CRITERIA_PHONE_002]`

El agente debe respetarlos y no intentar “adivinar” el valor real.

