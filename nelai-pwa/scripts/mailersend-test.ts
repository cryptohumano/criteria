/**
 * Prueba el token y el remitente: `MAILERSEND_TEST_TO=tu@correo.com yarn mailersend:test`
 * Carga `.env` desde la raíz del PWA.
 */
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendMailerSendEmail } from '../server/email/mailerSend'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
config({ path: join(root, '.env') })
config({ path: join(root, '.env.local') })
config({ path: join(process.cwd(), '.env') })
config({ path: join(process.cwd(), '.env.local') })

const to =
  process.argv[2]?.trim() ||
  process.env.MAILERSEND_TEST_TO?.trim()
if (!to) {
  console.error(
    'Falta el destino. Opciones:\n' +
      '  • En .env sin comentar (#): MAILERSEND_TEST_TO=tu@correo.com\n' +
      '  • O en la shell: MAILERSEND_TEST_TO=tu@correo.com yarn mailersend:test\n' +
      '  • O argumento: yarn mailersend:test tu@correo.com'
  )
  process.exit(1)
}

try {
  const out = await sendMailerSendEmail({
    to: { email: to, name: 'Prueba Nelai' },
    subject: '[Nelai] Prueba MailerSend',
    text: 'Si lees esto, el API token y el remitente están bien configurados.',
    html: '<p>Si lees esto, el <strong>API token</strong> y el remitente están bien configurados.</p>',
  })
  console.log('Enviado. x-message-id:', out.messageId ?? '(no devuelto)')
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
