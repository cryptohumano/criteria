# Base de conocimiento — Agente CriterIA (ElizaOS)

> **Uso con ElizaOS:** coloca este archivo en la carpeta `docs/` del proyecto del agente
> (o súbelo vía `@elizaos/plugin-knowledge`) y activa `LOAD_DOCS_ON_STARTUP=true`.
> El agente debe responder **principalmente en español**, con tono claro, profesional y no alarmista.

**Alcance de esta base:** documentos legales y académicos, editor colaborativo, agente de redacción, PII, firma y bitácora de fuentes. **No incluye** funcionalidades de emergencias, montañismo, avisos de salida, bitácoras de campo ni flujos on-chain de rescate.

---

## 1. Qué es CriterIA

CriterIA es una plataforma PWA para **co-crear documentos legales y académicos verificables**, asistida por agentes LLM y firmada con identidad criptográfica.

**Propósito principal:**
- Editor colaborativo (Etherpad) embebido en la misma aplicación.
- Asistente de redacción y revisión con flujo *proponer → revisar → aplicar*.
- Documentos con procedencia verificable: firma C2PA (PDF en servidor) + firma Substrate/Polkadot en el cliente.
- Protección de privacidad: redacción de PII por patrones antes de enviar texto al LLM.
- **Bitácora de fuentes** por documento: registro local de URLs y consultas web del agente, con anclaje para reutilizar fuentes en el chat.
- Modelo SaaS B2B/B2C con cuotas de tokens LLM por plan.

**Lo que CriterIA NO es:**
- No sustituye asesoría legal profesional; el agente legal es orientativo.
- No garantiza ausencia total de datos personales en envíos al LLM (la detección es heurística).
- No es un servicio de custodia de claves: las claves privadas viven en el dispositivo del usuario.

---

## 2. Conceptos clave para el usuario

| Concepto | Descripción |
|----------|-------------|
| **Sesión de plataforma (SaaS)** | Login de organización; acceso a documentos, agente, facturación. |
| **Llave local (Substrate keyring)** | Claves criptográficas en el navegador, cifradas en IndexedDB. Necesarias para firmar. |
| **Almacén bloqueado** | Tras recargar la página, las claves privadas no están en memoria hasta desbloquear. |
| **Pad / documento** | Sesión de Etherpad asociada a un documento; edición colaborativa en tiempo real. |
| **Perfil del agente** | Modo de asistencia: Académico, Legal MX o Creador de contenido. |
| **PII / redacción** | Sustitución de datos sensibles por placeholders antes del LLM. |
| **Firma local** | Firma criptográfica del hash de metadata con cuenta Substrate del usuario. |
| **C2PA** | Estándar Content Credentials para procedencia en PDFs (servidor). |
| **DKG / UAL** | Publicación opcional en OriginTrail Decentralized Knowledge Graph; identificador UAL (documentos firmados). |
| **Bitácora de fuentes** | Registro por documento de URLs y consultas web usadas o citadas en el chat del agente; almacenamiento local (IndexedDB). |

---

## 3. Flujos de usuario habituales

### 3.1 Inicio rápido

1. Iniciar sesión en la plataforma (email/contraseña o Google OAuth).
2. Si aparece **«Llave local bloqueada»**, pulsar **Desbloquear** (WebAuthn o contraseña local del vault).
3. Ir a **Documentos → Crear documento**.
4. Editar en el editor colaborativo (Etherpad).
5. Opcional: ejecutar panel **PII**, aplicar redacción, usar el **Agente**, exportar Markdown o firmar.

### 3.2 Desbloquear la llave local

- **WebAuthn (recomendado):** huella, rostro o PIN del dispositivo (Windows Hello, Touch ID, etc.).
- **Contraseña local:** cifra el vault en el navegador; **no es** la contraseña del login SaaS.
- Tras recargar la pestaña o reiniciar el navegador, el almacén vuelve a bloquearse por seguridad.
- La frase de recuperación está en **Configuración → Seguridad → Frase de recuperación** (con verificación).

### 3.3 Crear e importar cuentas Substrate

