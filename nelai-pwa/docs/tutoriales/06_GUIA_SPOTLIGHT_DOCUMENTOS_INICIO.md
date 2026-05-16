# Tutorial guiado: documentos al iniciar (spotlight)

En la **primera visita** a CriterIA (en este navegador), después de tener sesión o la **llave local** lista para ver el escritorio, puede aparecer un recorrido con **spotlight** centrado en las **acciones principales de documentos**.

## ¿Cuándo aparece?

- **Modo organización (SaaS)**: la primera vez que entras en **Inicio** (`/`) o en **Documentos** (`/documents`) y aún no está marcado como visto el tutorial de documentos (`criteria.help.tour.documentsIntro.v1.seen`).
- **Modo solo llave local (sin SaaS)**: la primera vez en **Inicio** o **Documentos** con el almacén **ya desbloqueado**, con la misma clave de almacenamiento.

En **móvil**, el primer paso suele resaltar el **botón flotante** del menú; en **escritorio**, el enlace **Documentos** del menú lateral.

## Orden respecto al tutorial de la llave local

Si el almacén está **bloqueado** en modo SaaS, CriterIA intenta mostrar **primero** este recorrido de documentos (inicio o listado) y **después**, si sigue bloqueado, el tutorial guiado de **llave local** (banner y desbloqueo).

## Qué cubre el recorrido en Inicio (SaaS)

1. Navegación hacia **Documentos** (menú o FAB móvil).
2. Bloque destacado de **documentos**: crear, analizar contrato, analizar académico y enlace al listado.
3. **Crear documento**: acceso al flujo para elegir editor local o Etherpad.
4. **Análisis guiados**: accesos rápidos con perfil Legal MX o académico.
5. **Ver todos mis documentos**: salto al listado completo.
6. **Identidad digital**: vínculo entre tu usuario de organización y tu llave local (DID).

## Qué cubre en Inicio (solo llave local)

1. Misma idea de navegación a **Documentos**.
2. Tarjeta de acceso rápido **Documentos** del panel de inicio.

## Qué cubre en la página Documentos

1. Navegación (menú / FAB).
2. Botón **Crear documento** del listado.

## Cómo volver a verlo

Borra en almacenamiento local `criteria.help.tour.documentsIntro.v1.seen` (y la legacy `nelai.help.tour.documentsIntro.v1.seen` si existía) y vuelve a abrir Inicio o Documentos.

## Editor Etherpad (otro tutorial)

El recorrido de la **barra y el panel** del editor colaborativo es independiente; está descrito en el tutorial **«Tutorial guiado: barra y panel del editor Etherpad (spotlight)»** (archivo `07_…` en la lista de ayuda).
