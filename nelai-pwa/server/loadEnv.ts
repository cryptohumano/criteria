/**
 * Carga `.env` / `.env.local` desde la raíz del PWA (no depende de `process.cwd()`).
 * Importar antes de leer `process.env` en cualquier módulo del servidor.
 */
import { config } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const NELAI_PWA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

config({ path: join(NELAI_PWA_ROOT, '.env') })
config({ path: join(NELAI_PWA_ROOT, '.env.local') })
