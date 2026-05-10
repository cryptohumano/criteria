import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'prisma/config'

const root = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(root, '.env') })
config({ path: resolve(root, '.env.local') })

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  throw new Error(
    'DATABASE_URL no está definida. Copia .env.example a .env en la raíz del proyecto y ajusta usuario, contraseña y nombre de la base (PostgreSQL debe existir o crearse antes).',
  )
}

/**
 * Configuración Prisma ORM 7 (CLI: migrate, generate, studio).
 * @see https://www.prisma.io/docs/orm/reference/prisma-config-reference
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url,
  },
})
