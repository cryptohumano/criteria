/**
 * UI del editor colaborativo (Etherpad) embebido en la PWA.
 *
 * En producción los controles de depuración (recargar sesión, «Leer texto», export MD, detalles técnicos)
 * quedan ocultos para no confundir a usuarios finales. Actívalos con `VITE_ETHERPAD_DEV_CONTROLS=true` en el build,
 * o trabaja con `vite dev` (por defecto visibles en desarrollo).
 */
export const showEtherpadDevControls =
  import.meta.env.VITE_ETHERPAD_DEV_CONTROLS === 'true' ||
  (!import.meta.env.PROD && import.meta.env.VITE_ETHERPAD_DEV_CONTROLS !== 'false')
