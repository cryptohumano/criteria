# Estructura de UI - Aura Wallet

## Visión General

Aura Wallet es una PWA con navegación por páginas (SPA - Single Page Application) priorizando la experiencia de wallet, con funcionalidades adicionales de documentos, credenciales y registros.

## Arquitectura de Navegación

### Sistema de Rutas
- **Framework**: React Router v6 (o similar)
- **Tipo**: SPA (Single Page Application)
- **Navegación**: Bottom Navigation Bar (móvil) + Sidebar (desktop)

### Layout Principal

```
┌─────────────────────────────────────────┐
│         Header / AppBar                 │
│  [Logo] [Search] [Notifications] [Menu]  │
├─────────────────────────────────────────┤
│                                         │
│         Main Content Area               │
│         (Páginas)                       │
│                                         │
├─────────────────────────────────────────┤
│    Bottom Navigation (Móvil)            │
│  [Home] [Accounts] [Send] [Docs] [More] │
└─────────────────────────────────────────┘
```

## Páginas Principales

### 1. 🏠 **Home / Dashboard** (`/`)

**Propósito**: Vista principal con resumen de la wallet

**Componentes principales**:
- **Balance Total**: Suma de balances de todas las cuentas activas
- **Cuentas Activas**: Lista de cuentas con balance y cambio 24h
- **Transacciones Recientes**: Últimas 5-10 transacciones
- **Redes Conectadas**: Estado de conexión a diferentes blockchains
- **Accesos Rápidos**: Botones para acciones comunes (Send, Receive, Swap)
- **Notificaciones**: Alertas importantes (transacciones pendientes, actualizaciones)

**Funcionalidades**:
- Ver balance total en múltiples monedas
- Acceso rápido a cuentas principales
- Ver estado de sincronización
- Notificaciones y alertas

**Datos mostrados**:
- Balance total (multi-cadena)
- Número de cuentas activas
- Transacciones recientes
- Estado de conexión

---

### 2. 👤 **Accounts / Cuentas** (`/accounts`)

**Propósito**: Gestión completa de cuentas del keyring

**Sub-páginas**:
- **Lista de Cuentas** (`/accounts`) - Vista principal
- **Detalle de Cuenta** (`/accounts/:address`) - Detalle individual
- **Crear Cuenta** (`/accounts/create`) - Formulario de creación
- **Importar Cuenta** (`/accounts/import`) - Importar desde mnemonic/seed

#### 2.1 Lista de Cuentas (`/accounts`)

**Componentes**:
- **Header**: Título + Botón "Crear Cuenta"
- **Filtros**: Por tipo (sr25519, ed25519, ecdsa), por red, búsqueda
- **Lista de Cuentas**: Cards con:
  - Avatar/Icono personalizado
  - Nombre de la cuenta
  - Dirección (truncada)
  - Balance total (multi-cadena)
  - Tipo de criptografía
  - Estado (activa/inactiva)
  - Acciones rápidas (Send, Receive, Ver Detalle)

**Funcionalidades**:
- Ver todas las cuentas
- Filtrar y buscar cuentas
- Activar/desactivar cuentas
- Eliminar cuentas (con confirmación)
- Exportar cuenta (solo metadata pública)
- Cambiar nombre/etiquetas

#### 2.2 Detalle de Cuenta (`/accounts/:address`)

**Componentes**:
- **Header**: Nombre, dirección completa, QR code
- **Balance por Cadena**: Tabla con balances en cada red
- **Información**: Tipo, fecha de creación, última actividad
- **Transacciones**: Lista de transacciones de esta cuenta
- **Acciones**: Send, Receive, Export, Eliminar, Editar

**Funcionalidades**:
- Ver balance detallado por cadena
- Ver historial de transacciones
- Enviar/recepcionar fondos
- Editar metadata (nombre, etiquetas, icono)
- Exportar información pública
- Eliminar cuenta (con confirmación y backup)

#### 2.3 Crear Cuenta (`/accounts/create`)

