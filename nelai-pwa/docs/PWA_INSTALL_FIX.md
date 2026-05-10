# Solución: No se puede instalar la PWA en móvil

## Problema

Puedes acceder a la PWA pero no instalarla. Esto ocurre porque:

1. **El certificado SSL no es confiable en el móvil** - mkcert genera certificados válidos solo en la máquina donde se instaló la CA
2. **Los navegadores móviles requieren certificados confiables para instalar PWAs**

## Soluciones

### ⭐ Solución Recomendada: localhost.run (Más fácil y rápido)

**localhost.run** es la solución más simple para desarrollo. Proporciona URLs HTTPS válidas automáticamente sin configuración adicional.

**Pasos:**

1. **Iniciar el servidor de desarrollo:**
   ```bash
   yarn dev
   # O si usas HTTPS local:
   yarn dev:https
   ```

2. **En otra terminal, crear el túnel:**
   ```bash
   yarn tunnel
   # O manualmente:
   ssh -R 80:localhost:5173 localhost.run
   ```

3. **Usar la URL proporcionada:**
   - Te dará una URL como: `https://abc123.localhost.run`
   - Esta URL funciona inmediatamente en cualquier dispositivo
   - **No necesitas estar en la misma red WiFi**
   - El certificado es válido automáticamente

4. **Instalar la PWA:**
   - Abre la URL en el navegador móvil
   - El certificado será confiable automáticamente
   - Instala la PWA desde el menú del navegador

**Ventajas:**
- ✅ Gratis y sin registro
- ✅ HTTPS válido automáticamente
- ✅ Funciona desde cualquier red
- ✅ No requiere configuración en el móvil
- ✅ Usa SSH nativo (ya instalado)