- **Crear cuenta:** Cuentas → Crear, o asistente al abrir un documento.
- **Importar:** mnemonic (12/24 palabras), URI/seed o JSON Polkadot.js.
- Todas las cuentas del mismo dispositivo comparten el mismo tipo de protección del vault.

### 3.4 Editor colaborativo (Etherpad)

- Edición en tiempo real, headings, tabla de contenidos, fórmulas LaTeX.
- Corre en iframe **same-origin** (mismo dominio que la API) para evitar bloqueo de cookies.
- Botón **Exportar Markdown** descarga el contenido actual del pad como `.md`.

### 3.5 Agente de redacción (flujo recomendado)

1. Escanear y aplicar **PII** si el documento contiene datos sensibles.
2. Elegir **perfil del agente** (Académico / Legal MX / Creador).
3. Pedir reescritura, checklist, análisis o propuestas de cambio.
4. Revisar propuestas con formato `[MODIFICAR]…[/MODIFICAR]` y `[POR]…[/POR]`.
5. Aplicar cambios al pad cuando el usuario confirme.
6. Opcional: abrir **Bitácora de fuentes** para revisar enlaces y consultas web registradas; **anclar** fuentes (pin) para priorizarlas en el siguiente mensaje al agente.

### 3.6 Bitácora de fuentes (resumen operativo)

1. Trabajar en el editor con el panel **Asistente IA** (editor Quill o Etherpad).
2. Enviar preguntas; si el modelo usa **Gemini** con búsqueda web habilitada, las citas y consultas pueden registrarse automáticamente.
3. Abrir el modal **Bitácora de fuentes** (icono de marcador en la barra del editor).
4. Revisar columnas **Enlace**, **Consultas web**, **Prompt** (mensaje que originó la entrada) y añadir **Tu nota** si hace falta.
5. Marcar con el **pin** las fuentes que quieras reutilizar; el asistente las recibe en el contexto del siguiente mensaje (hasta 12).
6. **Exportar JSON/CSV** para archivo o auditoría; **Importar JSON** para fusionar entradas sin duplicar `id`.

---

## 4. Perfiles del agente

Cada documento guarda el perfil en metadata (tags `agent:*`).

### Académico (`academic_es`)

**Útil para:** ensayos, protocolos, revisiones de literatura, metodología, discusión.

**Reglas:**
- No inventar citas, datos ni referencias bibliográficas.
- Priorizar estructura, claridad y rigor académico.
- Si hay búsqueda web disponible (Gemini), incluir sección **FUENTES** con enlaces verificables; esas URLs alimentan la **bitácora de fuentes** del documento.
- En análisis completo, puede incluir bloque `[SCORE_LEGAL]` interpretado como **calidad académica** (1–100, nivel ALTO|MEDIO|BAJO).

### Legal MX (`legal_mx`)

**Útil para:** contratos, revisión legal con enfoque México, cláusulas, riesgos, cumplimiento.

**Conocimiento orientativo:** Código Civil Federal, Código de Comercio, LFT, LGSM, LFPC, LFPDPPP, NOM, jurisprudencia SCJN.

**Reglas:**
- Responder en español, tono profesional.
- Citar artículos con precisión cuando sea posible; si hay duda, recomendar consultar abogado.
- En análisis de documento/PDF, el bloque `[SCORE_LEGAL]` es **obligatorio al inicio** de la respuesta.
- Evaluar: validez formal, cláusulas abusivas, cumplimiento MX, LFPDPPP si hay datos personales, jurisdicción.
- Con búsqueda web (Gemini), incluir sección **FUENTES** con URLs; se registran en la bitácora del documento.

### Creador de contenido (`creator_es`)

**Útil para:** redes, newsletter, blog, guiones, titulares, CTAs.

**Reglas:**
- Adaptar formato al canal (YouTube, TikTok, LinkedIn, etc.).
- No inventar métricas, citas ni estudios inexistentes.
- Usar `[COMPLETAR: dato]` cuando falte información.

### Cambiar perfil

En el editor del documento: selector **Perfil del agente**. El cambio se persiste en la metadata del documento.

---

## 5. Privacidad y PII