**Componentes**:
- **Tipo de Cuenta**: Seleccionar sr25519, ed25519, o ecdsa
- **Mnemonic**: Generar nuevo mnemonic (12, 15, 18, 21, 24 palabras)
- **Configuración**:
  - Nombre de la cuenta
  - Etiquetas
  - Icono/emoji
  - Color personalizado
- **Confirmación**: Mostrar mnemonic para backup
- **Protección**: Opción de encriptar con WebAuthn

**Funcionalidades**:
- Generar nuevo mnemonic
- Crear cuenta desde mnemonic
- Configurar metadata inicial
- Backup automático del mnemonic (encriptado)

#### 2.4 Importar Cuenta (`/accounts/import`)

**Componentes**:
- **Método de Importación**:
  - Mnemonic (12-24 palabras)
  - Seed (hex)
  - JSON (formato Polkadot.js)
  - Hardware Wallet (Ledger, Trezor)
- **Formulario**: Campos según método seleccionado
- **Validación**: Verificar formato y checksum
- **Configuración**: Nombre, etiquetas, etc.

**Funcionalidades**:
- Importar desde mnemonic
- Importar desde seed
- Importar desde JSON
- Conectar hardware wallet
- Validar datos antes de importar

---

### 3. 💸 **Send / Enviar** (`/send`)

**Propósito**: Enviar tokens a otra dirección

**Sub-páginas**:
- **Formulario de Envío** (`/send`) - Vista principal
- **Confirmación** (`/send/confirm`) - Revisar y confirmar
- **Éxito** (`/send/success`) - Confirmación de envío

#### 3.1 Formulario de Envío (`/send`)

**Componentes**:
- **Selector de Cuenta**: De qué cuenta enviar
- **Selector de Red**: A qué blockchain enviar
- **Destinatario**: 
  - Campo de dirección
  - Selector de contactos
  - Escanear QR
- **Cantidad**: Input con conversión a USD
- **Token**: Seleccionar token (DOT, KSM, etc.)
- **Fee**: Estimación de fee
- **Memo/Nota**: Campo opcional

**Funcionalidades**:
- Seleccionar cuenta origen
- Ingresar dirección destino (con validación)
- Calcular fee estimado
- Validar balance suficiente
- Previsualizar transacción

#### 3.2 Confirmación (`/send/confirm`)

**Componentes**:
- **Resumen de Transacción**:
  - De: Cuenta origen
  - Para: Dirección destino
  - Cantidad: Monto + token
  - Fee: Fee estimado
  - Total: Cantidad + fee
- **Firma**: Solicitar firma con keyring
- **Envío**: Botón para enviar a la red

**Funcionalidades**:
- Revisar detalles de la transacción
- Firmar transacción
- Enviar a la red
- Mostrar estado (pending, in_block, finalized)

#### 3.3 Éxito (`/send/success`)

**Componentes**:
- **Confirmación**: Transacción enviada exitosamente
- **Hash de Transacción**: Link al explorador
- **Acciones**: Ver detalles, Nueva transacción

---

### 4. 📥 **Receive / Recibir** (`/receive`)

**Propósito**: Mostrar dirección para recibir fondos

**Componentes**:
- **Selector de Cuenta**: Qué cuenta mostrar
- **Selector de Red**: Para qué blockchain
- **QR Code**: Código QR de la dirección
- **Dirección**: Dirección completa (copiable)
- **Compartir**: Opciones para compartir

**Funcionalidades**:
- Generar QR code de dirección
- Copiar dirección al portapapeles
- Compartir por diferentes medios
- Cambiar cuenta/red rápidamente

---

### 5. 📊 **Transactions / Transacciones** (`/transactions`)

**Propósito**: Historial completo de transacciones

**Componentes**:
- **Filtros**:
  - Por cuenta
  - Por red
  - Por estado (pending, finalized, failed)
  - Por fecha (rango)
  - Búsqueda por hash
- **Lista de Transacciones**: 
  - Hash (truncado)
  - Tipo (Send, Receive, Other)
  - Cantidad
  - Estado (badge)
  - Fecha
  - Acciones (Ver detalles, Ver en explorador)

**Funcionalidades**:
- Ver todas las transacciones
- Filtrar y buscar
- Ver detalles de transacción
- Abrir en explorador de bloques
- Exportar historial (CSV/JSON)

