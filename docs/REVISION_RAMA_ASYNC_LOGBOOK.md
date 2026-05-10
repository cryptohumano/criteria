# Revisión de la rama `feature/async-logbook` (Andino Wallet PWA)

Análisis de los cambios que aporta esta rama respecto a `main` y cómo encajan con el plan Nelai (firma de metadata, agentes, DKG).

---

## 1. Resumen de commits (feature vs main)

La rama tiene **16 commits** por delante de `main`. Temas principales:

| Área | Cambios |
|------|--------|
| **Bitácoras históricas** | Nuevo tipo de bitácora sin aviso de salida, con entrada manual de fechas/GPS y archivos adjuntos. |
| **UI / Home** | Mapa de todas las bitácoras, estadísticas generales, FABs, tarjetas de bitácora activa y emergencias activas. |
| **Carga asíncrona** | Hooks que cargan datos desde IndexedDB de forma async; lazy load del mapa en Home. |
| **Emergencia / FAB** | Mejoras del botón flotante de emergencia en móvil (visibilidad, detección PWA). |
| **Deploy** | Ajustes para GitHub Pages (rutas, base path, favicon, import dinámico). |
| **Seed** | Página para generar bitácoras de ejemplo (testing). |

---

## 2. Qué aporta la rama (detalle)

### 2.1 Bitácoras históricas (`isHistorical`)

- **Tipo:** `MountainLog.isHistorical?: boolean`. Si es `true`:
  - No se usa aviso de salida (Socorro Andino).
  - Se permiten **fechas y horas manuales** en milestones (`metadata.fechaInicio`, `horaInicio`, `fechaLlegada`, etc.).
  - **GPS manual** por milestone (lat/lon/altitud en lugar de GPS en vivo).
  - **Archivos adjuntos** por milestone: `MountainLogFile[]` (id, name, type, data base64, size).
- **UI:** En lista de bitácoras hay filtro `all | active | historical`. En detalle, formularios específicos para fecha/hora y GPS manuales; FABs para “agregar milestone” y “finalizar” en históricas.
- **PDF:** El generador de PDF de bitácoras trata `log.isHistorical` (leyenda, fechas manuales en milestones).

**Para Nelai:** Las **evidencias** (fotos, archivos en milestones) en bitácoras históricas son un buen punto para aplicar **firma de metadata**: cada `MountainLogImage` o `MountainLogFile` podría tener `contentHash` + firma del creador. Hoy no hay firma por imagen/archivo en milestones.

### 2.2 Hooks de datos “async”

- **`useRecentMountainLogs(limit)`:** Carga bitácoras (por cuenta activa o todas), ordena por `createdAt`, devuelve las N más recientes. Uso: Home (mapa) con limit 100.
- **`useActiveMountainLog()`:** Devuelve la bitácora con `status === 'active'` (priorizando la de la cuenta activa). Uso: Home, botón de emergencia.
- **`useActiveEmergencies()`:** (Existente o afinado) emergencias activas para la cuenta.

La carga es **async** (useEffect + async/await sobre IndexedDB); no hay cola de guardado en background ni sincronización con servidor en esta rama.

### 2.3 Home y componentes nuevos

- **`MountainLogsMap`:** Mapa Leaflet con todas las bitácoras (y emergencias), marcadores por estado, popups, modal de ruta. Cargado con **lazy** para no bloquear LCP.
- **`GeneralStatistics`:** Totales de bitácoras (por estado), distancia, fotos, waypoints, emergencias activas; abre modal con detalle.
- **`ActiveMountainLogCard` / `ActiveEmergenciesCard`:** Tarjetas en Home para bitácora activa y emergencias.
- **FAB:** Botón flotante “Crear bitácora” (y en detalle de bitácora, emergencia). Mejoras de detección móvil y visibilidad en PWA.

### 2.4 EmergencyButton y FAB de emergencia

- FAB integrado en `EmergencyButton`; mejoras para que sea visible en móvil y PWA (Portal, estilos, detección de entorno).
- Lógica de “bitácora activa” para mostrar/ocultar el FAB (p. ej. no en bitácoras históricas).

### 2.5 Seed y PDF

