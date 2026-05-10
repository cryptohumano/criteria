/**
 * Redes DKG (OriginTrail) predefinidas.
 * Similar a DEFAULT_CHAINS para Substrate; permite seleccionar red como en el NetworkSwitcher.
 */

export interface DkgNetworkInfo {
  id: string
  name: string
  endpoint: string
  port: number
  blockchainId: string
  description?: string
  /** RPC opcional para la blockchain (DKG usa valores por defecto si no se especifica) */
  rpc?: string
}

export const DEFAULT_DKG_NETWORKS: DkgNetworkInfo[] = [
  {
    id: 'neuroweb-testnet',
    name: 'Neuroweb Testnet',
    endpoint: 'https://v6-pegasus-node-02.origin-trail.network',
    port: 8900,
    blockchainId: 'otp:20430',
    description: 'Testnet de OriginTrail en Neuroweb',
    rpc: 'https://lofar-testnet.origin-trail.network',
  },
  {
    id: 'base-testnet',
    name: 'Base Testnet',
    endpoint: 'https://v6-pegasus-node-02.origin-trail.network',
    port: 8900,
    blockchainId: 'base:84532',
    description: 'Testnet en Base (Sepolia)',
    rpc: 'https://sepolia.base.org',
  },
  {
    id: 'gnosis-testnet',
    name: 'Gnosis Testnet',
    endpoint: 'https://v6-pegasus-node-02.origin-trail.network',
    port: 8900,
    blockchainId: 'gnosis:10200',
    description: 'Testnet en Gnosis (Chiado)',
    rpc: 'https://rpc.chiadochain.net',
  },
  {
    id: 'neuroweb-mainnet',
    name: 'Neuroweb Mainnet',
    endpoint: 'https://v6-pegasus-node-02.origin-trail.network',
    port: 8900,
    blockchainId: 'otp:2043',
    description: 'Mainnet de OriginTrail en Neuroweb',
    rpc: 'https://astrosat-parachain-rpc.origin-trail.network',
  },
  {
    id: 'base-mainnet',
    name: 'Base Mainnet',
    endpoint: 'https://v6-pegasus-node-02.origin-trail.network',
    port: 8900,
    blockchainId: 'base:8453',
    description: 'Mainnet en Base',
    rpc: 'https://mainnet.base.org',
  },
  {
    id: 'gnosis-mainnet',
    name: 'Gnosis Mainnet',
    endpoint: 'https://v6-pegasus-node-02.origin-trail.network',
    port: 8900,
    blockchainId: 'gnosis:100',
    description: 'Mainnet en Gnosis',
    rpc: 'https://rpc.gnosischain.com',
  },
  {
    id: 'local',
    name: 'Local (Hardhat)',
    endpoint: 'http://localhost',
    port: 8900,
    blockchainId: 'hardhat1:31337',
    description: 'Nodo DKG local para desarrollo',
    rpc: 'http://localhost:8545',
  },
]

export function getDkgNetworkById(id: string): DkgNetworkInfo | undefined {
  return DEFAULT_DKG_NETWORKS.find((n) => n.id === id)
}
