# Acceso a la PWA desde Móvil

## Requisitos

Para que una PWA funcione correctamente en dispositivos móviles, **necesita HTTPS**. Esto es un requisito de los navegadores modernos para:
- Instalación de PWAs
- Service Workers
- APIs de seguridad (Web Crypto API, IndexedDB seguro)

## Configuración Rápida

### 1. Instalar mkcert

**Ubuntu/Debian:**
```bash
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/
```

**macOS:**
```bash
brew install mkcert
```

**Windows:**
```bash
choco install mkcert
# O descarga desde: https://github.com/FiloSottile/mkcert/releases
```

### 2. Generar Certificados SSL

```bash
# Ejecutar el script de configuración
yarn setup:https

# O manualmente:
mkdir -p .certs
mkcert -install  # Solo la primera vez
mkcert -key-file .certs/key.pem -cert-file .certs/cert.pem localhost 127.0.0.1 ::1 $(hostname -I | awk '{print $1}')
```

### 3. Iniciar Servidor con HTTPS

**Opción A: Usar localhost.run (⭐ RECOMENDADO - Más fácil)**

```bash
# Terminal 1: Iniciar servidor
yarn dev

# Terminal 2: Crear túnel HTTPS
yarn tunnel
# O: ssh -R 80:localhost:5173 localhost.run

# Usa la URL HTTPS proporcionada (ej: https://abc123.localhost.run)
# Esta URL funciona desde cualquier dispositivo con internet
```

**💡 Tip: Para dominios más estables, configura tu clave SSH:**
```bash
yarn setup:ssh
# Luego agrega tu clave en https://admin.localhost.run
```

Ver documentación completa: `docs/LOCALHOST_RUN_SETUP.md`

**Opción B: Usar certificados locales (misma red WiFi)**

```bash
yarn dev:https
```

El servidor iniciará en `https://localhost:5173` y también estará disponible en tu IP local.

### 4. Obtener tu IP Local

```bash
# Linux
hostname -I | awk '{print $1}'
# O
ip route get 1.1.1.1 | awk '{print $7; exit}'

# macOS
ipconfig getifaddr en0

# Windows
ipconfig | findstr IPv4
```

### 5. Acceder desde el Móvil

1. **Asegúrate de que tu PC y móvil estén en la misma red WiFi**
2. **En tu móvil, abre el navegador y ve a:**
   ```
   https://TU_IP_LOCAL:5173
   ```
   Ejemplo: `https://192.168.1.100:5173`

3. **Acepta el certificado:**
   - El navegador mostrará una advertencia de seguridad (es normal en desarrollo)
   - En Chrome: "Avanzado" → "Continuar a [IP] (no seguro)"
   - En Safari: "Mostrar detalles" → "Visitar este sitio web"

4. **⚠️ IMPORTANTE: Instalar el certificado CA en el móvil**
   
   Para que la PWA sea instalable, el certificado debe ser confiable:
   
   **Android:**
   - Exporta `rootCA.pem` desde tu PC (ubicación: `mkcert -CAROOT`)
   - Renómbralo a `rootCA.crt`
   - En el móvil: Configuración → Seguridad → Instalar desde almacenamiento
   - Selecciona el archivo y confirma
   
   **iOS:**
   - Envía `rootCA.pem` al iPhone/iPad
   - Configuración → General → Perfiles → Instalar
   - Configuración → General → Acerca de → Certificados de confianza → Activar
   
   **Ver documentación completa:** `docs/PWA_INSTALL_FIX.md`

5. **Instalar la PWA:**
   - **Android (Chrome)**: Menú → "Instalar app" o banner de instalación
   - **iOS (Safari)**: Compartir → "Añadir a pantalla de inicio"

## Verificación

### ¿IndexedDB está funcionando?

El keyring usa IndexedDB para almacenar cuentas encriptadas. Para verificar:

1. Abre las DevTools del navegador (F12)
2. Ve a "Application" → "IndexedDB"
3. Deberías ver la base de datos `pwa-substrate-keyring`
4. Al crear una cuenta con contraseña, debería aparecer en `encrypted-accounts`

### ¿El Keyring funciona en móvil?

**Sí, el keyring funciona tanto en escritorio como en móvil:**

- ✅ **Escritorio**: IndexedDB almacena en el perfil del navegador
- ✅ **Móvil**: IndexedDB almacena en el contenedor de la app PWA
- ✅ **Encriptación**: Funciona igual en ambas plataformas
- ✅ **Persistencia**: Los datos persisten entre sesiones

**Diferencias:**
- En móvil, los datos están más protegidos por el sandboxing del sistema
- En iOS, Data Protection encripta automáticamente cuando el dispositivo está bloqueado
- En Android, el almacenamiento está aislado por aplicación

## Solución de Problemas

### Error: "ERR_CERT_AUTHORITY_INVALID"

**Solución:** Asegúrate de haber ejecutado `mkcert -install` para instalar la CA local.

### No puedo acceder desde el móvil

1. Verifica que ambos dispositivos estén en la misma red WiFi
2. Verifica que el firewall de tu PC permita conexiones en el puerto 5173
3. Usa la IP correcta (no localhost)
4. Asegúrate de usar `https://` no `http://`

### El certificado no se acepta en iOS

iOS es más estricto con certificados. Opciones:
1. Usar un túnel como ngrok o localtunnel (gratis pero más lento)
2. Usar un certificado válido de Let's Encrypt (más complejo)
3. Para desarrollo, aceptar manualmente el certificado en iOS

### IndexedDB no funciona

1. Verifica que estés usando HTTPS (no HTTP)
2. Verifica que el navegador soporte IndexedDB
3. Revisa la consola del navegador para errores
4. En iOS, asegúrate de usar Safari (mejor soporte para PWAs)

## Alternativas para Desarrollo

### Opción 1: ngrok (Túnel público)

```bash
# Instalar ngrok
# https://ngrok.com/download

# Iniciar túnel
ngrok http 5173

# Usar la URL HTTPS proporcionada (ej: https://abc123.ngrok.io)
```

**Ventajas:** Funciona desde cualquier red, certificado válido
**Desventajas:** URL pública, puede ser lento

### Opción 2: localtunnel (Gratis)

```bash
npx localtunnel --port 5173
```

**Ventajas:** Gratis, fácil de usar
**Desventajas:** URL aleatoria, puede ser lento

### Opción 3: Usar el servidor de desarrollo de Vite con HTTPS

Ya configurado en este proyecto. Solo ejecuta `yarn dev:https` después de generar los certificados.

## Producción

Para producción, necesitarás:
- Un dominio real
- Certificado SSL válido (Let's Encrypt es gratis)
- Servidor con HTTPS configurado

El código de la PWA funciona igual en desarrollo y producción.

