import { isMailerSendConfigured } from '../email/mailerSend.js'

/**
 * Registro con contraseña exige verificar correo (enlace mágico) cuando MailerSend está configurado.
 * Desactivar explícitamente: AUTH_REQUIRE_EMAIL_VERIFICATION=false
 */
export function isEmailVerificationRequiredForPasswordRegister(): boolean {
  if (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'false') return false
  return isMailerSendConfigured()
}

/** Base pública del API para enlaces en correos (p. ej. https://api.tudominio.com). */
export function getAuthApiPublicBaseUrl(): string {
  const raw = process.env.AUTH_API_PUBLIC_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  const port = process.env.C2PA_PORT || '3456'
  return `http://127.0.0.1:${port}`
}
