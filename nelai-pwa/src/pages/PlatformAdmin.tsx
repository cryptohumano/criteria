import PlatformOverview from '@/pages/platform/PlatformOverview'

/**
 * Compat: el dashboard original se movió a rutas dentro de `/platform/*`.
 * Mantengo este entrypoint por si algo lo importaba indirectamente.
 */
export default function PlatformAdmin() {
  return <PlatformOverview />
}
