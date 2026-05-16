# Cuenta CriterIA (backend) vs cuenta Substrate (llave local)

En CriterIA conviven **dos identidades** distintas. Entender la diferencia es clave.

## 1) Cuenta CriterIA (sesión / backend)

Es tu **sesión de plataforma** (login):

- Vive en el backend de CriterIA (organización, plan, permisos).
- Sirve para acceder a funciones como:
  - abrir documentos del workspace
  - usar el agente (LLM proxy / políticas / cuotas)
  - integraciones del servidor (p. ej. Etherpad embed con sesión)

**Importante**: esta cuenta NO es tu llave criptográfica. Es un usuario “web”.

## 2) Cuenta Substrate (llave local)

Es tu **llave criptográfica local** (Substrate keyring):

- Vive en tu dispositivo (IndexedDB), cifrada (contraseña local del navegador o protección WebAuthn del dispositivo).
- Se usa para:
  - autoría verificable
  - firmas locales (cuando aplique)
  - operaciones criptográficas sin custodia en servidores de CriterIA

Por seguridad, al recargar la app el almacén puede estar **bloqueado** hasta que lo desbloquees.

## ¿Por qué existen ambas?

- La cuenta CriterIA gestiona **acceso y coordinación** (SaaS).
- La cuenta Substrate gestiona **autoría y firma** (no custodial, local).

Ambas son necesarias para el flujo completo de documentos: una para permisos/infra y otra para autoría/firma.

