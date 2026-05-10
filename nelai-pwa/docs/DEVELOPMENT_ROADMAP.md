# Roadmap de Desarrollo - Aura Wallet

## Estado Actual

✅ **Completado**:
- Estructura de base de datos diseñada
- Estructura de UI/páginas diseñada
- API diseñada
- 21 componentes shadcn/ui instalados
- Documentación completa

⏳ **Pendiente**:
- Instalar componentes de prioridad media
- Configurar sistema de rutas
- Implementar base de datos (IndexedDB)
- Crear layout principal
- Implementar páginas principales

## Plan de Desarrollo - Fase 1: Fundación

### Paso 1: Completar Instalación de Componentes (30 min)

```bash
# Instalar componentes de prioridad media
bash scripts/install-shadcn-components.sh
# Seleccionar "y" para Prioridad Media

# Instalar dependencias adicionales
yarn add react-router-dom @tanstack/react-table recharts qrcode.react
```

**Componentes a instalar**:
- data-table, navigation-menu, breadcrumb
- checkbox, radio-group, switch, textarea
- dropdown-menu, context-menu
- progress, spinner, chart, empty
- pagination, scroll-area, aspect-ratio

### Paso 2: Configurar Sistema de Rutas (1 hora)

**Archivos a crear**:
- `src/router/index.tsx` - Configuración de rutas
- `src/pages/` - Directorio de páginas
- `src/layouts/` - Layouts principales

**Rutas iniciales**:
- `/` - Home/Dashboard
- `/accounts` - Lista de cuentas
- `/accounts/:address` - Detalle de cuenta
- `/send` - Enviar fondos
- `/receive` - Recibir fondos
- `/transactions` - Historial

### Paso 3: Crear Layout Principal (2 horas)

**Componentes**:
- `src/layouts/MainLayout.tsx` - Layout principal
- `src/components/layout/Header.tsx` - Header con navegación
- `src/components/layout/Sidebar.tsx` - Sidebar (desktop)
- `src/components/layout/BottomNav.tsx` - Bottom navigation (móvil)
- `src/components/layout/CommandPalette.tsx` - Command palette (Cmd+K)

**Características**:
- Responsive (Sidebar desktop, BottomNav móvil)
- Command palette para acciones rápidas
- Notificaciones (Sonner)
- Tema (dark/light)

### Paso 4: Implementar Base de Datos (3 horas)

**Archivos**:
- `src/db/auraWalletDB.ts` - Configuración de IndexedDB
- `src/db/migrations.ts` - Migraciones de schema
- `src/services/db/accounts.ts` - Servicio de cuentas
- `src/services/db/transactions.ts` - Servicio de transacciones
- `src/services/db/balances.ts` - Servicio de balances
- `src/services/db/settings.ts` - Servicio de configuración

**Funcionalidades**:
- Abrir/cerrar base de datos
- Migraciones automáticas
- CRUD para cada object store
- Validación de datos

### Paso 5: Crear Componentes Personalizados (2 horas)

**Componentes**:
- `src/components/ui/combobox.tsx` - Combobox (popover + command)
- `src/components/ui/date-picker.tsx` - Date picker (calendar + popover)
- `src/components/ui/qr-code.tsx` - QR Code
- `src/components/ui/address-display.tsx` - Mostrar dirección con copy
- `src/components/ui/balance-display.tsx` - Mostrar balance formateado

### Paso 6: Implementar Página Home/Dashboard (2 horas)

**Componentes**:
- `src/pages/Home.tsx` - Página principal
- `src/components/dashboard/BalanceCard.tsx` - Card de balance total
- `src/components/dashboard/AccountList.tsx` - Lista de cuentas
- `src/components/dashboard/RecentTransactions.tsx` - Transacciones recientes
- `src/components/dashboard/NetworkStatus.tsx` - Estado de redes

**Funcionalidades**:
- Mostrar balance total
- Lista de cuentas activas
- Últimas transacciones
- Estado de conexión

### Paso 7: Implementar Página Accounts (3 horas)

**Componentes**:
- `src/pages/Accounts.tsx` - Lista de cuentas
- `src/pages/AccountDetail.tsx` - Detalle de cuenta
- `src/pages/CreateAccount.tsx` - Crear cuenta
- `src/pages/ImportAccount.tsx` - Importar cuenta
- `src/components/accounts/AccountCard.tsx` - Card de cuenta
- `src/components/accounts/AccountForm.tsx` - Formulario de cuenta