### Objetivo

Evitar enviar datos personales identificables (PII) en claro al modelo LLM cuando el origen es PDF, texto del documento o mensaje del usuario.

### Patrones detectados (heurísticos)

Correo electrónico, teléfono, RFC/CURP (México), DNI/NIE, IBAN tipo ES, y variantes configuradas. Existe capa adicional opcional para contratos MX (`VITE_CONTRACT_MX_REDACT`).

### Placeholders

- Formato actual: `[CRITERIA_<TIPO>_NNN]` (ej. `[CRITERIA_EMAIL_001]`).
- Legacy compatible: `[NELAI_*]`.
- El agente debe tratarlos como **referencias opacas**: no deducir ni restaurar el dato real.
- `MANUAL`: sustitución hecha por el usuario.
- Al proponer ediciones, **respetar** los tokens salvo petición explícita del usuario.

### Limitaciones importantes (comunicar con claridad)

- PDF escaneados u OCR de baja calidad pueden no extraer texto útil.
- Puede haber falsos positivos y falsos negativos (nombres propios sin patrón).
- La redacción **no sustituye** revisión humana ni cumplimiento legal.
- Los placeholders son deterministas por orden de aparición en cada análisis.

### Flujo antes del LLM

1. Usuario adjunta PDF o escribe en el editor.
2. Detección de PII en cliente.
3. Diálogo de revisión (original vs placeholder).
4. Solo tras confirmación se envía texto sanitizado al modelo.
5. El PDF binario no se reenvía si el contenido relevante ya va como texto sanitizado.

---

## 5.5 Bitácora de fuentes (trazabilidad de investigación)

La **bitácora de fuentes** ayuda a **auditar y reutilizar** enlaces consultados o citados durante el trabajo con el agente. Complementa (no sustituye) la verificación humana y la firma C2PA/Substrate del documento final.

### Qué registra automáticamente

Por cada documento, entradas **append-only** (`researchEvidenceLog`) con, entre otros:

| Campo / idea | Descripción |
|--------------|-------------|
| **URL** | Enlace http(s), DOI o destino detectado en el chat o en citas de grounding. |
| **Consultas web** | Lista `webSearchQueries` cuando **Gemini** devuelve consultas de búsqueda en `groundingMetadata` (no todos los modelos ni todos los turnos). |
| **Prompt** | `indexedFromUserPrompt`: mensaje del usuario que disparó la respuesta con fuentes. |
| **Referencia** | `snippet`: línea o contexto donde apareció el enlace en la respuesta. |
| **Origen** | `user_message`, `assistant_message`, `user_attachment`, `document_scan`, o `grounding_queries` (solo consultas web sin URL externa en ese turno). |
| **Msg** | `chatHistoryIndex`: correlación con el hilo del agente. |
| **Tu nota** | Comentario editable por el usuario (`userComment`). |

### Dónde vive y cómo se guarda

- **Almacenamiento:** **local en el dispositivo** (IndexedDB, junto al documento). **No** se replica hoy en PostgreSQL del servidor SaaS.
- **Antes del primer guardado:** la bitácora puede acumularse en `sessionStorage` y fusionarse al crear el documento.
- **Editores:** panel del agente en **editor Quill** (`DocumentEditor`) y en **Etherpad** (`DocumentEditorEtherpad`).

### Búsqueda web (Gemini grounding)

- Con **Gemini** y **sin adjuntos de archivo** en ese mensaje, la app solicita `google_search` al proxy LLM.
- Las URLs de `groundingChunks` / `citationMetadata` y las **consultas** de `webSearchQueries` se extraen y guardan cuando el proveedor las envía.
- Si la búsqueda falla o se desactiva (otro proveedor, adjuntos, cuota, fallback), la bitácora solo refleja lo que aparezca en el texto (enlaces del usuario o del asistente).

### Reutilizar fuentes (anclar)

- En la tabla de la bitácora, el usuario marca fuentes con el **pin** (`pinnedResearchEvidenceIds`, máximo **12** por documento).
- En el **siguiente mensaje** al agente, el sistema inyecta un bloque de contexto del tipo: *«Fuentes ancladas por el usuario (priorízalas…)»* con título, URL y fragmento.
- El badge del panel del asistente muestra cuántas fuentes están ancladas.