- **`SeedMountainLogs`:** Página (ruta dedicada) que llama a `seedMountainLogs(count, activeAccount)` para generar entre 1 y 50 bitácoras de ejemplo (Chile). Útil para demos y testing.
- **`mountainLogPDFGenerator`:** Ajustes para bitácoras históricas: leyenda, uso de `metadata.fechaInicio`/etc. en milestones cuando existan.

### 2.6 Persistencia

- **IndexedDB** sin cambios de esquema nuevos en esta revisión: mismo store `mountain-logs` con índices `byStatus` y `byAccount`. Los nuevos campos (`isHistorical`, `files`, `manualTimestamp`, `manualGPS`, metadata de fechas) se guardan en el objeto existente.

---

## 3. Qué NO hay en la rama (aclaraciones)

- **“Async” en el nombre:** Se refiere a **carga asíncrona** de bitácoras (y lazy del mapa), no a una cola de guardado en background ni a sync con backend. El guardado sigue siendo `saveMountainLog` síncrono en flujo de usuario.
- **Cola de documentos:** El store `document-queue` y los tipos `DocumentQueueItem` / `ExternalAPIConfig` siguen existiendo pero no se usan en los flujos de esta rama (igual que en main).
- **Firma de metadata / C2PA / DKG:** No aparecen en la rama; el plan Nelai sigue siendo la capa a añadir encima.

---

## 4. Cómo encaja con Nelai

| Elemento Nelai | Encaje con feature/async-logbook |
|----------------|-----------------------------------|
| **Firma de metadata** | **Documentos:** Ya existe `SubstrateSigner` + `DocumentSignature` para PDFs. **Fotos/archivos en bitácoras:** `MountainLogImage` y `MountainLogFile` no tienen firma; hay que añadir un flujo “firmar metadata” (contentHash + firma con keyring) al crear/adjuntar imagen o archivo en un milestone (normal o histórico). |
| **Agente Verificador** | Puede consumir metadata firmada de documentos (ya existe) y, cuando exista, de imágenes/archivos de milestones. La rama no lo bloquea; solo falta implementar el módulo de verificación y la UI “Verificar archivo/UAL”. |
| **Agente Guía** | Se puede mostrar en los flujos de “Firmar y registrar on-chain” o “Publicar en DKG”. La rama no cambia esos flujos; el punto de inserción sigue siendo el mismo (modal antes de confirmar). |
| **DKG (OriginTrail)** | Publicar Knowledge Assets de evidencias (p. ej. por milestone o por documento). La estructura de `MountainLog` + milestones + imágenes/archivos es suficiente para elegir “qué” publicar (hash, autor, fecha); no hace falta cambiar la rama. |
| **Bitácoras históricas** | Son un **caso de uso ideal** para “evidencia con firma”: el usuario sube fotos o archivos a un milestone histórico; si cada uno tiene metadata firmada, un tercero puede verificar origen e integridad. Conviene extender el modelo (p. ej. `contentHash` + `signature` en `MountainLogImage` / `MountainLogFile`) y el flujo de guardado. |

---

## 5. Recomendaciones para implementar Nelai sobre esta rama

1. **Seguir trabajando sobre `feature/async-logbook`** como base: incluye históricas, mejor Home, FABs y seed, sin conflictos con el plan de firma/agentes/DKG.
2. **Priorizar firma de metadata para evidencias en bitácoras:** Añadir en tipos (o en metadata existente) algo como `contentHash` y opcionalmente `signature`/`signer` para `MountainLogImage` y `MountainLogFile`; al adjuntar foto/archivo, calcular hash y ofrecer “Firmar con mi cuenta”.
3. **Reutilizar** `SubstrateSigner` (o un módulo que exponga “firmar payload”) para ese flujo; el payload a firmar puede ser la metadata canónica (como en `SCHEMA_METADATA_FIRMA.md`).
4. **Dejar para después** (si hace falta): cola de guardado en background o sync con APIs externas; la rama no la implementa y no es requisito mínimo para el demo del hackathon.

---

## 6. Resumen en una frase

La rama **feature/async-logbook** añade bitácoras históricas (entrada manual de fechas/GPS y archivos), carga asíncrona de datos y mapa/estadísticas en Home, y mejora el FAB de emergencia. No incluye firma de metadata ni agentes; es la base adecuada para añadir Nelai (firma por imagen/archivo en milestones, Verificador, Guía y DKG) sin conflictos.
