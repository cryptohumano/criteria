import { useState, useEffect } from 'react'
import { DedotClient } from 'dedot'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Package, ChevronRight, ChevronDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Componente para explorar todas las pallets disponibles en una cadena
 * Basado en la metadata de Dedot
 */
interface PalletsExplorerProps {
  client: DedotClient | null
}

interface QueryMetadata {
  name: string
  parameters?: string[]
  returnType?: string
  description?: string
  hasMulti?: boolean
}

interface TransactionMetadata {
  name: string
  parameters?: string[]
  description?: string
}

interface PalletInfo {
  name: string
  transactions?: string[]
  transactionsMetadata?: Record<string, TransactionMetadata>
  queries?: string[]
  queriesMetadata?: Record<string, QueryMetadata>
  constants?: string[]
  events?: string[]
  description?: string
}

// Metadata conocida de queries según los tipos generados de Dedot
// Basado en: https://github.com/dedotdev/chaintypes/blob/main/packages/chaintypes/src/polkadot/query.d.ts
const KNOWN_QUERIES_METADATA: Record<string, Record<string, QueryMetadata>> = {
  system: {
    account: { name: 'account', parameters: ['address'], hasMulti: true, description: 'Información completa de una cuenta' },
    'account.multi': { name: 'account.multi', parameters: ['addresses'], description: 'Multi-query para múltiples cuentas' },
    number: { name: 'number', description: 'Número del bloque actual' },
    parentHash: { name: 'parentHash', description: 'Hash del bloque padre' },
    digest: { name: 'digest', description: 'Digest del bloque actual' },
    extrinsicData: { name: 'extrinsicData', parameters: ['index'], description: 'Datos de un extrinsic por índice' },
    blockHash: { name: 'blockHash', parameters: ['blockNumber'], description: 'Hash de un bloque por número' },
    events: { name: 'events', description: 'Eventos del bloque actual' },
    extrinsicCount: { name: 'extrinsicCount', description: 'Número de extrinsics en el bloque' },
    blockWeight: { name: 'blockWeight', description: 'Peso del bloque' },
    allExtrinsicsLen: { name: 'allExtrinsicsLen', description: 'Longitud total de todos los extrinsics' },
    eventCount: { name: 'eventCount', description: 'Número de eventos' },
    eventTopics: { name: 'eventTopics', parameters: ['topic'], description: 'Eventos por topic' },
    lastRuntimeUpgrade: { name: 'lastRuntimeUpgrade', description: 'Última actualización del runtime' },
  },
  balances: {
    account: { name: 'account', parameters: ['address'], hasMulti: true, description: 'Balance de una cuenta' },
    locks: { name: 'locks', parameters: ['address'], description: 'Locks de balance de una cuenta' },
    reserves: { name: 'reserves', parameters: ['address'], description: 'Reservas de balance de una cuenta' },
    totalIssuance: { name: 'totalIssuance', description: 'Emisión total de tokens' },
    inactiveIssuance: { name: 'inactiveIssuance', description: 'Emisión inactiva de tokens' },
    systemReserve: { name: 'systemReserve', description: 'Reserva del sistema' },
    existentialDeposit: { name: 'existentialDeposit', description: 'Depósito existencial mínimo' },
  },
  staking: {
    validatorCount: { name: 'validatorCount', description: 'Número de validadores' },
    minimumValidatorCount: { name: 'minimumValidatorCount', description: 'Número mínimo de validadores' },
    invulnerables: { name: 'invulnerables', description: 'Validadores invulnerables' },
    bonded: { name: 'bonded', parameters: ['address'], description: 'Información de bonding de una cuenta' },
    ledger: { name: 'ledger', parameters: ['address'], description: 'Ledger de staking de una cuenta' },
    payee: { name: 'payee', parameters: ['address'], description: 'Destinatario de recompensas' },
    validators: { name: 'validators', description: 'Lista de validadores activos' },
    nominators: { name: 'nominators', parameters: ['address'], description: 'Nominaciones de una cuenta' },
    currentEra: { name: 'currentEra', description: 'Era actual' },
    activeEra: { name: 'activeEra', description: 'Era activa' },
    erasStakers: { name: 'erasStakers', parameters: ['era', 'address'], description: 'Stakers de una era y validador' },
    erasValidatorPrefs: { name: 'erasValidatorPrefs', parameters: ['era', 'address'], description: 'Preferencias de validador en una era' },
  },
  session: {
    validators: { name: 'validators', description: 'Validadores de la sesión actual' },
    currentIndex: { name: 'currentIndex', description: 'Índice de la sesión actual' },
    queuedKeys: { name: 'queuedKeys', description: 'Claves en cola para la próxima sesión' },
    disabledValidators: { name: 'disabledValidators', description: 'Validadores deshabilitados' },
    nextKeys: { name: 'nextKeys', parameters: ['address'], description: 'Próximas claves de una cuenta' },
  },
  timestamp: {
    now: { name: 'now', description: 'Timestamp actual' },
    didUpdate: { name: 'didUpdate', description: 'Si el timestamp se actualizó' },
  },
}

