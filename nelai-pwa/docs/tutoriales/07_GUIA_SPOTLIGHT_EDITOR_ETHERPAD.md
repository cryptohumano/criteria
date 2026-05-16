# Tutorial guiado: barra y panel del editor Etherpad (spotlight)

La **primera vez** que abres un documento colaborativo **Etherpad** ya creado (con el pad cargado), CriterIA puede mostrarte un recorrido con **spotlight** sobre la barra superior y el **panel derecho** (PII y agente).

## ¿Cuándo aparece?

Cuando el documento tiene sesión de pad activa (`pad` conectado) y en este navegador **aún no** has marcado como visto el tutorial del editor (`criteria.help.tour.editorEtherpad.v1.seen`).

No sustituye al diálogo de **identidad en el dispositivo**: si es la primera vez y debes crear o desbloquear el almacén de la llave local, ese paso va primero; el spotlight del editor aparece **después**, al estar ya en el editor con el iframe listo.

## Qué explica el recorrido (resumen)

1. **Menú lateral**: icono de menú para abrir la misma navegación que en el resto de la app sin salir del documento.
2. **Volver**: regreso al listado de documentos.
3. **Perfil del agente**: Legal MX frente a Académico; se guarda en los metadatos del documento.
4. **Guardar local (PDF)**: sincroniza el texto del pad con el PDF almacenado en el dispositivo y versiona para la vista previa en Documentos.
5. **Exportar Markdown** (solo si tu entorno muestra controles de desarrollo Etherpad): descarga el contenido del pad como `.md`.
6. **Aviso “Quién puede editar este pad”**: política de acceso del pad colaborativo; puede cerrarse solo o al cabo de unos segundos. Si ya se cerró cuando llegas a ese paso, el foco puede mostrarse sin marco; el texto del paso sigue siendo válido.
7. **Área Etherpad (iframe)**: edición en tiempo real. El **historial de revisiones** (timeslider / línea de tiempo) lo ofrece **Etherpad** en la barra del propio iframe, no en la barra de CriterIA.
8. **Panel PII / Agente**: revisión de datos personales antes de enviar a la IA; la pestaña **Agente** es el chat con el asistente y puede quedar limitada hasta resolver bloqueos de PII.

## Cómo volver a verlo

Borra en almacenamiento local la clave `criteria.help.tour.editorEtherpad.v1.seen` (y la legacy `nelai.help.tour.editorEtherpad.v1.seen` si existía) y vuelve a abrir un documento Etherpad.

## Más ayuda

Consulta en la lista de tutoriales: **PII y privacidad**, **Perfiles del agente** y **Exportar Markdown**.
