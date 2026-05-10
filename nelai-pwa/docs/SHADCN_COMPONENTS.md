# Componentes shadcn/ui para Aura Wallet

## Objetivo: Experiencia intuitiva en menos de 3 clicks

Este documento lista los componentes de [shadcn/ui](https://ui.shadcn.com/docs/components) necesarios para Aura Wallet, priorizando una experiencia de usuario fluida y eficiente.

## 📊 Resumen Rápido

| Prioridad | Cantidad | Estado | Acción |
|-----------|----------|--------|--------|
| 🔴 Alta | 20 | Pendiente | Instalar primero |
| 🟡 Media | 18 | Pendiente | Instalar después |
| 🟢 Baja | 18 | Opcional | Instalar si se necesita |
| ✅ Ya Instalados | 5 | Instalado | button, card, dialog, badge, input |

**Total**: 56 componentes disponibles, 20 esenciales para MVP

## 🚀 Inicio Rápido

```bash
# Instalar componentes esenciales (Prioridad Alta)
bash scripts/install-shadcn-components.sh
```

O manualmente:
```bash
npx shadcn@latest add input label select sonner sidebar table form avatar skeleton alert alert-dialog sheet drawer tabs combobox command calendar date-picker --yes
```

## Componentes Esenciales (Core)

### 1. **Button** ✅ (Ya instalado probablemente)
**Uso**: Acciones principales en toda la app
- Enviar transacciones
- Confirmar acciones
- Navegación rápida
- Acciones secundarias

**Ubicaciones**: Todas las páginas

---

### 2. **Card** ✅ (Ya instalado probablemente)
**Uso**: Contenedores de información
- Cards de cuentas en Dashboard
- Cards de transacciones
- Cards de documentos
- Cards de flight logs

**Ubicaciones**: Home, Accounts, Transactions, Documents

---

### 3. **Dialog** ✅ (Ya instalado probablemente)
**Uso**: Modales para confirmaciones y acciones críticas
- Confirmar envío de transacciones
- Confirmar eliminación de cuentas
- Firmar transacciones/documentos
- Autenticación (WebAuthn)

**Ubicaciones**: Todas las páginas (acciones críticas)

---

### 4. **Input**
**Uso**: Campos de formulario
- Direcciones de destino (Send)
- Cantidades
- Búsqueda global
- Nombres de cuentas/contactos

**Ubicaciones**: Send, Receive, Accounts, Contacts, Search

---

### 5. **Label**
**Uso**: Etiquetas de formularios
- Todos los formularios
- Mejora accesibilidad

**Ubicaciones**: Todos los formularios

---

### 6. **Select**
**Uso**: Selección de opciones
- Seleccionar cuenta origen (Send)
- Seleccionar red/chain
- Seleccionar tipo de documento
- Filtros en listas

**Ubicaciones**: Send, Accounts, Networks, Documents, Flight Logs

---

### 7. **Toast** (Sonner)
**Uso**: Notificaciones no intrusivas
- Confirmación de acciones exitosas
- Errores
- Estado de transacciones
- Sincronización completada

**Ubicaciones**: Global (sistema de notificaciones)

---

### 8. **Badge** ✅ (Ya instalado probablemente)
**Uso**: Indicadores de estado
- Estado de transacciones (pending, finalized, failed)
- Tipo de cuenta (sr25519, ed25519, ecdsa)
- Tipo de documento
- Estado de conexión

**Ubicaciones**: Transactions, Accounts, Documents, Networks

---

## Componentes de Navegación

### 9. **Sidebar**
**Uso**: Navegación principal en desktop
- Menú lateral con todas las secciones
- Indicadores de estado
- Secciones colapsables
- Acceso rápido a funciones

**Ubicaciones**: Layout principal (desktop)

---

### 10. **Navigation Menu**
**Uso**: Navegación superior (opcional)
- Menú principal en header
- Dropdowns de navegación
- Breadcrumbs

**Ubicaciones**: Header (opcional, si no usamos Sidebar)

---

### 11. **Breadcrumb**
**Uso**: Navegación contextual
- Ruta actual en páginas anidadas
- Navegación rápida a niveles superiores

**Ubicaciones**: Páginas de detalle (Account Detail, Transaction Detail, etc.)

---

### 12. **Tabs**
**Uso**: Organización de contenido
- Tabs en Account Detail (Balance, Transactions, Settings)
- Tabs en Settings (General, Security, Backup)
- Tabs en Document Detail (View, Signatures, Metadata)

**Ubicaciones**: Account Detail, Settings, Document Detail

---

## Componentes de Datos

### 13. **Table**
**Uso**: Listas de datos estructurados
- Lista de transacciones
- Lista de cuentas
- Lista de documentos
- Lista de flight logs

**Ubicaciones**: Transactions, Accounts, Documents, Flight Logs

---

### 14. **Data Table** (TanStack Table)
**Uso**: Tablas avanzadas con funcionalidades
- Ordenamiento
- Filtrado
- Paginación
- Búsqueda

**Ubicaciones**: Transactions, Accounts (si necesitamos funcionalidades avanzadas)

---

### 15. **Avatar**
**Uso**: Representación visual de cuentas/contactos
- Avatar de cuentas
- Avatar de contactos
- Iniciales si no hay imagen

**Ubicaciones**: Accounts, Contacts, Header (usuario)

---

### 16. **Skeleton**
**Uso**: Loading states
- Cargando balances
- Cargando transacciones
- Cargando documentos
- Mejora percepción de velocidad

**Ubicaciones**: Todas las páginas con datos asíncronos

---

## Componentes de Formularios

### 17. **Form** (React Hook Form)
**Uso**: Formularios complejos
- Crear cuenta
- Enviar transacción
- Crear flight log
- Crear medical record
- Validación integrada

**Ubicaciones**: Accounts/Create, Send, Flight Logs/New, Medical Records/New

---

### 18. **Checkbox**
**Uso**: Selección múltiple y opciones
- Opciones en formularios
- Seleccionar múltiples cuentas
- Configuración de settings

**Ubicaciones**: Settings, Forms

---

### 19. **Radio Group**
**Uso**: Selección única
- Tipo de cuenta (sr25519, ed25519, ecdsa)
- Tipo de documento
- Método de importación

**Ubicaciones**: Accounts/Create, Accounts/Import, Documents/Generate

---

### 20. **Switch**
**Uso**: Toggles de configuración
- Habilitar/deshabilitar notificaciones
- Habilitar/deshabilitar WebAuthn
- Habilitar/deshabilitar redes
- Auto-lock

**Ubicaciones**: Settings, Networks

---

### 21. **Textarea**
**Uso**: Campos de texto largo
- Notas en flight logs
- Notas en cuentas
- Memo en transacciones
- Descripción de documentos

**Ubicaciones**: Flight Logs, Accounts, Send, Documents

---

### 22. **Input OTP**
**Uso**: Códigos de verificación
- Verificación de backup
- Confirmación de eliminación
- Códigos de recuperación

**Ubicaciones**: Settings/Backup, Accounts/Delete

---

### 23. **Slider**
**Uso**: Valores numéricos ajustables
- Duración de vuelo
- Cantidad a enviar (con slider opcional)
- Auto-lock timeout

**Ubicaciones**: Flight Logs, Send (opcional), Settings

---

## Componentes de Overlay

### 24. **Sheet** (Drawer en móvil)
**Uso**: Paneles laterales
- Menú móvil
- Filtros laterales
- Detalles rápidos
- Configuración rápida

**Ubicaciones**: Móvil (navegación), Filtros

---

### 25. **Drawer**
**Uso**: Paneles inferiores (móvil)
- Confirmación de acciones
- Formularios rápidos
- Detalles de transacción

**Ubicaciones**: Móvil (acciones)

---

### 26. **Popover**
**Uso**: Información contextual
- Tooltips avanzados
- Menús contextuales
- Información adicional
- Quick actions

**Ubicaciones**: Accounts (acciones rápidas), Transactions (detalles)

---

### 27. **Tooltip**
**Uso**: Información al hover
- Explicar funciones
- Ayuda contextual
- Información de campos

**Ubicaciones**: Global (ayuda contextual)

---

### 28. **Hover Card**
**Uso**: Preview de información
- Preview de cuenta al hover
- Preview de transacción
- Preview de documento

**Ubicaciones**: Lists (preview rápido)

---

### 29. **Context Menu**
**Uso**: Menús contextuales
- Click derecho en cuentas
- Click derecho en transacciones
- Acciones rápidas

**Ubicaciones**: Accounts, Transactions, Documents

---

### 30. **Dropdown Menu**
**Uso**: Menús desplegables
- Menú de usuario
- Acciones de cuenta
- Más opciones

**Ubicaciones**: Header, Account Cards, Transaction Cards

---

## Componentes de Feedback

### 31. **Alert**
**Uso**: Alertas importantes
- Advertencias de seguridad
- Errores críticos
- Información importante
- Estado de sincronización

**Ubicaciones**: Global (alertas importantes)

---

### 32. **Alert Dialog**
**Uso**: Confirmaciones críticas
- Eliminar cuenta
- Eliminar documento
- Confirmar transacción grande
- Acciones destructivas

**Ubicaciones**: Accounts/Delete, Documents/Delete, Send (montos grandes)

---

### 33. **Progress**
**Uso**: Indicadores de progreso
- Sincronización
- Carga de datos
- Progreso de transacción
- Progreso de backup

**Ubicaciones**: Sync Queue, Transactions, Backup

---

### 34. **Spinner**
**Uso**: Loading states simples
- Cargando balances
- Procesando transacción
- Generando documento

**Ubicaciones**: Global (loading states)

---

## Componentes de Entrada de Datos

### 35. **Calendar**
**Uso**: Selección de fechas
- Fecha de vuelo
- Fecha de registro médico
- Filtros por fecha
- Rango de fechas

**Ubicaciones**: Flight Logs, Medical Records, Filters

---

### 36. **Date Picker**
**Uso**: Selección de fecha con input
- Fecha de vuelo (con input)
- Filtros de fecha
- Rango de fechas en filtros

**Ubicaciones**: Flight Logs, Medical Records, Transaction Filters

---

### 37. **Combobox**
**Uso**: Búsqueda con autocompletado
- Buscar cuenta
- Buscar contacto
- Buscar red
- Búsqueda global

**Ubicaciones**: Send (destinatario), Search, Contacts

---

### 38. **Command** (Command Palette)
**Uso**: Búsqueda rápida y acciones
- Búsqueda global (Cmd+K)
- Acciones rápidas
- Navegación rápida

**Ubicaciones**: Global (Cmd+K)

---

## Componentes de Organización

### 39. **Accordion**
**Uso**: Contenido colapsable
- FAQ en About
- Detalles expandibles
- Secciones de ayuda

**Ubicaciones**: Settings/About, Help sections

---

### 40. **Collapsible**
**Uso**: Contenido colapsable simple
- Filtros colapsables
- Detalles adicionales
- Secciones opcionales

**Ubicaciones**: Filters, Forms (secciones opcionales)

---

### 41. **Separator**
**Uso**: Separación visual
- Separar secciones
- Dividir contenido
- Organización visual

**Ubicaciones**: Global (organización)

---

### 42. **Scroll Area**
**Uso**: Áreas con scroll personalizado
- Listas largas
- Contenido con scroll
- Mejor UX en móvil

**Ubicaciones**: Transactions, Accounts, Documents (listas largas)

---

## Componentes de Visualización

### 43. **Aspect Ratio**
**Uso**: Mantener proporciones
- QR codes
- Avatares
- Imágenes de documentos
- Fotos de flight logs

**Ubicaciones**: Receive (QR), Documents, Flight Logs

---

### 44. **Carousel**
**Uso**: Galería de imágenes
- Fotos de flight logs
- Documentos relacionados
- Screenshots de tutorial

**Ubicaciones**: Flight Logs (fotos), Documents (preview)

---

### 45. **Chart** (Recharts)
**Uso**: Gráficos y visualizaciones
- Gráfico de horas de vuelo por mes
- Gráfico de balance histórico
- Estadísticas de transacciones
- Resumen de flight logs

**Ubicaciones**: Flight Logs/Summary, Home (estadísticas), Transactions

---

### 46. **Empty**
**Uso**: Estados vacíos
- Sin cuentas
- Sin transacciones
- Sin documentos
- Sin flight logs

**Ubicaciones**: Todas las listas (estado vacío)

---

## Componentes de Utilidad

### 47. **Pagination**
**Uso**: Navegación de páginas
- Lista de transacciones
- Lista de documentos
- Lista de flight logs

**Ubicaciones**: Transactions, Documents, Flight Logs (listas paginadas)

---

### 48. **Resizable**
**Uso**: Paneles redimensionables
- Panel de detalles (opcional)
- Layout personalizable

**Ubicaciones**: Desktop (layout avanzado, opcional)

---

### 49. **Toggle**
**Uso**: Toggles simples
- Activar/desactivar cuenta
- Mostrar/ocultar balance
- Toggle de vista

**Ubicaciones**: Accounts, Settings

---

### 50. **Toggle Group**
**Uso**: Grupo de toggles
- Vista de lista/grid
- Filtros múltiples
- Opciones de visualización

**Ubicaciones**: Accounts (vista), Documents (vista)

---

### 51. **Input Group**
**Uso**: Inputs con elementos adicionales
- Cantidad con botón "Max"
- Dirección con botón "Pegar"
- Búsqueda con icono

**Ubicaciones**: Send, Accounts, Search

---

### 52. **Field**
**Uso**: Campos de formulario mejorados
- Formularios con validación
- Campos con ayuda
- Mejor accesibilidad

**Ubicaciones**: Forms (React Hook Form)

---

### 53. **Item**
**Uso**: Items de lista consistentes
- Items de navegación
- Items de menú
- Consistencia visual

**Ubicaciones**: Sidebar, Dropdown Menus

---

### 54. **Kbd**
**Uso**: Mostrar atajos de teclado
- Atajos en tooltips
- Ayuda de teclado
- Documentación de shortcuts

**Ubicaciones**: Tooltips, Help sections

---

### 55. **Typography**
**Uso**: Tipografía consistente
- Títulos
- Texto
- Subtítulos
- Consistencia visual

**Ubicaciones**: Global (base typography)

---

### 56. **Menubar**
**Uso**: Barra de menú (opcional)
- Menú superior (alternativa a Sidebar)
- Menú de aplicación

**Ubicaciones**: Header (opcional)

---

### 57. **Native Select**
**Uso**: Select nativo (mejor rendimiento)
- Selects simples
- Mejor en móvil
- Menos JavaScript

**Ubicaciones**: Forms simples, móvil

---

## Resumen por Prioridad

### 🔴 Prioridad Alta (Instalar primero)
1. Button ✅
2. Card ✅
3. Dialog ✅
4. Input
5. Label
6. Select
7. Toast (Sonner)
8. Badge ✅
9. Sidebar
10. Table
11. Form (React Hook Form)
12. Avatar
13. Skeleton
14. Alert
15. Alert Dialog
16. Sheet/Drawer
17. Tabs
18. Combobox
19. Command (Cmd+K)
20. Calendar/Date Picker

### 🟡 Prioridad Media (Instalar después)
21. Data Table
22. Navigation Menu
23. Breadcrumb
24. Checkbox
25. Radio Group
26. Switch
27. Textarea
28. Popover
29. Tooltip
30. Dropdown Menu
31. Context Menu
32. Progress
33. Spinner
34. Chart
35. Empty
36. Pagination
37. Scroll Area
38. Aspect Ratio

### 🟢 Prioridad Baja (Opcional)
39. Accordion
40. Collapsible
41. Separator ✅ (probablemente ya existe)
42. Carousel
43. Resizable
44. Toggle
45. Toggle Group
46. Input OTP
47. Slider
48. Hover Card
49. Input Group
50. Field
51. Item
52. Kbd
53. Typography
54. Menubar
55. Native Select

## Comando de Instalación

### 🚀 Instalación Rápida (Script Automatizado)

```bash
# Ejecutar script de instalación
bash scripts/install-shadcn-components.sh
```

El script instalará los componentes por prioridad y te preguntará si quieres instalar los de prioridad media y baja.

**Nota**: Algunos componentes como `combobox` y `date-picker` pueden no estar disponibles directamente en el registry, pero puedes crearlos usando los componentes base (`popover` + `command` para combobox, `calendar` + `popover` para date-picker).

### 📦 Instalación Manual por Lotes

#### Prioridad Alta (Core - Instalar primero)
```bash
npx shadcn@latest add input label select sonner sidebar table form avatar skeleton alert alert-dialog sheet drawer tabs combobox command calendar date-picker --yes
```

**Nota**: `button`, `card`, `dialog`, y `badge` ya están instalados ✅

#### Prioridad Media (Funcionalidades avanzadas)
```bash
npx shadcn@latest add data-table navigation-menu breadcrumb checkbox radio-group switch textarea popover tooltip dropdown-menu context-menu progress spinner chart empty pagination scroll-area aspect-ratio --yes
```

#### Prioridad Baja (Opcional)
```bash
npx shadcn@latest add accordion collapsible separator carousel resizable toggle toggle-group input-otp slider hover-card input-group field item kbd typography menubar native-select --yes
```

### 🔧 Instalación Individual

```bash
# Ejemplo: instalar componente individual
npx shadcn@latest add button
npx shadcn@latest add card
# ... etc
```

### 📋 Verificar Componentes Instalados

```bash
# Ver componentes en src/components/ui/
ls src/components/ui/
```

## Componentes Especiales para Wallet

### Componentes Personalizados Necesarios

Además de shadcn/ui, necesitarás crear componentes personalizados:

1. **QRCode** - Para mostrar direcciones (usar `qrcode.react` o similar)
2. **AddressDisplay** - Componente para mostrar direcciones SS58 con copy
3. **BalanceDisplay** - Componente para mostrar balances con formato
4. **TransactionCard** - Card especializada para transacciones
5. **AccountCard** - Card especializada para cuentas
6. **NetworkStatus** - Indicador de estado de red
7. **SignatureRequest** - Modal para solicitar firma
8. **DocumentViewer** - Visor de PDFs
9. **MapView** - Mapa para flight logs (usar Leaflet o similar)
10. **PhotoCapture** - Captura de fotos con GPS

## Experiencia de Menos de 3 Clicks

### Principios de Diseño

1. **Acciones Rápidas**: Usar Command Palette (Cmd+K) para acciones rápidas
2. **Context Menus**: Click derecho para acciones comunes
3. **Quick Actions**: Botones de acción rápida en cards
4. **Autocompletado**: Combobox para búsqueda rápida
5. **Shortcuts**: Atajos de teclado para acciones frecuentes

### Ejemplos de Flujos Optimizados

#### Enviar Fondos (2 clicks)
1. Click en "Send" (Home o Bottom Nav)
2. Click en "Send" después de llenar (autocompletado de destinatario)

#### Ver Detalle de Transacción (1 click)
1. Click en transacción (abre modal/drawer)

#### Crear Cuenta (2 clicks)
1. Click en "Create Account" (Accounts)
2. Click en "Create" después de configurar

#### Registrar Vuelo (2 clicks)
1. Click en "New Flight Log" (Flight Logs)
2. Click en "Save" después de capturar datos

## 📦 Dependencias Adicionales

Algunos componentes requieren dependencias adicionales que se instalarán automáticamente, pero es bueno conocerlas:

### Dependencias Principales

```bash
# Form (React Hook Form + Zod para validación)
yarn add react-hook-form @hookform/resolvers zod

# Data Table (TanStack Table)
yarn add @tanstack/react-table

# Chart (Recharts)
yarn add recharts

# Sonner (Toast notifications)
yarn add sonner

# Command (cmdk)
yarn add cmdk

# Calendar (react-day-picker)
yarn add react-day-picker date-fns
```

### Dependencias Opcionales

```bash
# QR Code (para Receive page)
yarn add qrcode.react

# PDF Viewer (para Documents)
yarn add react-pdf

# Maps (para Flight Logs)
yarn add leaflet react-leaflet
```

### Instalar Todas las Dependencias

```bash
# Instalar todas las dependencias principales
yarn add react-hook-form @hookform/resolvers zod @tanstack/react-table recharts sonner cmdk react-day-picker date-fns

# Instalar dependencias opcionales (si las necesitas)
yarn add qrcode.react react-pdf leaflet react-leaflet
```

## ✅ Checklist de Instalación

### Paso 1: Instalar Componentes Core
- [ ] Ejecutar script de instalación o comando manual
- [ ] Verificar que los componentes se instalaron en `src/components/ui/`

### Paso 2: Instalar Dependencias
- [ ] Instalar dependencias principales
- [ ] Instalar dependencias opcionales (si aplica)

### Paso 3: Verificar
- [ ] Importar un componente de prueba
- [ ] Verificar que no hay errores de compilación
- [ ] Probar componente en desarrollo

## 🎯 Componentes por Página

### Home/Dashboard
- Card, Badge, Chart, Skeleton, Avatar, Button

### Accounts
- Table/Data Table, Card, Dialog, Form, Input, Select, Avatar, Badge, Dropdown Menu, Alert Dialog

### Send/Receive
- Form, Input, Combobox, Button, Dialog, Alert Dialog, Aspect Ratio (QR), Command

### Transactions
- Table/Data Table, Badge, Dialog, Pagination, Skeleton, Tooltip

### Documents
- Table, Card, Dialog, Form, Tabs, Scroll Area, Aspect Ratio, Empty

### Flight Logs
- Form, Calendar/Date Picker, Textarea, Card, Table, Chart, Carousel (fotos), Map (custom)

### Medical Records
- Form, Calendar/Date Picker, Textarea, Card, Table, Alert (encriptación)

### Attestations
- Card, Badge, Form, Combobox, Alert, Empty

### Settings
- Tabs, Form, Switch, Input, Select, Checkbox, Radio Group, Separator

### Global
- Sidebar, Navigation Menu, Command (Cmd+K), Toast (Sonner), Tooltip, Dropdown Menu

## Referencias

- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [shadcn/ui Installation](https://ui.shadcn.com/docs/installation)
- [React Hook Form](https://react-hook-form.com/)
- [TanStack Table](https://tanstack.com/table)
- [Recharts](https://recharts.org/)
- [Sonner](https://sonner.emilkowal.ski/)