// Storage queries conocidas según los tipos generados de Dedot
// Basado en: https://github.com/dedotdev/chaintypes/blob/main/packages/chaintypes/src/polkadot/query.d.ts
const KNOWN_STORAGE_QUERIES: Record<string, string[]> = {
  system: [
    'account', 'account.multi', 'extrinsicCount', 'blockWeight', 'allExtrinsicsLen',
    'blockHash', 'extrinsicData', 'number', 'parentHash', 'digest', 'events',
    'eventCount', 'eventTopics', 'lastRuntimeUpgrade', 'upgradedToU32RefCount',
    'upgradedToTripleRefCount', 'executionPhase', 'codeUpgradeAuthorization'
  ],
  balances: [
    'account', 'locks', 'reserves', 'totalIssuance', 'inactiveIssuance',
    'systemReserve', 'existentialDeposit'
  ],
  timestamp: ['now', 'didUpdate'],
  session: [
    'validators', 'currentIndex', 'queuedChanged', 'queuedKeys', 'disabledValidators',
    'nextKeys', 'keyOwner', 'nextKeyFor'
  ],
  staking: [
    'validatorCount', 'minimumValidatorCount', 'invulnerables', 'bonded', 'ledger',
    'payee', 'validators', 'counterForValidators', 'nominators', 'counterForNominators',
    'currentEra', 'activeEra', 'erasStartSessionIndex', 'erasStakers', 'erasStakersClipped',
    'erasValidatorPrefs', 'erasValidatorReward', 'erasRewardPoints', 'erasTotalStake',
    'erasTotalStakeClipped', 'forceEra', 'slashRewardFraction', 'canceledSlashPayout',
    'unappliedSlashes', 'bondedEras', 'validatorSlashInEra', 'nominatorSlashInEra',
    'slashingSpans', 'spanSlash', 'currentPlannedSession', 'offendingValidators',
    'chillThreshold', 'maxNominatorRewardedPerValidator', 'minimumActiveStake',
    'counterForValidators', 'counterForNominators'
  ],
  democracy: [
    'publicProps', 'depositOf', 'referendumCount', 'referendumInfoOf', 'votingOf',
    'locks', 'lastTabledWasExternal', 'nextExternal', 'blacklist', 'cancellations',
    'storageVersion'
  ],
  treasury: [
    'proposalCount', 'proposals', 'approvals', 'deactivated', 'approvals'
  ],
  utility: ['multisigs', 'calls'],
  identity: [
    'identityOf', 'superOf', 'subsOf', 'registrars', 'account'
  ],
  multisig: [
    'multisigs', 'calls'
  ],
  proxy: [
    'proxies', 'announcements'
  ],
  scheduler: [
    'agenda', 'lookup', 'retryConfig'
  ],
  preimage: [
    'preimageFor', 'statusFor', 'requestStatusFor'
  ],
  babe: [
    'epochStart', 'authorities', 'genesisSlot', 'currentSlot', 'randomness',
    'pendingEpochConfigChange', 'nextRandomness', 'nextEpochStart', 'underConstruction',
    'initialized', 'nextAuthorities', 'segmentIndices'
  ],
  grandpa: [
    'state', 'pendingChange', 'nextForced', 'stalled', 'currentSetId', 'setState'
  ],
  imOnline: [
    'heartbeatAfter', 'keys', 'receivedHeartbeats', 'authoredBlocks'
  ],
  parachains: [
    'pastCodeHash', 'upcomingUpgrades', 'upgradeCooldowns', 'upgradeRestrictionSignal',
    'upgradeGoAheadSignal', 'relayDispatchQueueSize', 'relayDispatchQueue',
    'validationData', 'didSetValidationCode', 'lastRelayChainBlockNumber'
  ],
  paras: [
    'heads', 'currentCodeHash', 'pastCodeHash', 'upgradeCooldowns', 'upgradeRestrictionSignal',
    'upgradeGoAheadSignal', 'relayDispatchQueueSize', 'relayDispatchQueue', 'validationData',
    'didSetValidationCode', 'lastRelayChainBlockNumber', 'lifecycle', 'futureCodeUpgrades',
    'futureCodeHash', 'pastCodeMeta', 'pastCodePruning', 'codeByHash', 'pvfCheckActiveVoteState',
    'pvfCheckActiveVoteOutcome', 'authorizedUpgradeHashes'
  ],
  hrmp: [
    'hrmpOpenChannelRequests', 'hrmpChannels', 'hrmpIngressChannelsIndex',
    'hrmpEgressChannelsIndex', 'hrmpChannelContents', 'hrmpChannelDigests'
  ],
  crowdloan: [
    'funds', 'endingsCount', 'newRaise', 'leases', 'nextTrieIndex'
  ],
  slots: [
    'leases', 'incompleteSlots'
  ],
  auctions: [
    'auctionInfo', 'reservedAmounts'
  ],
  nominationPools: [
    'minJoinBond', 'minCreateBond', 'maxPools', 'maxPoolMembers', 'maxPoolMembersPerPool',
    'poolMembers', 'bondedPools', 'rewardPools', 'subPoolsStorage', 'metadata', 'counterForPoolMembers',
    'counterForBondedPools', 'counterForRewardPools', 'lastPoolId', 'reversePoolIdLookup',
    'claimPermissions', 'counterForReversePoolIdLookup'
  ],
  fastUnstake: [
    'head', 'queue', 'counterForQueue'
  ],
  bagsList: [
    'listNodes', 'listBags', 'counterForListNodes'
  ],
  vesting: [
    'vesting', 'vestingNonce'
  ],
  bounties: [
    'bountyCount', 'bounties', 'bountyDescriptions', 'bountyApprovals'
  ],
  childBounties: [
    'parentChildBounties', 'childBountyCount', 'childBounties', 'childrenCuratorFees'
  ],
  electionProviderMultiPhase: [
    'round', 'currentPhase', 'queedSolution', 'snapshot', 'desiredTargets',
    'snapshotMetadata', 'signedSubmissionNextIndex', 'signedSubmissionIndices',
    'signedSubmissionsMap', 'minimumUntrustedScore'
  ],
  xcm: [
    'queryCounter', 'assetTraps', 'safeXcmVersion', 'supportedVersion', 'versionNotifiers',
    'versionNotifyTargets', 'versionDiscoveryQueue', 'currentMigration', 'lockers',
    'remoteLockedFungibles', 'authorizedAliases'
  ],
  messageQueue: [
    'serviceHead', 'bookState', 'pages'
  ],
  rcMigrator: [
    'migrationStage', 'accounts', 'migratedBalances', 'pendingXcmMessages',
    'counterForPendingXcmMessages', 'pureProxyCandidatesMigrated', 'pendingXcmQueries',
    'unprocessedMsgBuffer', 'ahUmpQueuePriorityConfig', 'manager', 'canceller',
    'migrationStartBlock', 'migrationEndBlock', 'warmUpPeriod', 'coolOffPeriod',
    'settings', 'managerMultisigs', 'managerMultisigRound', 'managerVotesInCurrentRound'
  ]
}