### Exportar e importar

- **Exportar JSON / CSV** desde el modal de bitácora (mismo esquema de campos, incluido `webSearchQueries`).
- **Importar JSON:** fusiona entradas por `id` sin duplicar; útil para respaldos o combinar bitácoras de otro dispositivo manualmente.

### Mensaje honesto para marketing y Learn (usar tal cual o adaptar)

> CriterIA registra en una **bitácora por documento** los enlaces y, cuando Gemini lo permite, las **consultas web** asociadas a cada interacción con el asistente. Puedes revisarlas, anotarlas, exportarlas y **anclar** fuentes para que el agente las priorice en turnos siguientes. La bitácora **facilita la verificación y la citación**; **no garantiza** que toda afirmación del modelo sea correcta ni sustituye el criterio del investigador o del abogado.

### Lo que la bitácora **no** hace (importante para soporte y artículos)

- **No** indexa una «base de conocimiento interna» propia del usuario (no hay RAG sobre la biblioteca de PDFs aún).
- **No** guarda en servidor multi-dispositivo por defecto (sin sync en la nube del tenant).
- **No** muestra el razonamiento completo del LLM; solo señales observables (texto, grounding de Gemini).
- **No** genera citas **APA/MLA/Chicago** formateadas automáticamente; ayuda con URLs, títulos inferidos y contexto.
- **No** elimina alucinaciones: un enlace en la bitácora no certifica que el párrafo sea fiel a la fuente.

### Relación con otros conceptos

| Concepto | Relación |
|----------|----------|
| **C2PA / firma Substrate** | Procedencia del **archivo firmado**; la bitácora es trazabilidad del **proceso de investigación** en el chat. |
| **PII** | Independiente: la bitácora no restaura placeholders ni sustituye redacción de datos personales. |
| **`/api/docs/.../agent/run` (Etherpad servidor)** | Endpoint de propuestas sobre el pad; el registro completo de fuentes del producto está en la **PWA** (agente + bitácora), no en ese stub de servidor. |

---

## 6. Formato de propuestas del agente (edición aplicable)

Para cambios que el usuario aplique con un clic:

```
[MODIFICAR]texto antiguo exacto[/MODIFICAR]
[POR]nuevo texto[/POR]
```

- El texto en `[MODIFICAR]` debe coincidir **literalmente** con el documento.
- Contenido nuevo insertable: `[CONTENIDO]…[/CONTENIDO]`.
- Eliminar: `[POR][/POR]` vacío.
- No mezclar comentarios conversacionales dentro de `[CONTENIDO]`.

### Bloque de puntuación (análisis)

```
[SCORE_LEGAL]
puntuación: <1-100>
nivel: <ALTO|MEDIO|BAJO>
resumen: <1-2 líneas>
riesgos: <lista separada por |>
[/SCORE_LEGAL]
```

Obligatorio al **inicio** del primer análisis de documento/PDF en modo Legal MX (y equivalente en otros perfiles según contexto).

---

## 7. Firma, verificación y anclaje

### Metadata firmable (esquema lógico)

Campos típicos: `version`, `type` (p. ej. `document`), `contentHash` (sha256), `createdAt` (ISO8601), `author` (dirección ss58), `mimeType`, `filename`.

### Flujo de firma (cliente)

1. Construir metadata canónica y calcular `contentHash`.
2. Firmar hash con keyring Substrate (sr25519/ed25519).
3. Guardar metadata + signature + publicKey localmente.
4. Opcional: publicar en DKG (Knowledge Asset) para verificación pública del hash y autor.

### Estándares

- **C2PA:** procedencia en PDFs firmados en servidor (`@contentauth/c2pa-node`).
- **Polkadot:** assertion custom `org.nelai.polkadot` en manifiestos.
- **DKG:** Knowledge Assets en OriginTrail; verificación por UAL.

### Agente Verificador (concepto de producto)

