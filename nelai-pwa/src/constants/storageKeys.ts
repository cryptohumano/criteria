/** Claves de `localStorage` (prefijo `criteria-` en el cliente PWA). */
export const CRITERIA_STORAGE = {
  apiConfigs: 'criteria-api-configs',
  contacts: 'criteria-contacts',
  activeAccount: 'criteria-active-account',
} as const

/** Claves legacy (Nelai) para migración/compatibilidad. */
export const LEGACY_NELAI_STORAGE = {
  apiConfigs: 'nelai-api-configs',
  contacts: 'nelai-contacts',
  activeAccount: 'nelai-active-account',
} as const
