# Cuenta CriterIA (backend) vs Cuenta Substrate (wallet local)

En CriterIA conviven **dos identidades** distintas. Entender la diferencia es clave.

## 1) Cuenta CriterIA (sesión / backend)

Es tu **sesión de plataforma** (login):

- Vive en el backend de CriterIA (organización, plan, permisos).
- Sirve para acceder a funciones como:
  - abrir documentos del workspace
  - usar el agente (LLM proxy / políticas / cuotas)
  - integraciones del servidor (p. ej. Etherpad embed con sesión)

**Importante**: esta cuenta NO es tu llave criptográfica. Es un usuario “web”.

## 2) Cuenta Substrate (wallet local)

Es tu **wallet local** (Substrate keyring):

- Vive en tu dispositivo (IndexedDB), encriptada con tu contraseña.
- Se usa para:
  - autoría verificable
  - firmas locales (cuando aplique)
  - operaciones criptográficas sin custodios

Por seguridad, al recargar la app la wallet puede estar **bloqueada** hasta que la desbloqueas.

## ¿Por qué existen ambas?

- La cuenta CriterIA gestiona **acceso y coordinación** (SaaS).
- La cuenta Substrate gestiona **autoría y firma** (no custodial, local).

Ambas son necesarias para el flujo completo de documentos: una para permisos/infra y otra para autoría/firma.