#### 5.1 Detalle de Transacción (`/transactions/:hash`)

**Componentes**:
- **Información General**:
  - Hash completo
  - Estado
  - Bloque (si está confirmada)
  - Fecha y hora
- **Detalles**:
  - De: Dirección origen
  - Para: Dirección destino
  - Cantidad
  - Fee
  - Nonce
- **Metadata**:
  - Pallet
  - Método
  - Parámetros
- **Acciones**: Ver en explorador, Copiar hash

---

### 6. 🌐 **Networks / Redes** (`/networks`)

**Propósito**: Gestión de conexiones a blockchains

**Componentes**:
- **Lista de Redes**: 
  - Nombre
  - Estado de conexión
  - Endpoint
  - Tipo (Mainnet, Testnet)
  - Acciones (Conectar, Desconectar, Editar, Eliminar)
- **Agregar Red**: Botón para agregar red personalizada

**Funcionalidades**:
- Ver todas las redes configuradas
- Conectar/desconectar redes
- Agregar red personalizada
- Editar configuración
- Marcar como favorita
- Ver información de la red (genesis hash, versión, etc.)

#### 6.1 Agregar Red (`/networks/add`)

**Componentes**:
- **Nombre**: Nombre de la red
- **Endpoint**: WebSocket URL
- **RPC URL**: HTTP RPC (opcional)
- **SS58 Format**: Formato de direcciones
- **Tipo**: Mainnet / Testnet
- **Icono/Color**: Personalización visual

---

### 7. 👥 **Contacts / Contactos** (`/contacts`)

**Propósito**: Gestión de direcciones frecuentes

**Componentes**:
- **Lista de Contactos**: 
  - Nombre
  - Dirección (truncada)
  - Tipo de dirección
  - Etiquetas
  - Última vez usado
  - Acciones (Editar, Eliminar, Enviar)
- **Agregar Contacto**: Botón flotante

**Funcionalidades**:
- Ver todos los contactos
- Agregar nuevo contacto
- Editar contacto
- Eliminar contacto
- Filtrar por etiquetas
- Búsqueda rápida
- Usar contacto para enviar

#### 7.1 Agregar/Editar Contacto (`/contacts/:id?`)

**Componentes**:
- **Nombre**: Nombre del contacto
- **Dirección**: SS58 o Ethereum address
- **Etiquetas**: Tags para organización
- **Notas**: Notas adicionales
- **Avatar**: URL o emoji
- **Cadenas**: En qué cadenas se usa

---

### 8. 📄 **Documents / Documentos** (`/documents`)

**Propósito**: Gestión de documentos PDF (flight logs, medical records, etc.)

**Sub-páginas**:
- **Lista de Documentos** (`/documents`) - Vista principal
- **Detalle de Documento** (`/documents/:id`) - Ver documento
- **Generar Documento** (`/documents/generate`) - Crear nuevo

#### 8.1 Lista de Documentos (`/documents`)

**Componentes**:
- **Filtros**: Por tipo, por fecha, búsqueda
- **Lista de Documentos**: Cards con:
  - Tipo (badge)
  - Título
  - Fecha de creación
  - Hash (truncado)
  - Estado de firma
  - Acciones (Ver, Descargar, Eliminar)

**Funcionalidades**:
- Ver todos los documentos
- Filtrar por tipo
- Buscar documentos
- Ver documento en visor PDF
- Descargar documento
- Eliminar documento
- Verificar firma

#### 8.2 Detalle de Documento (`/documents/:id`)

**Componentes**:
- **Visor PDF**: Visualización del documento
- **Metadata**: 
  - Tipo
  - Título
  - Autor
  - Fecha
  - Hash SHA-256
- **Firmas**: Lista de firmas digitales
- **Acciones**: 
  - Descargar
  - Compartir
  - Verificar firma
  - Eliminar

**Funcionalidades**:
- Ver documento completo
- Verificar integridad (hash)
- Verificar firmas
- Descargar PDF
- Compartir documento

#### 8.3 Generar Documento (`/documents/generate`)

