# Configuración de localhost.run

## Plan Gratuito (Sin Registro)

localhost.run ofrece un plan gratuito que:
- ✅ **No requiere descarga de cliente**
- ✅ **No requiere registro** para túneles de corta duración
- ✅ **HTTPS válido automáticamente**
- ✅ **Funciona desde cualquier red**

### Limitaciones del Plan Gratuito

1. **Los nombres de dominio cambian regularmente** - Cada vez que creas un túnel, obtienes una URL diferente
2. **Límite de velocidad** - Puede ser más lento que los planes de pago
3. **Túneles de corta duración** - Se desconectan cuando cierras la sesión SSH

Estas limitaciones están en su lugar para prevenir sitios de phishing.

## Mejorar el Dominio Gratuito (Recomendado)

Si quieres que tu dominio gratuito dure más tiempo, puedes registrarte y agregar tu clave SSH:

### Pasos para Configurar

1. **Registrarse en admin.localhost.run:**
   - Ve a: https://admin.localhost.run
   - Haz clic en "Sign up" o "Register"
   - Crea una cuenta con tu email (gratis)
   - **Importante:** Verifica tu email si es necesario
   - Inicia sesión después de crear la cuenta

2. **Obtener tu clave SSH pública:**
   ```bash
   # Si ya tienes una clave SSH
   cat ~/.ssh/id_rsa.pub
   # O
   cat ~/.ssh/id_ed25519.pub
   
   # Si no tienes una clave SSH, genera una:
   ssh-keygen -t ed25519 -C "tu-email@ejemplo.com"
   # Luego copia la clave pública:
   cat ~/.ssh/id_ed25519.pub
   ```

3. **Agregar la clave en admin.localhost.run:**
   - Ve a: https://admin.localhost.run
   - Inicia sesión
   - Ve a la sección "SSH Keys"
   - Agrega una nueva clave:
     - **Description**: Un nombre descriptivo (ej: "Mi PC de desarrollo")
     - **SSH public key**: Pega el contenido de tu clave pública

4. **Beneficios:**
   - ✅ Dominio más estable (dura más tiempo)
   - ✅ Mismo dominio al reconectar
   - ✅ Autenticación automática (no pide contraseña)
   - ✅ Mejor rendimiento

### Verificar que la Clave Está Configurada

Después de agregar tu clave SSH, cuando ejecutes `yarn tunnel`, deberías ver:
```
authenticated as tu-usuario
```

En lugar de:
```
authenticated as anonymous user
```

## Planes de Pago (Dominios Personalizados)

Si necesitas un dominio completamente estable y sin límites de velocidad, considera un plan de pago:

- **Dominio personalizado estable**
- **Sin límites de velocidad**
- **TLS Passthrough** (para usar tus propios certificados)

Más información: https://admin.localhost.run

## Uso Básico (Sin Registro)

Si no quieres registrarte, puedes usar localhost.run directamente:

```bash
# Crear túnel básico (sin clave SSH)
ssh -R 80:localhost:5173 nokey@localhost.run

# O usar el script del proyecto
yarn tunnel 5173 nokey
```

**Nota:** 
- El dominio cambiará cada vez que crees un nuevo túnel
- Usa `nokey@localhost.run` para evitar el error "Permission denied (publickey)"
- Para dominios más estables, configura tu clave SSH (ver arriba)

### Mantener la Conexión Estable

Para evitar que el túnel se desconecte por inactividad, usa keepalives:

```bash
# Con keepalives (recomendado)
ssh -o ServerAliveInterval=60 -R 80:localhost:5173 nokey@localhost.run

# O usar el script del proyecto (ya incluye keepalives)
yarn tunnel
```

**Keepalives:**
- Envían un paquete cada 60 segundos para mantener la conexión activa
- Detectan rápidamente si la conexión se rompió
- Previenen timeouts de routers en internet

### Auto-Healing (Reconexión Automática)

Para reconexión automática si el túnel se cae, usa `autossh`:

```bash
# Instalar autossh
# Ubuntu/Debian: sudo apt install autossh
# macOS: brew install autossh

# Usar autossh (el script lo detecta automáticamente)
autossh -M 0 -o ServerAliveInterval=60 -R 80:localhost:5173 nokey@localhost.run
```

**Ventajas de autossh:**
- ✅ Reconecta automáticamente si el túnel se cae
- ✅ Mantiene el túnel activo sin intervención manual
- ✅ Útil para desarrollo continuo

## Solución de Problemas

### "Permission denied (publickey)"

Si ves este error, significa que:
1. No tienes una clave SSH configurada
2. Tu clave no está agregada en admin.localhost.run

**Solución:**
- Genera una clave SSH si no tienes una
- Agrega la clave pública en https://admin.localhost.run

### El dominio cambia cada vez

**Solución:** Registra tu clave SSH en admin.localhost.run para obtener dominios más estables.

### Túnel se desconecta frecuentemente

**Causas comunes:**
- Conexión a internet inestable
- Timeout de SSH
- El servidor local se detuvo

**Solución:** Asegúrate de que:
1. El servidor local esté corriendo (`yarn dev` o `yarn dev:https`)
2. Tu conexión a internet sea estable
3. Considera usar un plan de pago para mayor estabilidad

## Referencias

- Documentación oficial: https://localhost.run/docs/
- Panel de administración: https://admin.localhost.run
- Guía de túneles HTTP: https://localhost.run/docs/http-tunnels/
- Guía de túneles TLS: https://localhost.run/docs/tls-passthru-tunnels/

