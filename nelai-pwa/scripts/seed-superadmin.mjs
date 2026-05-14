/**
 * Crea o promueve un usuario a platformRole superadmin (nunca vía registro HTTP público).
 * Usa `pg` (sin importar el cliente generado de Prisma) para evitar incompatibilidades de Node con el bundle .js.
 *
 * Uso:
 *   NELAI_SUPERADMIN_EMAIL=ops@tudominio.local NELAI_SUPERADMIN_PASSWORD=*** yarn db:seed:superadmin
 */
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const email = process.env.NELAI_SUPERADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.NELAI_SUPERADMIN_PASSWORD
const displayName = process.env.NELAI_SUPERADMIN_NAME?.trim() || 'Superadmin'

if (!email || !password) {
  console.error(
    'Faltan NELAI_SUPERADMIN_EMAIL y NELAI_SUPERADMIN_PASSWORD. Añádelas al .env y vuelve a ejecutar.',
  )
  process.exit(1)
}

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error('DATABASE_URL requerida.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()

const passwordHash = await bcrypt.hash(String(password), 10)

const existing = await client.query('SELECT id, display_name FROM users WHERE email = $1', [email])

try {
  if (existing.rowCount > 0) {
    const row = existing.rows[0]
    const disp =
      displayName && String(displayName).trim() ? displayName : row.display_name || 'Superadmin'
    await client.query(
      `UPDATE users SET
         password_hash = $1,
         display_name = $2,
         platform_role = 'superadmin'::"UserPlatformRole",
         email_verified_at = COALESCE(email_verified_at, NOW()),
         updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, disp, row.id],
    )
    console.log(
      'Listo: usuario existente promovido a superadmin; contraseña e identidad actualizadas.',
      email,
    )
  } else {
    const orgId = `org_${randomBytes(12).toString('hex')}`
    const userId = `usr_${randomBytes(12).toString('hex')}`

    await client.query(
      `INSERT INTO organizations (id, name, plan, kind, created_at, updated_at)
       VALUES ($1, $2, 'enterprise', 'team'::"OrganizationKind", NOW(), NOW())`,
      [orgId, 'Operaciones criterIA'],
    )

    await client.query(
      `INSERT INTO users (id, email, display_name, password_hash, org_role, platform_role, organization_id, email_verified_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'owner'::"OrgMemberRole", 'superadmin'::"UserPlatformRole", $5, NOW(), NOW(), NOW())`,
      [userId, email, displayName, passwordHash, orgId],
    )
    console.log('Listo: superadmin creado en org interna "Operaciones criterIA".', email)
  }
} finally {
  await client.end()
}

process.exit(0)
