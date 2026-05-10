/**
 * Correo de bienvenida tras alta con org activa (no bloquea registro si falla el envío).
 */
import '../loadEnv.js'
import { getPlanEntitlements } from '../billing/planCatalog.js'
import { isMailerSendConfigured, sendMailerSendEmail } from './mailerSend.js'

function getFrontendAppBase(): string {
  return (process.env.AUTH_FRONTEND_ORIGIN || 'http://localhost:5173').trim().replace(/\/$/, '')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

function kindLabel(kind: string): string {
  const k = String(kind || '').toLowerCase()
  if (k === 'personal') return 'Cuenta personal'
  return 'Equipo / empresa'
}

function formatTrialEnd(trialEndsAt: Date | null): string | null {
  if (!trialEndsAt) return null
  try {
    return trialEndsAt.toLocaleDateString('es', {
      dateStyle: 'long',
      timeZone: 'UTC',
    })
  } catch {
    return trialEndsAt.toISOString().slice(0, 10)
  }
}

export type WelcomeEmailInput = {
  toEmail: string
  toName: string
  organizationName: string
  plan: string
  organizationKind: string
  trialEndsAt: Date | null
}

/**
 * Solo envía si MailerSend está configurado. Errores → log, nunca throw.
 * `AUTH_WELCOME_EMAIL_DISABLED=true` omite el envío (tests / staging).
 */
export async function sendWelcomeEmailSafe(input: WelcomeEmailInput): Promise<void> {
  if (process.env.AUTH_WELCOME_EMAIL_DISABLED === 'true') {
    console.info('[welcome-email] omitido (AUTH_WELCOME_EMAIL_DISABLED=true)')
    return
  }
  if (!isMailerSendConfigured()) {
    console.info(
      '[welcome-email] omitido: configura MAILERSEND_API_TOKEN y MAILERSEND_FROM_EMAIL en nelai-pwa/.env (mismo patrón que el correo de verificación).',
    )
    return
  }

  const email = input.toEmail.trim().toLowerCase()
  const name = (input.toName || email.split('@')[0] || 'Usuario').trim()
  const ent = getPlanEntitlements(input.plan)
  const trialLine = formatTrialEnd(input.trialEndsAt)
  const appUrl = getFrontendAppBase()
  const highlights = ent.highlights.slice(0, 4)
  const highlightsText = highlights.map((h) => `• ${h}`).join('\n')
  const highlightsHtml = highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')

  const planBlockText = [
    `Plan: ${ent.label}`,
    trialLine ? `Periodo de prueba hasta: ${trialLine} (UTC)` : null,
    `Organización: ${input.organizationName}`,
    `Tipo: ${kindLabel(input.organizationKind)}`,
    '',
    'Incluye en tu plan:',
    highlightsText,
    '',
    `Accede a la app: ${appUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  const planBlockHtml = [
    `<p><strong>Plan:</strong> ${escapeHtml(ent.label)}</p>`,
    trialLine
      ? `<p><strong>Prueba hasta:</strong> ${escapeHtml(trialLine)} <span style="color:#666;font-size:12px;">(UTC)</span></p>`
      : '',
    `<p><strong>Organización:</strong> ${escapeHtml(input.organizationName)}</p>`,
    `<p><strong>Tipo:</strong> ${escapeHtml(kindLabel(input.organizationKind))}</p>`,
    '<p><strong>Qué incluye tu plan</strong></p>',
    `<ul style="margin:0 0 1em 1.2em;padding:0;">${highlightsHtml}</ul>`,
    `<p><a href="${escapeAttr(appUrl)}">Abrir Nelai</a></p>`,
  ]
    .filter(Boolean)
    .join('')

  try {
    await sendMailerSendEmail({
      to: { email, name },
      subject: `Bienvenido a Nelai — ${ent.label}`,
      text: `Hola ${name},\n\nTu cuenta ya está activa.\n\n${planBlockText}\n\nGracias por confiar en Nelai.`,
      html: `<p>Hola ${escapeHtml(name)},</p><p>Tu cuenta ya está activa.</p>${planBlockHtml}<p style="color:#666;font-size:12px;">Gracias por confiar en Nelai.</p>`,
    })
    console.info(`[welcome-email] enviado a ${email}`)
  } catch (e: unknown) {
    console.error('[welcome-email] MailerSend rechazó o falló la petición:', e)
  }
}
