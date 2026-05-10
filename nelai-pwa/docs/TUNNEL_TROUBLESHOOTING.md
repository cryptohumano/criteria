# Solución de Problemas: Túnel localhost.run

## Errores Comunes

### Error: "Permission denied (publickey)" en túnel gratuito

**Causa:** Estás intentando usar autenticación con clave SSH pero no está configurada.

**Solución para túneles gratuitos:**
```bash
# Usa nokey@localhost.run para evitar la verificación de clave SSH
ssh -R 80:localhost:5173 nokey@localhost.run

# O con el script:
yarn tunnel 5173 nokey
```

**Solución para dominios personalizados:**
```bash
# Si tienes un dominio personalizado, usa plan@localhost.run
ssh -R example.com:80:localhost:5173 plan@localhost.run
```

### Error: ERR_EMPTY_RESPONSE

Este error significa que el túnel se creó correctamente, pero el servidor local no está respondiendo o hay un desajuste entre HTTP/HTTPS.

### Causas Comunes

1. **El servidor no está corriendo** cuando se crea el túnel
2. **El servidor no acepta conexiones externas** (debe estar en `0.0.0.0`, no `localhost`)
3. **Desajuste HTTP/HTTPS** entre el servidor y el túnel
4. **Firewall bloqueando** el puerto local

### Solución Rápida

**Si estás usando `yarn dev` (HTTP):**
```bash
# El servidor está en HTTP, usa túnel en puerto 80
ssh -R 80:localhost:5173 localhost.run
```

**Si estás usando `yarn dev:https` (HTTPS):**
```bash
# El servidor está en HTTPS, usa túnel en puerto 443
ssh -R 443:localhost:5173 localhost.run
```

**O mejor aún, usa el script que detecta automáticamente:**
```bash
yarn tunnel
```

El script ahora detecta automáticamente si el servidor usa HTTP o HTTPS y configura el túnel correctamente.

### Verificación Paso a Paso

#### 1. Verificar que el servidor esté corriendo

```bash
# Verificar si hay algo escuchando en el puerto 5173
lsof -i :5173
# O
netstat -tuln | grep 5173
```

**Si no hay nada:**
```bash
# Iniciar el servidor en una terminal
yarn dev
# O si usas HTTPS local:
yarn dev:https
```

#### 2. Verificar que el servidor esté accesible localmente

Abre en tu navegador local:
- `http://localhost:5173` (si usas `yarn dev`)
- `https://localhost:5173` (si usas `yarn dev:https`)

**Si no funciona localmente, el túnel tampoco funcionará.**

#### 3. Verificar la configuración del servidor

El servidor debe estar configurado para aceptar conexiones:

```typescript
// vite.config.ts
server: {
  host: '0.0.0.0', // Importante: permite conexiones externas
  port: 5173,
}
```

#### 4. Verificar el puerto en el túnel

El túnel debe apuntar al mismo puerto:

```bash
# Si el servidor está en puerto 5173
ssh -R 80:localhost:5173 localhost.run

# Si el servidor está en otro puerto, ajusta:
ssh -R 80:localhost:3000 localhost.run  # Para puerto 3000
```

### Solución Rápida

1. **Termina todos los procesos en el puerto 5173:**
   ```bash
   pkill -f vite
   # O
   killall node
   ```

2. **Inicia el servidor de desarrollo:**
   ```bash
   yarn dev
   ```

3. **Verifica que funcione localmente:**
   - Abre `http://localhost:5173` en tu navegador
   - Debe cargar la aplicación

4. **En otra terminal, crea el túnel:**
   ```bash
   yarn tunnel
   ```

5. **Usa la URL proporcionada en tu móvil**

### Problemas Comunes

#### El servidor está corriendo pero no responde

**Causa:** El servidor puede estar escuchando solo en `127.0.0.1` en lugar de `0.0.0.0`

**Solución:** Verifica `vite.config.ts`:
```typescript
server: {
  host: '0.0.0.0', // ✅ Correcto - acepta conexiones externas
  // host: 'localhost', // ❌ Incorrecto - solo conexiones locales
}
```

#### El puerto está ocupado

**Solución:**
```bash
# Ver qué está usando el puerto
lsof -i :5173

# Cambiar el puerto en vite.config.ts o usar otro puerto
yarn dev --port 3000
# Y ajustar el túnel:
ssh -R 80:localhost:3000 localhost.run
```

#### Firewall bloqueando conexiones

**Solución:**
```bash
# Permitir conexiones en el puerto (Ubuntu/Debian)
sudo ufw allow 5173

# O deshabilitar temporalmente el firewall para desarrollo
sudo ufw disable  # ⚠️ Solo para desarrollo local
```

#### El servidor se detiene cuando creas el túnel

**Causa:** Puede ser un problema con el proceso en background

**Solución:** Asegúrate de que el servidor esté corriendo en una terminal separada antes de crear el túnel.

### Verificación Final

Después de seguir los pasos, verifica:

1. ✅ Servidor corriendo: `http://localhost:5173` funciona
2. ✅ Túnel creado: `yarn tunnel` muestra una URL
3. ✅ URL accesible: La URL del túnel carga en el navegador móvil

### Alternativa: Usar ngrok

Si localhost.run sigue dando problemas:

```bash
# Instalar ngrok
# https://ngrok.com/download

# Iniciar túnel
ngrok http 5173

# Usar la URL HTTPS proporcionada
```

### Debugging Avanzado

#### Ver logs del servidor

```bash
# Iniciar con logs detallados
yarn dev --debug
```

#### Verificar conexión del túnel

```bash
# Probar conexión SSH
ssh -v -R 80:localhost:5173 localhost.run
```

#### Verificar que el servidor acepta conexiones externas

```bash
# Desde otra máquina en la misma red
curl http://TU_IP_LOCAL:5173
```

Si esto funciona, el túnel también debería funcionar.