Dado archivo + metadata + firma, o solo UAL:
- Verificar integridad (`contentHash`) y firma criptográfica.
- Si hay UAL, consultar DKG y resumir assertions.
- Reporte en español con indicadores válido / no válido / parcial.

---

## 8. Agente Guía (privacidad antes de acciones sensibles)

Antes de confirmar acciones irreversibles o públicas, la app muestra un modal explicativo. El usuario debe pulsar **Entendido** para continuar.

| Acción | Qué se explica |
|--------|----------------|
| **Publicar en DKG** | Dirección de cuenta, hash del contenido y fecha serán públicos y permanentes en el grafo. El archivo original queda en el dispositivo. Cualquiera con el UAL puede verificar autenticidad. |
| **Firmar documento** | Se asocian autor, hash y fecha de forma verificable; la firma se guarda localmente; publicar en DKG es un paso posterior opcional. |

**Campos que suelen ser públicos en DKG:** `author`, `contentHash`, `createdAt`.

**Riesgo de privacidad:** lo publicado en DKG es permanente; el hash no revela el texto del documento, pero sí prueba que existió y quién lo firmó.

---

## 9. Planes y facturación (SaaS)

La **única cuota medida** del producto son los **tokens LLM** por organización en el periodo del plan. Los documentos/pads de Etherpad son ilimitados.

| Plan | Usuarios máx. | Tokens / periodo | Periodo |
|------|---------------|------------------|---------|
| **Trial** | 1 | 50 000 | Quincena (15 días desde creación de org) |
| **Starter** | 5 | ~2 000 000 | Mes |
| **Pro** | 20 | ~10 000 000 | Mes |
| **Enterprise** | Ilimitado (0 = sin tope) | Negociado | Mes |

- Cobro vía **Stripe** (checkout, webhook, customer portal).
- Add-ons de referencia: paquete extra de tokens (~2M por ~10 USD), usuario adicional (~5–10 USD).
- El proxy LLM usa `GEMINI_API_KEY` en servidor (modo SaaS) o BYOK del usuario según configuración.

---

## 10. Arquitectura técnica (referencia para soporte)

| Capa | Tecnología |
|------|------------|
| Frontend | Vite, React 18, TypeScript, Tailwind, PWA |
| Editor colaborativo | Etherpad 2.7 (Docker) + Quill (vistas no colaborativas) |
| Backend | Express 5, Prisma 7, PostgreSQL |
| LLM | Google Gemini vía `/api/llm-proxy` |
| Auth | Email/contraseña, Google OAuth, JWT en BD |
| Cripto cliente | `@polkadot/util-crypto`, keyring en IndexedDB |
| Despliegue | Docker Compose (dev), Railway (prod: API + Etherpad + 2 Postgres) |

**Endpoints relevantes:**
- `/api/auth/*` — autenticación
- `/api/docs/:docId/agent/run` y `agent/apply` — agente sobre el pad
- `/api/llm-proxy` — proxy Gemini
- `/api/c2pa-sign` — firma C2PA en PDF
- `/api/billing/*` — planes y Stripe
- `/pad`, `/socket.io` — reverse-proxy a Etherpad (mismo origen)

---

## 11. Preguntas frecuentes (FAQ)

**No puedo crear documentos después de recargar**  
→ El almacén local está bloqueado. Usar el banner **Desbloquear**.

**Me pide crear cuenta cuando ya tenía cuentas**  
→ Vault bloqueado, IndexedDB restringido (incógnito) o permisos del navegador. Desbloquear o probar ventana normal.

**Warnings de traducción en consola (Etherpad)**  
→ Avisos de i18n de plugins; no afectan el funcionamiento.

**¿El agente legal es un abogado?**  
→ No. Es asistencia orientativa; decisiones legales requieren profesional titulado.

**¿Qué pasa si agoto los tokens?**  
→ Las interacciones con el agente LLM se limitan hasta renovación del periodo o upgrade de plan / compra de paquete extra.

**¿Dónde están mis claves privadas?**  
→ Solo en tu dispositivo (IndexedDB cifrado). CriterIA no las almacena en servidores.

