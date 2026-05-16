# Llave local (Substrate) — por qué existe y por qué se bloquea

## ¿Qué es?

CriterIA usa una **llave local** (Substrate keyring) en tu navegador para firmar y dar autoría verificable a tus documentos.  
Tus claves **viven en tu dispositivo** y se guardan **cifradas** (IndexedDB). No las almacenamos en nuestros servidores.

## ¿Por qué se bloquea cuando recargo?

Por seguridad, la app no mantiene tus claves privadas en memoria después de:

- recargar la página
- cerrar/abrir la pestaña
- reiniciar el navegador

Cuando el almacén está **bloqueado**, no se puede firmar ni crear ciertos documentos hasta desbloquearlo.

## ¿Cómo lo desbloqueo?

En la parte superior de la app verás un aviso tipo **«Llave local bloqueada»** → botón **Desbloquear**.

Según cómo creaste el almacén en este equipo:

- **Con el dispositivo (WebAuthn)**: huella, rostro o PIN del sistema (p. ej. Windows Hello, Touch ID).
- **Solo con contraseña local**: la contraseña que definiste para cifrar el vault en el navegador (no es la misma que el login de la plataforma).

Al desbloquear:

- el aviso desaparece
- tus cuentas vuelven a estar disponibles en memoria

## Frase de recuperación

Si creaste la identidad con WebAuthn, la **frase mnemónica** no se muestra en el primer paso; puedes verla cuando la necesites en **Configuración → Seguridad → Frase de recuperación**, con verificación del dispositivo.

Si usas **solo contraseña** en el navegador, la misma contraseña sirve para desbloquear y para cifrar nuevas cuentas en ese vault.

## Si no veo el aviso pero no puedo crear documentos

Revisa:

- si estás en modo incógnito (a veces limita IndexedDB)
- permisos de almacenamiento del navegador
- recarga dura (Ctrl+Shift+R)
