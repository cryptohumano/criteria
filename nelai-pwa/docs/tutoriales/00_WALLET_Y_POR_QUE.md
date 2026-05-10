# Wallet local (Substrate) — por qué existe y por qué se bloquea

## ¿Qué es?

CriterIA usa una **wallet local** (Substrate keyring) para firmar y dar autoría verificable a tus documentos.  
Tus llaves **viven en tu dispositivo** y se guardan **encriptadas** (IndexedDB).

## ¿Por qué se bloquea cuando recargo?

Por seguridad, la app no mantiene tus llaves privadas en memoria después de:

- recargar la página
- cerrar/abrir la pestaña
- reiniciar el navegador

Cuando la wallet está **bloqueada**, no se puede firmar ni crear ciertos documentos hasta desbloquearla.

## ¿Cómo la desbloqueo?

En la parte superior de la app verás:

- **“Wallet bloqueada”** → botón **Desbloquear**

Ingresa tu contraseña (o WebAuthn si está disponible).  
Al desbloquear:

- el aviso desaparece
- tus cuentas vuelven a estar disponibles

## Una sola contraseña por wallet (vault)

En este dispositivo, CriterIA usa **una sola contraseña** para el vault:

- si ya tienes cuentas guardadas, al crear o importar otra cuenta debes usar **la misma contraseña**
- esto evita que “solo funcione la última contraseña”

## Si no veo el aviso pero no puedo crear documentos

Revisa:

- si estás en modo incógnito (a veces limita IndexedDB)
- permisos de almacenamiento del navegador
- recarga dura (Ctrl+Shift+R)

