/**
 * Utilidades para formatear balances de Substrate
 * Usa @polkadot/util para formatear correctamente los plancks según la cadena
 */

import { formatBalance } from '@polkadot/util'
import type { ChainInfo } from '@/hooks/useDedotClient'

// Configuración de decimales por cadena (por defecto 10 para Polkadot/Kusama)
const CHAIN_DECIMALS: Record<string, number> = {
  'polkadot': 10,
  'kusama': 12,
  'paseo': 10,
  'asset-hub-polkadot': 10,
  'asset-hub-kusama': 12,
  'asset-hub-paseo': 10,
  'people-polkadot': 10,
  'people-kusama': 12,
  'people-paseo': 10,
  'bridgehub-polkadot': 10,
  'bridgehub-kusama': 12,
  'bridgehub-paseo': 10,
  'coretime-polkadot': 10,
  'coretime-kusama': 12,
  'coretime-paseo': 10,
  'collectives-polkadot': 10,
  'collectives-kusama': 12,
  'collectives-paseo': 10,
}

// Símbolos por cadena
const CHAIN_SYMBOLS: Record<string, string> = {
  'polkadot': 'DOT',
  'kusama': 'KSM',
  'paseo': 'PASE',
  'asset-hub-polkadot': 'DOT',
  'asset-hub-kusama': 'KSM',
  'asset-hub-paseo': 'PASE',
  'people-polkadot': 'DOT',
  'people-kusama': 'KSM',
  'people-paseo': 'PASE',
  'bridgehub-polkadot': 'DOT',
  'bridgehub-kusama': 'KSM',
  'bridgehub-paseo': 'PASE',
  'coretime-polkadot': 'DOT',
  'coretime-kusama': 'KSM',
  'coretime-paseo': 'PASE',
  'collectives-polkadot': 'DOT',
  'collectives-kusama': 'KSM',
  'collectives-paseo': 'PASE',
}

/**
 * Obtiene los decimales de una cadena basándose en su nombre o endpoint
 */
export function getChainDecimals(chainNameOrEndpoint: string | null | undefined): number {
  if (!chainNameOrEndpoint || typeof chainNameOrEndpoint !== 'string') {
    // Por defecto, usar 10 (Polkadot estándar) si no se proporciona nombre
    return 10
  }
  
  const chainKey = chainNameOrEndpoint.toLowerCase()
  
  // Buscar en el nombre de la cadena
  for (const [key, decimals] of Object.entries(CHAIN_DECIMALS)) {
    if (chainKey.includes(key)) {
      return decimals
    }
  }
  
  // Por defecto, usar 10 (Polkadot estándar)
  return 10
}

/**
 * Obtiene el símbolo de una cadena basándose en su nombre o endpoint
 */
export function getChainSymbol(chainNameOrEndpoint: string | null | undefined): string {
  if (!chainNameOrEndpoint || typeof chainNameOrEndpoint !== 'string') {
    // Por defecto, usar DOT si no se proporciona nombre
    return 'DOT'
  }
  
  const chainKey = chainNameOrEndpoint.toLowerCase()
  
  // Buscar en el nombre de la cadena
  for (const [key, symbol] of Object.entries(CHAIN_SYMBOLS)) {
    if (chainKey.includes(key)) {
      return symbol
    }
  }
  
  // Por defecto, usar DOT
  return 'DOT'
}

/**
 * Formatea un balance de plancks a formato legible
 * @param value Balance en plancks (bigint)
 * @param chainName Nombre o endpoint de la cadena
 * @param options Opciones de formateo
 */
export function formatBalanceFromPlancks(
  value: bigint | string | number,
  chainName?: string | null,
  options: {
    withUnit?: boolean
    decimals?: number
    forceUnit?: string
  } = {}
): string {
  const decimals = options.decimals ?? getChainDecimals(chainName)
  const unit = options.forceUnit ?? getChainSymbol(chainName)
  
  // Convertir a string si es bigint o number
  const valueStr = typeof value === 'bigint' 
    ? value.toString() 
    : typeof value === 'number' 
    ? value.toString() 
    : value

  // Usar formatBalance de @polkadot/util
  const formatted = formatBalance(valueStr, {
    decimals,
    withUnit: options.withUnit ?? true,
    forceUnit: unit,
  })

  return formatted
}

/**
 * Convierte un balance formateado de vuelta a plancks
 * @param formatted Balance formateado (ej: "1.2345 DOT")
 * @param chainName Nombre o endpoint de la cadena
 */
export function parseBalanceToPlancks(
  formatted: string,
  chainName: string
): bigint {
  const decimals = getChainDecimals(chainName)
  
  // Remover el símbolo y espacios
  const cleaned = formatted.replace(/[^\d.,]/g, '').replace(',', '')
  const numericValue = parseFloat(cleaned)
  
  if (isNaN(numericValue)) {
    return BigInt(0)
  }
  
  // Multiplicar por 10^decimals para obtener plancks
  const multiplier = BigInt(10 ** decimals)
  const plancks = BigInt(Math.floor(numericValue * Number(multiplier)))
  
  return plancks
}

/**
 * Formatea un balance para mostrar en la UI
 * @param value Balance en plancks
 * @param chainName Nombre de la cadena
 */
export function formatBalanceForDisplay(
  value: bigint | string | number,
  chainName?: string | null
): string {
  return formatBalanceFromPlancks(value, chainName, {
    withUnit: true,
  })
}

/**
 * Formatea un balance sin unidad (solo número)
 * @param value Balance en plancks
 * @param chainName Nombre de la cadena
 */
export function formatBalanceNumber(
  value: bigint | string | number,
  chainName: string
): string {
  return formatBalanceFromPlancks(value, chainName, {
    withUnit: false,
  })
}