**Funcionalidades**:
- Listar cuentas
- Ver detalle de cuenta
- Crear nueva cuenta
- Importar cuenta
- Editar metadata
- Eliminar cuenta

## Plan de Desarrollo - Fase 2: Funcionalidades Core

### Paso 8: Implementar Send/Receive (3 horas)
- Formulario de envío
- Confirmación de transacción
- Firma de transacción
- QR code para recibir
- Integración con keyring

### Paso 9: Implementar Transactions (2 horas)
- Lista de transacciones
- Filtros y búsqueda
- Detalle de transacción
- Integración con blockchain

### Paso 10: Implementar Networks (2 horas)
- Lista de redes
- Agregar red personalizada
- Conectar/desconectar
- Configuración

## Plan de Desarrollo - Fase 3: Funcionalidades Avanzadas

### Paso 11: Documents (4 horas)
- Lista de documentos
- Generar PDF
- Firmar documento
- Verificar firma

### Paso 12: Flight Logs (5 horas)
- Crear registro de vuelo
- Capturar GPS
- Capturar fotos con metadata
- Generar PDF
- Resumen y estadísticas

### Paso 13: Medical Records (4 horas)
- Crear registro médico
- Encriptación
- Generar PDF
- Control de acceso

### Paso 14: Attestations (4 horas)
- Crear credencial
- Verificar credencial
- Formato W3C VC
- Integración con documentos

## Orden Recomendado de Implementación

### Sprint 1: Fundación (Semana 1)
1. ✅ Completar instalación de componentes
2. ✅ Configurar rutas
3. ✅ Crear layout principal
4. ✅ Implementar base de datos
5. ✅ Crear componentes personalizados

### Sprint 2: Wallet Core (Semana 2)
6. ✅ Página Home/Dashboard
7. ✅ Página Accounts (lista, detalle, crear, importar)
8. ✅ Página Send/Receive
9. ✅ Página Transactions

### Sprint 3: Configuración y Redes (Semana 3)
10. ✅ Página Networks
11. ✅ Página Contacts
12. ✅ Página Settings
13. ✅ Sistema de sincronización

### Sprint 4: Documentos (Semana 4)
14. ✅ Página Documents
15. ✅ Generación de PDF
16. ✅ Firmas digitales

### Sprint 5: Funcionalidades Avanzadas (Semanas 5-6)
17. ✅ Flight Logs
18. ✅ Medical Records
19. ✅ Attestations
20. ✅ Integraciones externas

## Comandos Útiles

### Desarrollo
```bash
# Iniciar servidor de desarrollo
yarn dev

# Build de producción
yarn build

# Preview de producción
yarn preview
```

### Instalación
```bash
# Instalar componentes shadcn/ui
bash scripts/install-shadcn-components.sh

# Instalar dependencias
yarn install
```

### Base de Datos
```bash
# Ver base de datos en DevTools
# Chrome: Application > IndexedDB > aura-wallet
# Firefox: Storage > IndexedDB > aura-wallet
```

## Estructura de Carpetas Propuesta

```
src/
├── components/
│   ├── ui/              # Componentes shadcn/ui
│   ├── layout/          # Componentes de layout
│   ├── dashboard/       # Componentes de dashboard
│   ├── accounts/        # Componentes de cuentas
│   ├── transactions/    # Componentes de transacciones
│   └── ...
├── pages/               # Páginas de la aplicación
├── layouts/            # Layouts principales
├── router/             # Configuración de rutas
├── services/           # Servicios (API, DB, etc.)
│   ├── api/            # Servicios de API
│   ├── db/             # Servicios de base de datos
│   └── crypto/         # Servicios criptográficos
├── db/                 # Configuración de IndexedDB
│   ├── auraWalletDB.ts
│   └── migrations.ts
├── hooks/              # Custom hooks
├── contexts/           # React contexts
├── utils/              # Utilidades
└── types/              # TypeScript types
```

## Próximos Pasos Inmediatos

1. **Instalar componentes de prioridad media**
   ```bash
   bash scripts/install-shadcn-components.sh
   ```

2. **Instalar dependencias de routing**
   ```bash
   yarn add react-router-dom
   ```

3. **Crear estructura de carpetas**
   ```bash
   mkdir -p src/pages src/layouts src/router src/services/db src/components/layout
   ```

4. **Configurar rutas básicas**

5. **Crear layout principal**

¿Empezamos con el Paso 1?