**Componentes**:
- **Tipo de Documento**: Seleccionar tipo
- **Template**: Seleccionar plantilla
- **Datos**: Formulario dinámico según tipo
- **Opciones**:
  - Formato (PDF/A-2b, PDF/A-3b)
  - Incluir firma
  - Encriptar
- **Preview**: Vista previa del documento

**Funcionalidades**:
- Seleccionar tipo de documento
- Llenar datos del documento
- Generar PDF
- Firmar documento
- Guardar documento

---

### 9. ✈️ **Flight Logs / Registros de Vuelo** (`/flight-logs`)

**Propósito**: Gestión de registros de horas de vuelo

**Sub-páginas**:
- **Lista de Logs** (`/flight-logs`) - Vista principal
- **Detalle de Log** (`/flight-logs/:id`) - Ver registro
- **Nuevo Log** (`/flight-logs/new`) - Crear registro
- **Resumen** (`/flight-logs/summary`) - Estadísticas

#### 9.1 Lista de Logs (`/flight-logs`)

**Componentes**:
- **Filtros**: Por piloto, por fecha, por aeronave
- **Lista de Logs**: Cards con:
  - Fecha del vuelo
  - Duración
  - Ruta (origen → destino)
  - Aeronave
  - Total de horas acumuladas
  - Acciones (Ver, Editar, Eliminar)

**Funcionalidades**:
- Ver todos los registros de vuelo
- Filtrar por diferentes criterios
- Ver resumen de horas totales
- Crear nuevo registro
- Editar registro existente
- Eliminar registro

#### 9.2 Detalle de Log (`/flight-logs/:id`)

**Componentes**:
- **Información del Vuelo**:
  - Fecha y hora
  - Duración
  - Aeronave (matrícula, tipo, modelo)
  - Ruta (origen y destino con GPS)
  - Condiciones meteorológicas
  - Notas
- **Fotos**: Galería de fotos con metadata GPS
- **Mapa**: Visualización de ruta en mapa
- **Documento PDF**: Link al PDF generado
- **Acciones**: Editar, Generar PDF, Eliminar

**Funcionalidades**:
- Ver detalles completos del vuelo
- Ver fotos con metadata GPS
- Ver ruta en mapa
- Generar/regenerar PDF
- Editar registro
- Eliminar registro

#### 9.3 Nuevo Log (`/flight-logs/new`)

**Componentes**:
- **Información Básica**:
  - Fecha y hora
  - Duración (horas)
  - Aeronave (selector o nuevo)
- **Ruta**:
  - Origen (ICAO, GPS automático)
  - Destino (ICAO, GPS automático)
- **Condiciones**:
  - Clima
  - Visibilidad
  - Nubes
- **Fotos**: Capturar o subir fotos con GPS
- **Notas**: Campo de texto libre
- **Opciones**:
  - Generar PDF automáticamente
  - Firmar documento

**Funcionalidades**:
- Capturar datos del vuelo
- Obtener GPS automáticamente
- Capturar fotos con metadata
- Generar PDF con firma
- Guardar registro

#### 9.4 Resumen (`/flight-logs/summary`)

**Componentes**:
- **Estadísticas Generales**:
  - Total de horas
  - Total de vuelos
  - Promedio por vuelo
- **Por Aeronave**: Gráfico de horas por aeronave
- **Por Mes**: Gráfico de horas por mes
- **Por Tipo de Vuelo**: Distribución
- **Período**: Selector de rango de fechas

**Funcionalidades**:
- Ver estadísticas completas
- Filtrar por período
- Exportar resumen (PDF/CSV)
- Ver tendencias

---

### 10. 🏥 **Medical Records / Expedientes Médicos** (`/medical-records`)

**Propósito**: Gestión de expedientes médicos encriptados

**Sub-páginas**:
- **Lista de Registros** (`/medical-records`) - Vista principal
- **Detalle de Registro** (`/medical-records/:id`) - Ver registro
- **Nuevo Registro** (`/medical-records/new`) - Crear registro

#### 10.1 Lista de Registros (`/medical-records`)