export function PalletsExplorer({ client }: PalletsExplorerProps) {
  const [open, setOpen] = useState(false)
  const [pallets, setPallets] = useState<PalletInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPallets, setExpandedPallets] = useState<Set<string>>(new Set())
  const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!open || !client) {
      return
    }

    const fetchPallets = async () => {
      setLoading(true)
      setError(null)

      try {
        // Verificar que el cliente esté conectado
        const provider = (client as any).provider
        if (!provider || typeof provider.send !== 'function') {
          throw new Error('Provider no disponible')
        }

        // Verificar conexión
        if (provider.isConnected && typeof provider.isConnected === 'function') {
          if (!provider.isConnected()) {
            throw new Error('Cliente no conectado. Espera un momento e intenta de nuevo.')
          }
        }

        // Esperar un momento adicional para asegurar que el cliente esté completamente inicializado
        await new Promise(resolve => setTimeout(resolve, 500))

        const palletsList: PalletInfo[] = []

        // Obtener metadata usando state_getMetadata
        const metadataHex = await provider.send('state_getMetadata', [])
        
        if (!metadataHex) {
          throw new Error('No se pudo obtener metadata')
        }

        // La metadata viene como hex string, necesitamos decodificarla
        // Usaremos el cliente de Dedot para parsear la metadata si está disponible
        let metadata: any = null
        
        try {
          // Intentar usar el parser de metadata de Dedot si está disponible
          if ((client as any).metadata) {
            metadata = (client as any).metadata
          } else {
            // Si no está disponible, intentar parsear manualmente usando el RPC
            // O usar un enfoque alternativo: obtener las pallets desde las APIs disponibles
            throw new Error('Metadata parser no disponible')
          }
        } catch (err) {
          // Fallback: usar un enfoque híbrido - obtener pallets desde las APIs disponibles
          console.debug('Usando enfoque híbrido para obtener pallets')
        }

        // Mapear pallets desde las APIs disponibles de manera segura
        const txPallets: Record<string, string[]> = {}
        const queryPallets: Record<string, string[]> = {}
        const constsPallets: Record<string, string[]> = {}
        const eventsPallets: Record<string, string[]> = {}

        // Función helper para verificar si una propiedad existe sin acceder a su valor
        const hasProperty = (obj: any, prop: string): boolean => {
          if (!obj || typeof obj !== 'object') return false
          try {
            return prop in obj
          } catch {
            return false
          }
        }

        // Función helper para obtener propiedades de manera segura
        const getSafeProperties = (obj: any, filterFn?: (key: string) => boolean): string[] => {
          if (!obj || typeof obj !== 'object') return []
          
          try {
            return Object.getOwnPropertyNames(obj)
              .filter(key => {
                if (key.startsWith('_') || key === 'constructor') return false
                if (filterFn && !filterFn(key)) return false
                return true
              })
          } catch {
            return []
          }
        }

        // Estrategia principal: Obtener TODAS las pallets disponibles dinámicamente desde el cliente
        console.log('Iniciando búsqueda dinámica de pallets desde el cliente...')
        
        // Obtener todas las pallets conocidas para usar como referencia
        const allKnownPallets = new Set(Object.keys(KNOWN_STORAGE_QUERIES))
        
        // Mapa para almacenar metadata de queries y transacciones
        const queriesMetadataMap: Record<string, Record<string, QueryMetadata>> = {}
        const transactionsMetadataMap: Record<string, Record<string, TransactionMetadata>> = {}
        
        // Obtener TODAS las pallets disponibles en client.query
        if ((client as any).query) {
          const queryApi = (client as any).query
          const allQueryPallets = getSafeProperties(queryApi)
          console.log(`[Query] Pallets encontradas dinámicamente: ${allQueryPallets.length}`, allQueryPallets)
          
          for (const palletName of allQueryPallets) {
            try {
              if (palletName === 'constructor' || palletName.startsWith('_')) continue
              
              const palletApi = queryApi[palletName]
              if (palletApi && typeof palletApi === 'object') {
                // Obtener TODAS las queries disponibles en esta pallet
                const palletQueries = getSafeProperties(palletApi, (key) => {
                  return hasProperty(palletApi, key) && key !== 'constructor' && !key.startsWith('_')
                })
                
                console.log(`[Query] ${palletName}: ${palletQueries.length} queries encontradas`, palletQueries)
                
                if (palletQueries.length > 0) {
                  queryPallets[palletName] = palletQueries
                  
                  // Obtener metadata de cada query
                  const metadata: Record<string, QueryMetadata> = {}
                  const knownMetadata = KNOWN_QUERIES_METADATA[palletName] || {}
                  
                  for (const queryName of palletQueries) {
                    try {
                      // Usar metadata conocida si está disponible
                      if (knownMetadata[queryName]) {
                        metadata[queryName] = { ...knownMetadata[queryName] }
                      } else {
                        metadata[queryName] = { name: queryName }
                      }
                      
                      // Verificar si tiene .multi y obtener parámetros
                      const queryFn = palletApi[queryName]
                      if (queryFn) {
                        metadata[queryName].hasMulti = hasProperty(queryFn, 'multi')
                        
                        // Intentar obtener parámetros
                        try {
                          const fnString = queryFn.toString()
                          const patterns = [
                            /\(([^)]*)\)/,
                            /function\s+\w+\s*\(([^)]*)\)/,
                            /=>\s*\(([^)]*)\)/,
                          ]
                          
                          for (const pattern of patterns) {
                            const paramsMatch = fnString.match(pattern)
                            if (paramsMatch && paramsMatch[1] && paramsMatch[1].trim()) {
                              const params = paramsMatch[1]
                                .split(',')
                                .map(p => p.trim())
                                .filter(p => p && p !== 'callback' && !p.startsWith('...'))
                                .map(p => {
                                  const typeMatch = p.match(/^(\w+)(?::.*)?$/)
                                  return typeMatch ? typeMatch[1] : p
                                })
                              if (params.length > 0) {
                                metadata[queryName].parameters = params
                                break
                              }
                            }
                          }
                        } catch (err) {
                          console.debug(`Error parseando parámetros de ${palletName}.${queryName}:`, err)
                        }
                      }
                    } catch (err) {
                      metadata[queryName] = { name: queryName }
                    }
                  }
                  
                  queriesMetadataMap[palletName] = metadata
                }
              }
            } catch (err) {
              console.debug(`Error procesando pallet query ${palletName}:`, err)
            }
          }
        }
        
        // Obtener TODAS las pallets disponibles en client.tx
        if ((client as any).tx) {
          const txApi = (client as any).tx
          const allTxPallets = getSafeProperties(txApi)
          console.log(`[Tx] Pallets encontradas dinámicamente: ${allTxPallets.length}`, allTxPallets)
          
          for (const palletName of allTxPallets) {
            try {
              if (palletName === 'constructor' || palletName.startsWith('_')) continue
              
              const palletApi = txApi[palletName]
              if (palletApi && typeof palletApi === 'object') {
                // Obtener TODAS las transacciones disponibles en esta pallet
                const palletTxs = getSafeProperties(palletApi, (key) => {
                  return hasProperty(palletApi, key) && key !== 'constructor' && !key.startsWith('_')
                })
                
                console.log(`[Tx] ${palletName}: ${palletTxs.length} transacciones encontradas`, palletTxs)
                
                if (palletTxs.length > 0) {
                  txPallets[palletName] = palletTxs
                  
                  // Obtener metadata de cada transacción
                  const metadata: Record<string, TransactionMetadata> = {}
                  
                  for (const txName of palletTxs) {
                    try {
                      const txFn = palletApi[txName]
                      if (txFn && typeof txFn === 'function') {
                        // Intentar obtener parámetros de la transacción
                        try {
                          const fnString = txFn.toString()
                          const patterns = [
                            /\(([^)]*)\)/,
                            /function\s+\w+\s*\(([^)]*)\)/,
                            /=>\s*\(([^)]*)\)/,
                          ]
                          
                          for (const pattern of patterns) {
                            const paramsMatch = fnString.match(pattern)
                            if (paramsMatch && paramsMatch[1] && paramsMatch[1].trim()) {
                              const params = paramsMatch[1]
                                .split(',')
                                .map(p => p.trim())
                                .filter(p => p && p !== 'callback' && !p.startsWith('...'))
                                .map(p => {
                                  const typeMatch = p.match(/^(\w+)(?::.*)?$/)
                                  return typeMatch ? typeMatch[1] : p
                                })
                              if (params.length > 0) {
                                metadata[txName] = {
                                  name: txName,
                                  parameters: params,
                                }
                                break
                              }
                            }
                          }
                          
                          // Si no encontramos parámetros, crear metadata básica
                          if (!metadata[txName]) {
                            metadata[txName] = { name: txName }
                          }
                        } catch (err) {
                          metadata[txName] = { name: txName }
                        }
                      } else {
                        metadata[txName] = { name: txName }
                      }
                    } catch (err) {
                      metadata[txName] = { name: txName }
                    }
                  }
                  
                  transactionsMetadataMap[palletName] = metadata
                }
              }
            } catch (err) {
              console.debug(`Error procesando pallet tx ${palletName}:`, err)
            }
          }
        }
        
        // Fallback: Si no encontramos pallets dinámicamente, usar las conocidas
        if (Object.keys(queryPallets).length === 0 && Object.keys(txPallets).length === 0) {
          console.warn('No se encontraron pallets dinámicamente, usando lista conocida como fallback...')
          const allKnownPallets = new Set(Object.keys(KNOWN_STORAGE_QUERIES))
          
          if ((client as any).query) {
            const queryApi = (client as any).query
            
            for (const palletName of allKnownPallets) {
              try {
                if (hasProperty(queryApi, palletName)) {
                  queryPallets[palletName] = KNOWN_STORAGE_QUERIES[palletName] || []
                  
                  // Intentar obtener metadata de cada query
                  const palletQueries = queryPallets[palletName]
                  const metadata: Record<string, QueryMetadata> = {}
                  
                  // Primero, usar metadata conocida si está disponible
                  const knownMetadata = KNOWN_QUERIES_METADATA[palletName] || {}
                  
                  try {
                    const palletApi = queryApi[palletName]
                    if (palletApi && typeof palletApi === 'object') {
                      for (const queryName of palletQueries) {
                        try {
                          // Usar metadata conocida si está disponible
                          if (knownMetadata[queryName]) {
                            metadata[queryName] = { ...knownMetadata[queryName] }
                            // Verificar si realmente tiene .multi en el cliente
                            if (hasProperty(palletApi, queryName)) {
                              const queryFn = palletApi[queryName]
                              if (queryFn) {
                                metadata[queryName].hasMulti = hasProperty(queryFn, 'multi')
                              }
                            }
                          } else {
                            // Si no tenemos metadata conocida, intentar obtenerla
                            if (hasProperty(palletApi, queryName)) {
                              const queryFn = palletApi[queryName]
                              
                              if (queryFn) {
                                // Verificar si tiene método .multi
                                const hasMulti = hasProperty(queryFn, 'multi')
                                
                                // Intentar obtener información de la función usando toString
                                let params: string[] | undefined = undefined
                                try {
                                  const fnString = queryFn.toString()
                                  console.log(`[Metadata] ${palletName}.${queryName} toString:`, fnString.substring(0, 200))
                                  
                                  // Buscar parámetros en la firma de la función
                                  // Intentar diferentes patrones
                                  const patterns = [
                                    /\(([^)]*)\)/,
                                    /function\s+\w+\s*\(([^)]*)\)/,
                                    /=>\s*\(([^)]*)\)/,
                                  ]
                                  
                                  for (const pattern of patterns) {
                                    const paramsMatch = fnString.match(pattern)
                                    if (paramsMatch && paramsMatch[1] && paramsMatch[1].trim()) {
                                      params = paramsMatch[1]
                                        .split(',')
                                        .map(p => p.trim())
                                        .filter(p => p && p !== 'callback' && !p.startsWith('...'))
                                        .map(p => {
                                          // Limpiar tipos TypeScript si existen
                                          const typeMatch = p.match(/^(\w+)(?::.*)?$/)
                                          return typeMatch ? typeMatch[1] : p
                                        })
                                      if (params.length > 0) break
                                    }
                                  }
                                } catch (err) {
                                  console.debug(`Error parseando parámetros de ${palletName}.${queryName}:`, err)
                                }
                                
                                metadata[queryName] = {
                                  name: queryName,
                                  parameters: params && params.length > 0 ? params : undefined,
                                  hasMulti,
                                }
                              } else {
                                metadata[queryName] = {
                                  name: queryName,
                                }
                              }
                            } else {
                              metadata[queryName] = {
                                name: queryName,
                              }
                            }
                          }
                        } catch (err) {
                          // Si no podemos obtener metadata, usar conocida o básica
                          metadata[queryName] = knownMetadata[queryName] || {
                            name: queryName,
                          }
                        }
                      }
                    } else {
                      // Si no podemos acceder al pallet, usar metadata conocida o básica
                      for (const queryName of palletQueries) {
                        metadata[queryName] = knownMetadata[queryName] || {
                          name: queryName,
                        }
                      }
                    }
                  } catch (err) {
                    // Si falla completamente, usar metadata conocida o básica
                    for (const queryName of palletQueries) {
                      metadata[queryName] = knownMetadata[queryName] || {
                        name: queryName,
                      }
                    }
                  }
                  
                  queriesMetadataMap[palletName] = metadata
                  console.log(`✓ Pallet encontrada: ${palletName} (${queryPallets[palletName].length} queries)`)
                }
              } catch (err) {
                console.debug(`Error verificando pallet ${palletName}:`, err)
              }
            }
          }
        }
        

        // Buscar pallets adicionales que no estén en la lista conocida
        if ((client as any).tx) {
          try {
            const txApi = (client as any).tx
            const txPalletNames = getSafeProperties(txApi)
            
            console.log('Pallets adicionales encontradas en client.tx:', txPalletNames.filter(n => !allKnownPallets.has(n)))

            for (const palletName of txPalletNames) {
              try {
                // Saltar propiedades que no son pallets o que ya procesamos
                if (palletName === 'constructor' || palletName.startsWith('_') || allKnownPallets.has(palletName)) continue
                
                // Verificar que la propiedad existe antes de acceder
                if (!hasProperty(txApi, palletName)) continue
                
                // Acceder de manera segura usando Object.getOwnPropertyDescriptor
                const descriptor = Object.getOwnPropertyDescriptor(txApi, palletName)
                if (!descriptor || !descriptor.value) {
                  txPallets[palletName] = []
                  continue
                }
                
                const txPallet = descriptor.value
                if (txPallet && typeof txPallet === 'object') {
                  const txNames = getSafeProperties(txPallet, (key) => {
                    return hasProperty(txPallet, key) && key !== 'constructor' && !key.startsWith('_')
                  })
                  if (txNames.length > 0) {
                    txPallets[palletName] = txNames
                    console.log(`✓ Pallet adicional encontrada: ${palletName} (${txNames.length} transacciones)`)
                  } else {
                    txPallets[palletName] = []
                  }
                }
              } catch (err) {
                console.debug(`No se pudo acceder a pallet tx ${palletName}:`, err)
              }
            }
          } catch (err) {
            console.debug('Error al acceder a client.tx:', err)
          }
        }

        // Buscar pallets adicionales en queries que no estén en la lista conocida
        if ((client as any).query) {
          try {
            const queryApi = (client as any).query
            const queryPalletNames = getSafeProperties(queryApi)
            
            console.log('Pallets adicionales encontradas en client.query:', queryPalletNames.filter(n => !allKnownPallets.has(n)))

            for (const palletName of queryPalletNames) {
              try {
                // Saltar propiedades que no son pallets o que ya procesamos
                if (palletName === 'constructor' || palletName.startsWith('_') || allKnownPallets.has(palletName)) continue
                
                // Intentar obtener queries de manera segura
                if (hasProperty(queryApi, palletName)) {
                  try {
                    const descriptor = Object.getOwnPropertyDescriptor(queryApi, palletName)
                    if (descriptor && descriptor.value) {
                      const queryPallet = descriptor.value
                      if (queryPallet && typeof queryPallet === 'object') {
                        const queryNames = getSafeProperties(queryPallet, (key) => {
                          return hasProperty(queryPallet, key)
                        })
                        
                        if (queryNames.length > 0) {
                          queryPallets[palletName] = queryNames
                          console.log(`✓ Pallet adicional encontrada: ${palletName} (${queryNames.length} queries)`)
                        }
                      }
                    }
                  } catch (err) {
                    queryPallets[palletName] = []
                  }
                }
              } catch (err) {
                console.debug(`No se pudo acceder a pallet query ${palletName}:`, err)
              }
            }
          } catch (err) {
            console.debug('Error al acceder a client.query:', err)
          }
        }

        // Obtener pallets desde client.consts (constantes)
        if ((client as any).consts) {
          const constsApi = (client as any).consts
          const constsPalletNames = getSafeProperties(constsApi)

          for (const palletName of constsPalletNames) {
            try {
              const constsPallet = constsApi[palletName]
              if (constsPallet && typeof constsPallet === 'object') {
                const constNames = getSafeProperties(constsPallet, (key) => {
                  try {
                    return typeof constsPallet[key] !== 'function'
                  } catch {
                    return false
                  }
                })
                if (constNames.length > 0) {
                  constsPallets[palletName] = constNames
                }
              }
            } catch (err) {
              // Ignorar errores individuales
            }
          }
        }

        // Obtener pallets desde client.events (eventos) - si está disponible
        if ((client as any).events) {
          const eventsApi = (client as any).events
          const eventsPalletNames = getSafeProperties(eventsApi)

          for (const palletName of eventsPalletNames) {
            try {
              const eventsPallet = eventsApi[palletName]
              if (eventsPallet && typeof eventsPallet === 'object') {
                const eventNames = getSafeProperties(eventsPallet, (key) => {
                  try {
                    return typeof eventsPallet[key] !== 'function'
                  } catch {
                    return false
                  }
                })
                if (eventNames.length > 0) {
                  eventsPallets[palletName] = eventNames
                }
              }
            } catch (err) {
              // Ignorar errores individuales
            }
          }
        }

        // Combinar todas las pallets únicas
        const allPalletNames = new Set([
          ...Object.keys(txPallets),
          ...Object.keys(queryPallets),
          ...Object.keys(constsPallets),
          ...Object.keys(eventsPallets),
        ])

        console.log('Total de pallets encontradas:', allPalletNames.size)
        console.log('Nombres de pallets:', Array.from(allPalletNames))

        // Si no encontramos pallets suficientes, usar TODAS las pallets conocidas
        // Esto es necesario porque algunas parachains pueden tener todas las pallets pero
        // el método de descubrimiento dinámico no las encuentra
        if (allPalletNames.size === 0 || (allPalletNames.size === 1 && allPalletNames.has('executor'))) {
          console.warn('No se encontraron pallets suficientes, usando TODAS las pallets conocidas como base...')
          
          // Usar TODAS las queries conocidas para todas las pallets comunes
          const commonPallets = Object.keys(KNOWN_STORAGE_QUERIES)
          
          for (const palletName of commonPallets) {
            // Agregar todas las pallets conocidas directamente
            // Asumimos que si están en la lista conocida, probablemente existen en la cadena
            allPalletNames.add(palletName)
            
            // Agregar queries conocidas si no las tenemos
            if (!queryPallets[palletName]) {
              queryPallets[palletName] = KNOWN_STORAGE_QUERIES[palletName] || []
            }
          }
          
          console.log('Después del enfoque alternativo, pallets encontradas:', allPalletNames.size)
        }

        // Crear la lista de pallets con su información
        for (const palletName of allPalletNames) {
          // Saltar 'executor' si hay otras pallets disponibles
          if (palletName === 'executor' && allPalletNames.size > 1) {
            continue
          }
          
          palletsList.push({
            name: palletName,
            transactions: txPallets[palletName] || [],
            transactionsMetadata: transactionsMetadataMap[palletName] || {},
            queries: queryPallets[palletName] || [],
            queriesMetadata: queriesMetadataMap[palletName] || {},
            constants: constsPallets[palletName] || [],
            events: eventsPallets[palletName] || [],
          })
        }

        // Ordenar alfabéticamente
        palletsList.sort((a, b) => a.name.localeCompare(b.name))

        console.log('Pallets finales:', palletsList.map(p => p.name))
        setPallets(palletsList)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error.message || 'Error al obtener las pallets')
        console.error('Error al obtener pallets:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPallets()
  }, [open, client])

  const togglePallet = (palletName: string) => {
    const newExpanded = new Set(expandedPallets)
    if (newExpanded.has(palletName)) {
      newExpanded.delete(palletName)
    } else {
      newExpanded.add(palletName)
    }
    setExpandedPallets(newExpanded)
  }

  const toggleQuery = (queryKey: string) => {
    const newExpanded = new Set(expandedQueries)
    if (newExpanded.has(queryKey)) {
      newExpanded.delete(queryKey)
    } else {
      newExpanded.add(queryKey)
    }
    setExpandedQueries(newExpanded)
  }

  const filteredPallets = pallets.filter((pallet) =>
    pallet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pallet.transactions?.some(tx => tx.toLowerCase().includes(searchQuery.toLowerCase())) ||
    pallet.queries?.some(q => q.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (!client) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Package className="h-4 w-4 mr-2" />
          Explorar Pallets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95vh] sm:max-h-[80vh] overflow-hidden flex flex-col mx-4 sm:mx-0">
        <DialogHeader>
          <DialogTitle>Explorador de Pallets</DialogTitle>
          <DialogDescription>
            Todas las pallets disponibles en esta cadena con sus transacciones, queries, constantes y eventos
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pallet, transacción o query..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Cargando pallets...
                </span>
              </div>
            )}

            {error && (
              <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {!loading && !error && filteredPallets.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No se encontraron pallets</p>
              </div>
            )}

            {!loading && !error && filteredPallets.map((pallet) => {
              const isExpanded = expandedPallets.has(pallet.name)
              const hasContent = 
                (pallet.transactions && pallet.transactions.length > 0) ||
                (pallet.queries && pallet.queries.length > 0) ||
                (pallet.constants && pallet.constants.length > 0) ||
                (pallet.events && pallet.events.length > 0)

              return (
                <Card key={pallet.name} className="overflow-hidden">
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => togglePallet(pallet.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">{pallet.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {pallet.transactions && pallet.transactions.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {pallet.transactions.length} tx
                            </Badge>
                          )}
                          {pallet.queries && pallet.queries.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {pallet.queries.length} queries
                            </Badge>
                          )}
                          {pallet.constants && pallet.constants.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {pallet.constants.length} consts
                            </Badge>
                          )}
                          {pallet.events && pallet.events.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {pallet.events.length} events
                            </Badge>
                          )}
                        </div>
                        {hasContent && (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && hasContent && (
                    <CardContent className="pt-0 space-y-4">
                      {/* Transacciones con metadata */}
                      {pallet.transactions && pallet.transactions.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Transacciones ({pallet.transactions.length})</p>
                          <div className="space-y-2">
                            {pallet.transactions.map((tx) => {
                              const txKey = `${pallet.name}.${tx}`
                              const metadata = pallet.transactionsMetadata?.[tx]
                              const isTxExpanded = expandedQueries.has(txKey)
                              const hasMetadata = metadata && metadata.parameters
                              
                              return (
                                <div key={tx} className="border rounded-lg p-2 hover:bg-muted/30 transition-colors">
                                  <div 
                                    className={`flex items-center justify-between ${hasMetadata ? 'cursor-pointer' : ''}`}
                                    onClick={() => hasMetadata && toggleQuery(txKey)}
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="default" className="text-xs font-mono">
                                        {tx}
                                      </Badge>
                                    </div>
                                    {hasMetadata && (
                                      isTxExpanded ? (
                                        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      )
                                    )}
                                  </div>
                                  
                                  {isTxExpanded && metadata && (
                                    <div className="mt-2 pl-2 space-y-1 text-xs text-muted-foreground border-t pt-2">
                                      {metadata.parameters && metadata.parameters.length > 0 && (
                                        <div>
                                          <span className="font-medium">Parámetros: </span>
                                          <span className="font-mono text-xs">{metadata.parameters.join(', ')}</span>
                                        </div>
                                      )}
                                      {metadata.description && (
                                        <div className="text-xs italic mt-1">{metadata.description}</div>
                                      )}
                                      <div className="text-xs mt-1">
                                        <span className="font-medium">Uso: </span>
                                        <code className="text-xs bg-muted px-1 py-0.5 rounded">client.tx.{pallet.name}.{tx}(...)</code>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Queries con metadata */}
                      {pallet.queries && pallet.queries.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Storage Queries ({pallet.queries.length})</p>
                          <div className="space-y-2">
                            {pallet.queries.map((query) => {
                              const queryKey = `${pallet.name}.${query}`
                              const metadata = pallet.queriesMetadata?.[query]
                              const isQueryExpanded = expandedQueries.has(queryKey)
                              const hasMetadata = metadata && (metadata.parameters || metadata.hasMulti)
                              
                              return (
                                <div key={query} className="border rounded-lg p-2 hover:bg-muted/30 transition-colors">
                                  <div 
                                    className={`flex items-center justify-between ${hasMetadata ? 'cursor-pointer' : ''}`}
                                    onClick={() => hasMetadata && toggleQuery(queryKey)}
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="text-xs font-mono">
                                        {query}
                                      </Badge>
                                      {metadata?.hasMulti && (
                                        <Badge variant="secondary" className="text-xs">
                                          multi
                                        </Badge>
                                      )}
                                    </div>
                                    {hasMetadata && (
                                      isQueryExpanded ? (
                                        <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      )
                                    )}
                                  </div>
                                  
                                  {isQueryExpanded && metadata && (
                                    <div className="mt-2 pl-2 space-y-1 text-xs text-muted-foreground border-t pt-2">
                                      {metadata.parameters && metadata.parameters.length > 0 && (
                                        <div>
                                          <span className="font-medium">Parámetros: </span>
                                          <span className="font-mono text-xs">{metadata.parameters.join(', ')}</span>
                                        </div>
                                      )}
                                      {metadata.returnType && (
                                        <div>
                                          <span className="font-medium">Retorna: </span>
                                          <span className="font-mono text-xs">{metadata.returnType}</span>
                                        </div>
                                      )}
                                      {metadata.hasMulti && (
                                        <div className="text-xs">
                                          <span className="font-medium">✓ Soporta multi-query: </span>
                                          <code className="text-xs bg-muted px-1 py-0.5 rounded">query.{pallet.name}.{query}.multi([...])</code>
                                        </div>
                                      )}
                                      {metadata.description && (
                                        <div className="text-xs italic mt-1">{metadata.description}</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Constantes */}
                      {pallet.constants && pallet.constants.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Constantes ({pallet.constants.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {pallet.constants.map((constName) => (
                              <Badge key={constName} variant="secondary" className="font-mono text-xs">
                                {constName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Eventos */}
                      {pallet.events && pallet.events.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Eventos ({pallet.events.length})</p>
                          <div className="flex flex-wrap gap-2">
                            {pallet.events.map((event) => (
                              <Badge key={event} variant="outline" className="font-mono text-xs">
                                {event}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>

          {/* Footer con estadísticas */}
          {!loading && !error && (
            <div className="border-t pt-2 text-xs text-muted-foreground">
              <p>
                {filteredPallets.length} pallet{filteredPallets.length !== 1 ? 's' : ''} encontrada{filteredPallets.length !== 1 ? 's' : ''}
                {searchQuery && ` (filtrado de ${pallets.length} total)`}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

