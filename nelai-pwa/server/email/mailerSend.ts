/**
 * Envío transaccional vía MailerSend REST API (Bearer).
 * Requiere dominio/remitente permitidos en el panel de MailerSend.
 */

export interface MailerSendRecipient {
  email: string
  name?: string
}

export interface SendMailerSendEmailInput {
  to: MailerSendRecipient
  subject: string
  text?: string
  html?: string
}

export function isMailerSendConfigured(): boolean {
  return Boolean(
    process.env.MAILERSEND_API_TOKEN?.trim() && process.env.MAILERSEND_FROM_EMAIL?.trim()
  )
}

export async function sendMailerSendEmail(input: SendMailerSendEmailInput): Promise<{ messageId?: string }> {
  const token = process.env.MAILERSEND_API_TOKEN?.trim()
  const fromEmail = process.env.MAILERSEND_FROM_EMAIL?.trim()
  const fromName = (process.env.MAILERSEND_FROM_NAME || 'Nelai').trim()
  if (!token) throw new Error('MAILERSEND_API_TOKEN no está configurado')
  if (!fromEmail) throw new Error('MAILERSEND_FROM_EMAIL no está configurado')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    throw new Error(
      'MAILERSEND_FROM_EMAIL debe ser un correo completo (p. ej. noreply@test-xxxxx.mlsender.net), no solo el dominio.'
    )
  }
  if (!input.text?.trim() && !input.html?.trim()) {
    throw new Error('Debes indicar text o html en el correo')
  }

  const to: Record<string, string> = { email: input.to.email.trim().toLowerCase() }
  if (input.to.name?.trim()) to.name = input.to.name.trim()

  const body: Record<string, unknown> = {
    from: { email: fromEmail, name: fromName },
    to: [to],
    subject: input.subject.trim(),
  }
  if (input.text?.trim()) body.text = input.text.trim()
  if (input.html?.trim()) body.html = input.html.trim()

  const res = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const messageId = res.headers.get('x-message-id') || undefined
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`MailerSend HTTP ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return { messageId }
}