**Componentes**:
- **Filtros**: Por tipo, por proveedor, por fecha
- **Lista de Registros**: Cards con:
  - Tipo (badge)
  - Fecha
  - Proveedor
  - Estado de encriptación
  - Acciones (Ver, Descargar, Eliminar)

**Funcionalidades**:
- Ver todos los registros médicos
- Filtrar por diferentes criterios
- Ver registro (requiere desencriptación)
- Descargar registro
- Eliminar registro

#### 10.2 Detalle de Registro (`/medical-records/:id`)

**Componentes**:
- **Información del Registro**:
  - Tipo
  - Fecha
  - Proveedor (nombre, licencia)
  - Datos del registro (estructura flexible)
- **Archivos Adjuntos**: Lista de archivos
- **Documento PDF**: Link al PDF si existe
- **Seguridad**: Indicador de encriptación
- **Acciones**: Editar, Descargar, Compartir, Eliminar

**Funcionalidades**:
- Ver registro completo (desencriptado)
- Ver archivos adjuntos
- Descargar registro
- Compartir con proveedor
- Eliminar registro

#### 10.3 Nuevo Registro (`/medical-records/new`)

**Componentes**:
- **Tipo de Registro**: Seleccionar tipo
- **Fecha**: Fecha del registro
- **Proveedor**: Información del proveedor médico
- **Datos**: Formulario dinámico según tipo
- **Archivos**: Subir archivos adjuntos
- **Opciones**:
  - Encriptar registro
  - Generar PDF
  - Firmar documento

**Funcionalidades**:
- Crear nuevo registro médico
- Subir archivos adjuntos
- Encriptar datos sensibles
- Generar PDF
- Firmar documento

---

### 11. 🎓 **Attestations / Atestaciones** (`/attestations`)

**Propósito**: Gestión de credenciales verificables

**Sub-páginas**:
- **Lista de Atestaciones** (`/attestations`) - Vista principal
- **Detalle de Atestación** (`/attestations/:id`) - Ver credencial
- **Crear Atestación** (`/attestations/create`) - Emitir credencial
- **Verificar** (`/attestations/verify`) - Verificar credencial

#### 11.1 Lista de Atestaciones (`/attestations`)

**Componentes**:
- **Filtros**: Por tipo, por emisor, por sujeto, por validez
- **Lista de Atestaciones**: Cards con:
  - Tipo de credencial
  - Emisor
  - Sujeto
  - Fecha de emisión
  - Estado (válida/expirada)
  - Acciones (Ver, Verificar, Compartir)

**Funcionalidades**:
- Ver todas las atestaciones
- Filtrar por diferentes criterios
- Verificar validez
- Compartir credencial
- Eliminar atestación

#### 11.2 Detalle de Atestación (`/attestations/:id`)

**Componentes**:
- **Credencial**:
  - Tipo
  - ID único
  - Sujeto
  - Emisor
  - Reclamaciones/Atributos
  - Evidencia (documentos relacionados)
- **Prueba Criptográfica**:
  - Tipo de prueba
  - Firma
  - Método de verificación
- **Estado**:
  - Válida/Inválida
  - Expirada/No expirada
  - Fecha de verificación
- **Acciones**: Verificar, Compartir, Exportar

**Funcionalidades**:
- Ver credencial completa
- Verificar firma
- Verificar validez
- Compartir credencial
- Exportar en diferentes formatos

#### 11.3 Crear Atestación (`/attestations/create`)

**Componentes**:
- **Tipo de Credencial**: Seleccionar tipo
- **Sujeto**: Dirección del receptor
- **Reclamaciones**: Formulario dinámico
- **Evidencia**: Seleccionar documentos relacionados
- **Formato**: W3C VC, ISO 18013, etc.
- **Firma**: Firmar con keyring

**Funcionalidades**:
- Crear nueva credencial
- Agregar reclamaciones
- Vincular evidencia
- Firmar credencial
- Emitir credencial

#### 11.4 Verificar (`/attestations/verify`)

**Componentes**:
- **Input**: Pegar credencial o escanear QR
- **Resultado de Verificación**:
  - Firma válida/inválida
  - Credencial válida/expirada
  - Evidencia verificada
  - Detalles de verificación