**Más información:** [localhost.run/docs/](https://localhost.run/docs/)

---

### Solución 1: Instalar el certificado CA en el móvil (Alternativa local)

#### Android (Chrome)

1. **Exportar el certificado CA desde tu PC:**
   ```bash
   # Encontrar la ubicación del certificado CA
   mkcert -CAROOT
   
   # Copiar el archivo rootCA.pem
   # Ejemplo: /home/USER/.local/share/mkcert/rootCA.pem
   ```

2. **Transferir el certificado al móvil:**
   - Envía el archivo `rootCA.pem` a tu móvil (email, USB, etc.)
   - Renómbralo a `rootCA.crt` (cambia la extensión)

3. **Instalar en Android:**
   - Ve a: **Configuración → Seguridad → Encriptación y credenciales → Instalar desde almacenamiento**
   - Selecciona el archivo `rootCA.crt`
   - Dale un nombre (ej: "mkcert CA")
   - Confirma la instalación

4. **Verificar:**
   - Reinicia Chrome en el móvil
   - Accede a `https://TU_IP:5173`
   - El certificado debería ser confiable ahora

#### iOS (Safari)

1. **Exportar el certificado CA:**
   ```bash
   mkcert -CAROOT
   # Copia rootCA.pem
   ```

2. **Transferir al iPhone/iPad:**
   - Envía el archivo por email o AirDrop
   - Ábrelo en el dispositivo

3. **Instalar en iOS:**
   - Ve a: **Configuración → General → Perfiles y Gestión de Dispositivos**
   - Toca el perfil del certificado
   - Toca "Instalar"
   - Confirma la instalación

4. **Habilitar confianza:**
   - Ve a: **Configuración → General → Acerca de → Certificados de confianza**
   - Activa el certificado "mkcert root certificate"

### Solución 2: Usar ngrok (Más fácil, pero requiere internet)

```bash
# Instalar ngrok
# https://ngrok.com/download

# Iniciar túnel
ngrok http 5173

# Usar la URL HTTPS proporcionada (ej: https://abc123.ngrok.io)
# Esta URL tiene certificado válido y funciona en cualquier dispositivo
```

**Ventajas:**
- ✅ Certificado válido automáticamente
- ✅ Funciona desde cualquier red
- ✅ No requiere configuración en el móvil

**Desventajas:**
- ⚠️ Requiere cuenta gratuita de ngrok
- ⚠️ URL cambia cada vez (a menos que uses plan de pago)
- ⚠️ Puede ser más lento

### Solución 3: Usar localhost.run (⭐ RECOMENDADO - Gratis, sin registro, HTTPS válido)

[localhost.run](https://localhost.run/docs/) es la solución más simple. Usa SSH (ya instalado en Linux/Mac) y proporciona URLs HTTPS válidas automáticamente.

**Ventajas:**
- ✅ **Gratis y sin registro**
- ✅ **HTTPS válido automáticamente** (certificado confiable)
- ✅ **No requiere instalar nada** (usa SSH nativo)
- ✅ **URLs estables** (mientras el túnel esté activo)
- ✅ **Funciona desde cualquier red**

**Uso:**

```bash
# Iniciar servidor de desarrollo primero (en otra terminal)
yarn dev

# En otra terminal, crear el túnel
ssh -R 80:localhost:5173 localhost.run

# Te dará una URL como: https://abc123.localhost.run
# Esta URL funciona inmediatamente en cualquier dispositivo
```

**Para desarrollo con HTTPS local:**

```bash
# Si usas certificados locales (yarn dev:https)
ssh -R 443:localhost:5173 localhost.run

# O mapear a puerto 80 (redirige a HTTPS automáticamente)
ssh -R 80:localhost:5173 localhost.run
```

**Nota:** La URL cambia cada vez que reinicias el túnel, pero mientras esté activo, es estable y funciona perfectamente para desarrollo.

### Solución 4: Usar Cloudflare Tunnel (cloudflared)

```bash
# Instalar cloudflared
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Crear túnel
cloudflared tunnel --url http://localhost:5173

# Te dará una URL HTTPS válida
```

## Verificación de la PWA

Después de aplicar una solución, verifica:

1. **Abre DevTools en el móvil:**
   - Chrome: chrome://inspect
   - Safari: Requiere Mac con Safari

2. **Verifica el manifest:**
   - Ve a `https://TU_URL/manifest.webmanifest`
   - Debe devolver JSON válido

3. **Verifica el service worker:**
   - En DevTools: Application → Service Workers
   - Debe estar registrado y activo

4. **Verifica los iconos:**
   - Los iconos deben estar accesibles
   - Tamaños: 192x192 y 512x512

## Requisitos para Instalación

Para que una PWA sea instalable, necesita:

- ✅ HTTPS válido (certificado confiable)
- ✅ Manifest válido y accesible
- ✅ Service Worker registrado
- ✅ Iconos válidos (192x192 y 512x512 mínimo)
- ✅ `display: 'standalone'` en el manifest
- ✅ `start_url` y `scope` configurados

## Solución Rápida: Crear Iconos Placeholder

Si faltan iconos, crea placeholders simples:

```bash
# Usar ImageMagick o crear SVGs simples
# Los iconos deben estar en public/
```

## Debugging

Si aún no funciona después de aplicar las soluciones:

1. **Verifica la consola del navegador móvil:**
   - Busca errores relacionados con el manifest
   - Verifica errores del service worker

2. **Verifica el manifest:**
   ```bash
   curl https://TU_URL/manifest.webmanifest
   ```

3. **Verifica que el service worker esté registrado:**
   - En DevTools: Application → Service Workers
   - Debe mostrar "activated and is running"

4. **Verifica los criterios de instalación:**
   - Chrome: chrome://flags → "Desktop PWAs" debe estar habilitado
   - El sitio debe cumplir los criterios de instalación

## Nota Importante

**Para producción**, necesitarás:
- Un dominio real
- Certificado SSL válido (Let's Encrypt es gratis)
- Servidor con HTTPS configurado correctamente

Los certificados de mkcert son **solo para desarrollo local**.

