# Configuración shadcn/ui MCP Server

## ✅ Estado de Compatibilidad

El proyecto **AndinoWalletPWA** está **completamente compatible** con shadcn/ui:

### Configuración Verificada

- ✅ **components.json**: Configurado correctamente con estilo `new-york`
- ✅ **52 componentes instalados**: Todos los componentes UI están en `src/components/ui/`
- ✅ **Dependencias**: Todas las dependencias de Radix UI instaladas
- ✅ **Utilidades**: Función `cn()` disponible en `@/lib/utils`
- ✅ **Aliases**: Configurados correctamente (`@/components/ui`, `@/lib/utils`, etc.)
- ✅ **Patrón de componentes**: Los componentes siguen el estándar shadcn/ui

### Componentes Instalados

El proyecto tiene instalados los siguientes componentes de shadcn/ui:

- accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button
- calendar, card, carousel, chart, checkbox, collapsible, command
- context-menu, dialog, drawer, dropdown-menu, empty, fab, field, form
- hover-card, input-group, input-otp, input, item, kbd, label
- menubar, navigation-menu, pagination, popover, progress, radio-group
- resizable, scroll-area, select, separator, sheet, sidebar, skeleton
- slider, sonner, spinner, switch, table, tabs, textarea
- toggle, toggle-group, tooltip

## 🔧 Configuración del Servidor MCP

### Archivo de Configuración

Se ha creado el archivo `.cursor/mcp.json` con la siguiente configuración:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

### Pasos para Activar el Servidor MCP

1. **Reiniciar Cursor**: Después de crear el archivo de configuración, reinicia Cursor completamente.

2. **Habilitar el Servidor MCP**:
   - Ve a **Cursor Settings** (⌘, o Ctrl+,)
   - Busca "MCP" en la configuración
   - Encuentra el servidor "shadcn" en la lista
   - Habilítalo (deberías ver un punto verde indicando que está conectado)

3. **Verificar la Conexión**:
   - En Cursor, puedes usar el comando `/mcp` para ver el estado de los servidores MCP
   - Deberías ver "shadcn" con estado "Connected" (punto verde)

## 📖 Cómo Usar el Servidor MCP

Una vez activado, puedes usar lenguaje natural para interactuar con los componentes de shadcn/ui:

### Ejemplos de Uso

#### 1. Explorar Componentes Disponibles
```
Muéstrame todos los componentes disponibles en el registro de shadcn
```

#### 2. Buscar Componentes Específicos
```
Encuéntrame un componente de formulario de login del registro de shadcn
```

#### 3. Instalar Componentes
```
Agrega el componente combobox a mi proyecto
```

```
Crea un formulario de contacto usando componentes de shadcn
```

#### 4. Trabajar con Múltiples Componentes
```
Instala los componentes data-table, pagination y skeleton
```

```
Crea una página de dashboard usando componentes de shadcn: card, chart, y badge
```

### Comandos Útiles

- **Explorar**: "Muéstrame componentes de [tipo]" 
- **Buscar**: "Encuéntrame un [componente]"
- **Instalar**: "Agrega [componente] a mi proyecto"
- **Crear**: "Crea un [formulario/página] usando componentes de shadcn"

## 🔍 Verificación del Proyecto

### Estructura de Componentes

Los componentes están correctamente organizados:

```
src/
├── components/
│   └── ui/          # Componentes de shadcn/ui (52 componentes)
├── lib/
│   └── utils.ts     # Función cn() para merge de clases
└── ...
```

### Patrón de Uso Verificado

Los componentes se importan correctamente usando los aliases configurados:

```tsx
// ✅ Correcto
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
```

### Ejemplo de Componente

El componente `Button` sigue el patrón estándar de shadcn/ui:

- ✅ Usa `class-variance-authority` para variantes
- ✅ Usa la función `cn()` para merge de clases
- ✅ Extiende correctamente las props de React
- ✅ Usa `forwardRef` para referencias

## 🛠️ Solución de Problemas

### El Servidor MCP No Responde

1. **Verificar Configuración**: Asegúrate de que `.cursor/mcp.json` existe y tiene el formato correcto
2. **Reiniciar Cursor**: Reinicia completamente Cursor después de crear la configuración
3. **Verificar Instalación**: Asegúrate de que `shadcn` CLI está disponible (`npx shadcn@latest --version`)
4. **Revisar Logs**: En Cursor, ve a View → Output y selecciona `MCP: project-*` en el dropdown

### Componentes No Se Instalan

1. **Verificar components.json**: Asegúrate de que el archivo existe y está bien formateado
2. **Verificar Permisos**: Asegúrate de tener permisos de escritura en `src/components/ui/`
3. **Verificar Dependencias**: Asegúrate de que las dependencias necesarias están instaladas

### No Aparecen Herramientas o Prompts

1. **Limpiar caché de npx**: Ejecuta `npx clear-npx-cache`
2. **Re-habilitar el servidor**: Intenta deshabilitar y volver a habilitar el servidor MCP en Cursor
3. **Verificar Logs**: Revisa los logs de MCP en Cursor para ver errores

## 📚 Referencias

- [Documentación shadcn/ui MCP](https://ui.shadcn.com/docs/mcp)
- [Documentación de Registros shadcn/ui](https://ui.shadcn.com/docs/registry)
- [Especificación MCP](https://modelcontextprotocol.io/)

## ✨ Próximos Pasos

1. **Reinicia Cursor** para cargar la configuración MCP
2. **Habilita el servidor shadcn** en Cursor Settings
3. **Prueba el servidor** con comandos como:
   - "Muéstrame todos los componentes disponibles"
   - "Agrega el componente combobox a mi proyecto"

¡El proyecto está listo para usar el servidor MCP de shadcn/ui! 🎉