**Funcionalidades**:
- Verificar credencial externa
- Verificar firma
- Verificar evidencia
- Mostrar resultado detallado

---

### 12. ⚙️ **Settings / Configuración** (`/settings`)

**Propósito**: Configuración de la aplicación

**Sub-páginas**:
- **General** (`/settings`) - Configuración general
- **Security** (`/settings/security`) - Seguridad
- **Networks** (`/settings/networks`) - Redes (redirige a /networks)
- **Backup** (`/settings/backup`) - Respaldo y recuperación
- **About** (`/settings/about`) - Acerca de

#### 12.1 General (`/settings`)

**Componentes**:
- **Apariencia**:
  - Tema (Light, Dark, Auto)
  - Idioma
  - Moneda preferida
- **Notificaciones**:
  - Habilitar notificaciones
  - Notificar transacciones
  - Notificar actualizaciones
- **Red por Defecto**: Seleccionar red predeterminada
- **Auto-lock**: Tiempo de auto-bloqueo

**Funcionalidades**:
- Cambiar tema
- Cambiar idioma
- Configurar notificaciones
- Configurar red por defecto
- Configurar auto-lock

#### 12.2 Security (`/settings/security`)

**Componentes**:
- **Autenticación**:
  - WebAuthn (habilitar/deshabilitar)
  - Biometría (habilitar/deshabilitar)
  - Contraseña maestra
- **Encriptación**:
  - Método de encriptación
  - Nivel de seguridad
- **Sesión**:
  - Cerrar sesión
  - Bloquear wallet

**Funcionalidades**:
- Configurar WebAuthn
- Configurar biometría
- Cambiar contraseña maestra
- Configurar encriptación
- Cerrar sesión
- Bloquear wallet

#### 12.3 Backup (`/settings/backup`)

**Componentes**:
- **Exportar Datos**:
  - Exportar cuentas (metadata)
  - Exportar documentos
  - Exportar configuración
- **Importar Datos**:
  - Importar desde backup
  - Validar backup
- **Respaldo Automático**:
  - Habilitar/deshabilitar
  - Frecuencia
  - Ubicación (local/cloud)

**Funcionalidades**:
- Exportar todos los datos
- Importar desde backup
- Configurar respaldo automático
- Restaurar desde backup

#### 12.4 About (`/settings/about`)

**Componentes**:
- **Información de la App**:
  - Nombre: Aura Wallet
  - Versión
  - Licencia
- **Enlaces**:
  - Documentación
  - Soporte
  - GitHub
  - Términos y Condiciones
  - Política de Privacidad
- **Créditos**: Tecnologías usadas

---

### 13. 🔍 **Search / Búsqueda** (`/search`)

**Propósito**: Búsqueda global en toda la aplicación

**Componentes**:
- **Barra de Búsqueda**: Input con autocompletado
- **Resultados**:
  - Cuentas
  - Transacciones
  - Documentos
  - Flight Logs
  - Medical Records
  - Attestations
  - Contactos

**Funcionalidades**:
- Búsqueda global
- Autocompletado
- Filtros por tipo
- Resultados categorizados

---

## Componentes Compartidos

### Header / AppBar
- Logo de Aura Wallet
- Barra de búsqueda
- Notificaciones (badge con contador)
- Menú de usuario
- Indicador de conexión

### Bottom Navigation (Móvil)
- Home
- Accounts
- Send
- Documents
- More (menú)

### Sidebar (Desktop)
- Navegación completa
- Secciones colapsables
- Indicadores de estado

### Modales Comunes
- **Confirmación**: Para acciones destructivas
- **Firma**: Para firmar transacciones/documentos
- **QR Scanner**: Para escanear códigos QR
- **Password/WebAuthn**: Para autenticación

### Notificaciones
- Toast notifications para acciones
- Sistema de notificaciones persistente
- Badges en iconos

## Flujos de Usuario Principales

### 1. Primer Uso (Onboarding)
1. Bienvenida
2. Crear o importar cuenta
3. Configurar seguridad (WebAuthn)
4. Tutorial rápido
5. Dashboard

