# Solución de Problemas: Clave SSH en localhost.run

## Error: "User [email] not found"

Este error ocurre cuando intentas agregar una clave SSH pero:
- No has creado una cuenta en admin.localhost.run
- Estás usando un email diferente al de tu cuenta
- Tu sesión ha expirado

### Solución Paso a Paso

#### 1. Verificar que tienes una cuenta

1. Ve a: https://admin.localhost.run
2. Intenta iniciar sesión con tu email
3. Si no puedes iniciar sesión, crea una cuenta nueva:
   - Haz clic en "Sign up" o "Register"
   - Ingresa tu email y crea una contraseña
   - Verifica tu email si es necesario
   - Inicia sesión

#### 2. Verificar que estás usando el email correcto

- El email que uses para agregar la clave SSH debe ser el mismo con el que te registraste
- Si olvidaste qué email usaste, intenta recuperar tu contraseña

#### 3. Cerrar y volver a iniciar sesión

A veces la sesión expira. Intenta:
1. Cerrar sesión completamente
2. Limpiar las cookies del navegador (opcional)
3. Volver a iniciar sesión
4. Intentar agregar la clave SSH nuevamente

#### 4. Agregar la clave SSH correctamente

1. **Inicia sesión** en https://admin.localhost.run
2. Ve a la sección **"SSH Keys"** (puede estar en el menú lateral o en el dashboard)
3. Haz clic en **"Add SSH Key"** o el botón **"+"**
4. Completa el formulario:
   - **Description**: Un nombre descriptivo (ej: "Mi PC de desarrollo", "Laptop Ubuntu", etc.)
   - **SSH public key**: Pega tu clave pública completa (debe empezar con `ssh-rsa`, `ssh-ed25519`, etc.)
5. Haz clic en **"Save"** o **"Add"**

### Formato Correcto de la Clave SSH

Tu clave SSH pública debe tener este formato:

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCvZoY0rVt85nw3fdTdq5bWX00LvhlY3UBz1boeqdZwYdm49+k6Zsdh1s41d2hSAakNu6LKl3cuY+symzv4fieWRQZfyqu5ZZlYLiHOkQA/Se/5YCrCtA/Hq5Zr17rV8Axk9YzEgjRhcumH7vLrXszO/gP3RslJf1tdrKCK9EB4tOfiotj8032ZKJXcLr67aGzkdsmGZh4k1EFd7MfNT6EbmtgFD885A+JHerjrLCycWzv2ZDTlBhOMFRnqGc1FXStzd6q2szazJeVUYRE7W3eadVY/QsrVNOYzjjNXwtZN575luQ2cfSzstC0j4rlqXqW5u5zQH6oyLPx7Qq2GwVKqQMHbPqZOAekpeUB01Do2ewOnw8A91m9TeaaWIfcFbYcFJvaMvPPmIkoyP54FG71wffkV4/O/Q5rm9SSED9q7/z8qU4tyX+cqS48XT+xUG8/zOWdTg8seClTVrIQUhR19g+KxkQx+3PlD6xkS+/6HL6+gi7TTAZv6/XPfF0pY3uxgwAqBbFdY7DL2+HsvAvdNaQoTmGoT01+t5SrWD7fL7MG+aSWT3y4H8Mcs1LSuyPxTVaCVtHtYm2ROJOKgTcuFJVxVoYczd9954m7KiWYIg8c9Z61nfIAz3v2Y8yTQvbkgLkTiYn6LR9tpajrSsMi9Z4gK2zyczkj6cTctcgTiHQ== edgar@deku
```

**Importante:**
- Debe ser una sola línea
- Debe incluir todo el contenido (desde `ssh-rsa` hasta el final)
- No debe tener saltos de línea
- El email al final (`edgar@deku`) es opcional pero puede ayudar a identificarla

### Verificar que la Clave se Agregó Correctamente

Después de agregar la clave:

1. Deberías verla listada en la sección "SSH Keys"
2. Cuando ejecutes `yarn tunnel`, deberías ver:
   ```
   authenticated as tu-usuario
   ```
   En lugar de:
   ```
   authenticated as anonymous user
   ```

### Obtener tu Clave SSH Pública

Si necesitas ver tu clave SSH pública nuevamente:

```bash
# Para clave RSA
cat ~/.ssh/id_rsa.pub

# Para clave ed25519
cat ~/.ssh/id_ed25519.pub

# O usar el script del proyecto
yarn setup:ssh
```

### Problemas Comunes

#### "Permission denied (publickey)" al crear túnel

**Causa:** Tu clave SSH no está agregada en admin.localhost.run o está usando una clave diferente.

**Solución:**
1. Verifica qué clave está usando SSH:
   ```bash
   ssh -v -R 80:localhost:5173 localhost.run 2>&1 | grep "Offering public key"
   ```
2. Asegúrate de que esa clave esté agregada en admin.localhost.run
3. O especifica la clave explícitamente:
   ```bash
   ssh -i ~/.ssh/id_rsa -R 80:localhost:5173 localhost.run
   ```

#### La clave se agregó pero sigue siendo "anonymous user"

**Causa:** Puede haber un delay en la propagación o estás usando una clave diferente.

**Solución:**
1. Espera unos minutos y vuelve a intentar
2. Verifica que estés usando la clave correcta
3. Cierra la conexión SSH actual y crea un nuevo túnel

### Contacto

Si el problema persiste:
- Revisa la documentación oficial: https://localhost.run/docs/
- Verifica el estado del servicio en: https://admin.localhost.run
- Asegúrate de que tu cuenta esté activa y verificada

