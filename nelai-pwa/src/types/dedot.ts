/**
 * Tipos helper para Dedot Client
 * Basado en: https://github.com/dedotdev/chaintypes/blob/main/packages/chaintypes/src/polkadot/query.d.ts
 */

import type { DedotClient } from 'dedot'

/**
 * Tipos para las queries de storage de Dedot
 * Estas son las queries disponibles según los tipos generados de Dedot
 */
export interface AccountInfo {
  nonce: number
  consumers: number
  providers: number
  sufficients: number
  data: {
    free: bigint
    reserved: bigint
    frozen?: bigint
    flags?: bigint
  }
}

export interface DedotQuery {
  system: {
    /**
     * The full account information for a particular account ID.
     * 
     * Uso:
     * - Query directa: await query.system.account(address)
     * - Con suscripción: await query.system.account(address, callback)
     * - Multi-query: await query.system.account.multi([addresses])
     * 
     * Basado en: https://github.com/dedotdev/chaintypes/blob/main/packages/chaintypes/src/polkadot/query.d.ts
     */
    account: ((address: string) => Promise<AccountInfo>) & 
             ((address: string, callback: (accountInfo: AccountInfo) => void) => Promise<() => void>) & {
      /**
       * Multi-query para múltiples cuentas en una sola llamada RPC
       * @param addresses - Array de direcciones SS58
       * @param callback - (Opcional) Función callback para suscripción
       */
      multi: ((addresses: string[]) => Promise<AccountInfo[]>) &
             ((addresses: string[], callback: (accountInfos: AccountInfo[]) => void) => Promise<() => void>)
    }

    /**
     * The current block number being processed.
     * 
     * Uso:
     * - Query directa: await query.system.number()
     * - Con suscripción: await query.system.number(callback)
     * 
     * Basado en: https://github.com/dedotdev/chaintypes/blob/main/packages/chaintypes/src/polkadot/query.d.ts
     */
    number: (() => Promise<number>) & 
            ((callback: (blockNumber: number) => void) => Promise<() => void>)

    /**
     * Events of the current block.
     * @returns Array de eventos
     */
    events: () => Promise<any[]>

    /**
     * Events of the current block (con suscripción).
     * @param callback - Función callback que recibe los eventos
     * @returns Función para desuscribirse
     */
    events: (callback: (events: any[]) => void) => Promise<() => void>

    /**
     * Hash of the previous block.
     * @returns H256 (hash)
     */
    parentHash: () => Promise<string>

    /**
     * Digest of the current block, also part of the block header.
     * @returns Digest
     */
    digest: () => Promise<any>

    /**
     * Extrinsics data for the current block.
     * @param index - Índice del extrinsic
     * @returns Bytes
     */
    extrinsicData: (index: number) => Promise<string>

    /**
     * Map of block numbers to block hashes.
     * @param blockNumber - Número de bloque
     * @returns H256 (hash)
     */
    blockHash: (blockNumber: number) => Promise<string>
  }

  balances?: {
    /**
     * The balance of an account.
     * @param address - AccountId32Like (SS58 address)
     * @returns PalletBalancesAccountData
     */
    account: (address: string) => Promise<{
      free: bigint
      reserved: bigint
      frozen?: bigint
      flags?: bigint
    }>
  }

  // Otros pallets disponibles según la cadena
  [pallet: string]: any
}

/**
 * Extensión del tipo DedotClient para incluir las queries tipadas
 */
export interface TypedDedotClient extends DedotClient {
  query: DedotQuery
}

/**
 * Helper para acceder a las queries de forma tipada
 */
export function getTypedQuery(client: DedotClient | null): DedotQuery | null {
  if (!client) return null
  return (client as any).query as DedotQuery
}