### 2. Enviar Fondos
1. Home → Botón "Send"
2. Seleccionar cuenta
3. Ingresar destinatario
4. Ingresar cantidad
5. Revisar y confirmar
6. Firmar transacción
7. Enviar
8. Confirmación de éxito

### 3. Registrar Vuelo
1. Documents → Flight Logs
2. Nuevo Log
3. Capturar datos
4. Capturar fotos con GPS
5. Generar PDF
6. Firmar documento
7. Guardar

### 4. Verificar Credencial
1. Attestations
2. Verificar
3. Pegar credencial o escanear QR
4. Ver resultado

## Responsive Design

### Móvil (< 768px)
- Bottom navigation
- Cards apilados
- Modales fullscreen
- Swipe gestures

### Tablet (768px - 1024px)
- Sidebar colapsable
- Grid de 2 columnas
- Modales centrados

### Desktop (> 1024px)
- Sidebar fijo
- Grid de múltiples columnas
- Modales centrados
- Hover states

## Accesibilidad

- Navegación por teclado
- Screen reader support
- Alto contraste
- Tamaños de fuente ajustables
- Focus indicators

## Performance

- Lazy loading de páginas
- Code splitting
- Virtual scrolling para listas largas
- Cache de imágenes y datos
- Optimistic UI updates

## Estado de la Aplicación

### Contextos React
- `AuthContext`: Estado de autenticación
- `KeyringContext`: Estado del keyring
- `NetworkContext`: Estado de conexiones
- `ThemeContext`: Tema de la aplicación
- `NotificationContext`: Sistema de notificaciones

### Estado Global (Zustand/Redux)
- Cuentas
- Transacciones
- Balances
- Documentos
- Configuración

## Resumen de Páginas

| Página | Ruta | Propósito |
|--------|------|-----------|
| Home | `/` | Dashboard principal |
| Accounts | `/accounts` | Gestión de cuentas |
| Account Detail | `/accounts/:address` | Detalle de cuenta |
| Create Account | `/accounts/create` | Crear nueva cuenta |
| Import Account | `/accounts/import` | Importar cuenta |
| Send | `/send` | Enviar tokens |
| Receive | `/receive` | Recibir tokens |
| Transactions | `/transactions` | Historial de transacciones |
| Transaction Detail | `/transactions/:hash` | Detalle de transacción |
| Networks | `/networks` | Gestión de redes |
| Add Network | `/networks/add` | Agregar red |
| Contacts | `/contacts` | Gestión de contactos |
| Documents | `/documents` | Lista de documentos |
| Document Detail | `/documents/:id` | Ver documento |
| Generate Document | `/documents/generate` | Generar documento |
| Flight Logs | `/flight-logs` | Lista de registros |
| Flight Log Detail | `/flight-logs/:id` | Detalle de registro |
| New Flight Log | `/flight-logs/new` | Crear registro |
| Flight Log Summary | `/flight-logs/summary` | Estadísticas |
| Medical Records | `/medical-records` | Lista de registros |
| Medical Record Detail | `/medical-records/:id` | Ver registro |
| New Medical Record | `/medical-records/new` | Crear registro |
| Attestations | `/attestations` | Lista de atestaciones |
| Attestation Detail | `/attestations/:id` | Ver credencial |
| Create Attestation | `/attestations/create` | Emitir credencial |
| Verify Attestation | `/attestations/verify` | Verificar credencial |
| Settings | `/settings` | Configuración general |
| Security Settings | `/settings/security` | Configuración de seguridad |
| Backup | `/settings/backup` | Respaldo y recuperación |
| About | `/settings/about` | Acerca de |
| Search | `/search` | Búsqueda global |

**Total: ~35 páginas principales**

## Priorización de Desarrollo

### Fase 1: Wallet Core (MVP)
1. Home/Dashboard
2. Accounts (lista, detalle, crear, importar)
3. Send/Receive
4. Transactions
5. Networks
6. Settings básico

### Fase 2: Funcionalidades Avanzadas
7. Contacts
8. Documents (básico)
9. Flight Logs
10. Medical Records
11. Attestations

### Fase 3: Mejoras y Optimización
12. Search global
13. Notificaciones avanzadas
14. Analytics y reportes
15. Integraciones externas

