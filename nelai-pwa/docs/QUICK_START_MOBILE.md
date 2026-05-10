# Inicio Rápido: Acceder desde Móvil

## Método Más Simple: localhost.run

### Paso 1: Iniciar el Servidor

```bash
# Terminal 1: Iniciar servidor de desarrollo
yarn dev
```

**Espera a ver:**
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://0.0.0.0:5173/
```

### Paso 2: Crear Túnel HTTPS

```bash
# Terminal 2: Crear túnel
yarn tunnel
```

**Verás algo como:**
```
✅ Túnel creado exitosamente!

📱 URL HTTPS pública:
   🔗 https://abc123.lhr.life
```

### Paso 3: Abrir en el Móvil

1. **Copia la URL** que te dio el túnel (ej: `https://abc123.lhr.life`)
2. **Ábrela en el navegador móvil**
3. **El certificado será válido automáticamente** ✅
4. **Instala la PWA** desde el menú del navegador

## Solución de Problemas

### Error: ERR_EMPTY_RESPONSE

**Causa:** El servidor no está corriendo o hay un desajuste HTTP/HTTPS.

**Solución:**

1. **Verifica que el servidor esté corriendo:**
   ```bash
   # Debe mostrar algo escuchando en el puerto 5173
   lsof -i :5173
   ```

2. **Verifica que funcione localmente:**
   - Abre `http://localhost:5173` en tu navegador
   - Debe cargar la aplicación

3. **Si usas `yarn dev:https` (HTTPS local):**
   ```bash
   # Usa túnel en puerto 443 para HTTPS
   ssh -R 443:localhost:5173 localhost.run
   ```

4. **Si usas `yarn dev` (HTTP):**
   ```bash
   # Usa túnel en puerto 80 para HTTP (el script lo detecta automáticamente)
   yarn tunnel
   ```

### El Túnel se Crea pero No Responde

**Verifica:**

1. El servidor debe estar en `host: '0.0.0.0'` en `vite.config.ts` ✅ (ya configurado)
2. No debe haber firewall bloqueando el puerto 5173
3. El servidor debe responder en `http://localhost:5173`

### Reiniciar Todo

```bash
# 1. Detener todos los procesos
pkill -f vite
pkill -f "ssh.*localhost.run"

# 2. Iniciar servidor
yarn dev

# 3. En otra terminal, crear túnel
yarn tunnel
```

## Verificación Rápida

✅ **Servidor corriendo:** `http://localhost:5173` funciona en tu PC  
✅ **Túnel creado:** `yarn tunnel` muestra una URL HTTPS  
✅ **URL accesible:** La URL funciona en el navegador móvil  
✅ **PWA instalable:** Aparece la opción de instalación en el menú

## Notas Importantes

- **La URL cambia cada vez** que reinicias el túnel
- **Mantén ambas terminales abiertas** (servidor + túnel)
- **El túnel se cierra** cuando cierras la terminal o presionas Ctrl+C
- **Para URL estable:** Crea cuenta en [localhost.run](https://localhost.run/docs/forever-free/)