**¿Puedo verificar un documento sin la app?**  
→ Con metadata + firma + archivo, o con UAL en DKG, usando herramientas de verificación criptográfica compatibles.

**¿Qué es la bitácora de fuentes y dónde se guarda?**  
→ Es el registro local (IndexedDB) de URLs y, si Gemini lo reporta, consultas web del agente por documento. Ábrela desde el icono de marcador en el editor. Exporta JSON/CSV; usa el pin para priorizar fuentes en el siguiente mensaje.

**¿La bitácora evita que la IA invente referencias?**  
→ No por sí sola. Ayuda a **ver y reutilizar** lo que se citó o buscó; el usuario debe contrastar fuentes y redactar citas finales.

**No veo «Consultas web» en la bitácora**  
→ Solo aparecen si usas **Gemini**, el turno no lleva adjuntos de archivo y la API devuelve `webSearchQueries`. Si solo hay enlaces en el texto, verás filas `assistant_message` o `user_message` sin esa columna rellena.

---

## 12. Límites de lo que el agente ElizaOS debe hacer

**Sí:**
- Explicar flujos, conceptos, riesgos de privacidad y verificabilidad.
- Orientar sobre perfiles, PII, firma, planes y **bitácora de fuentes** (qué registra, anclar, exportar, límites).
- Responder en español claro; derivar a documentación o soporte humano cuando corresponda.

**No:**
- Inventar citas legales, jurisprudencia o URLs de fuentes que no estén en la bitácora o en el mensaje del usuario.
- Prometer que la bitácora sincroniza en la nube, indexa toda la biblioteca del usuario o garantiza cero alucinaciones.
- Restaurar o adivinar datos detrás de placeholders `[CRITERIA_*]` / `[NELAI_*]`.
- Afirmar que un documento es legalmente válido sin matices ni recomendación de abogado cuando aplique.
- Compartir claves API, contraseñas ni datos de otros usuarios.
- Ejecutar transacciones blockchain, firmas o publicaciones DKG (solo la PWA del usuario puede hacerlo).
- Describir, recomendar ni dar soporte sobre **emergencias**, **montañismo**, avisos de salida, bitácoras de campo o flujos de rescate: **están fuera del alcance de CriterIA** en esta base de conocimiento. Si el usuario pregunta por ellos, indicar que no forman parte del producto documental y redirigir a documentos, firma o bitácora de fuentes.

---

## 13. Glosario rápido

- **Bitácora de fuentes:** registro local por documento de URLs y consultas web (grounding) detectadas en el chat del agente.
- **BYOK:** Bring Your Own Key — el usuario aporta su propia API key de LLM.
- **Grounding (Gemini):** enlace de respuestas del modelo a resultados de búsqueda web (`google_search`); alimenta citas y `webSearchQueries` en la bitácora cuando está disponible.
- **C2PA:** Coalition for Content Provenance and Authenticity.
- **DKG:** Decentralized Knowledge Graph (OriginTrail).
- **Etherpad:** Editor colaborativo de texto en tiempo real.
- **LFPDPPP:** Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México).
- **PII:** Personally Identifiable Information / datos personales identificables.
- **PWA:** Progressive Web App.
- **UAL:** Uniform Asset Locator (identificador en DKG).
- **ss58:** Formato de dirección de cuenta en el ecosistema Substrate/Polkadot.

---

## 14. Licencia del software

CriterIA se distribuye bajo **FSL-1.1-MIT** (Functional Source License con licencia MIT futura a los dos años por versión). Uso personal, educativo e interno permitido; ofrecerlo como servicio comercial competitivo está restringido según la licencia.

---

*Última actualización de esta base: alineada con el repositorio nelai-etherpad (CriterIA PWA + servidor Express), incluida la **bitácora de fuentes** (consultas web Gemini, anclaje de fuentes, almacenamiento local). Para detalle técnico extendido, ver `README.md`, `nelai-pwa/docs/MANUAL_USUARIO.md`, `nelai-pwa/docs/tutoriales/08_GUIA_SPOTLIGHT_EDITOR_QUILL.md` y `docs/AGENTES_IMPLEMENTACION.md`.*
