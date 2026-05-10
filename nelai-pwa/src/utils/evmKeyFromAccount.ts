/**
 * Obtiene la private key EVM derivada de una cuenta almacenada.
 * Requiere la contraseña para desencriptar el seed/mnemonic.
 */

import { decrypt } from '@/utils/encryption'
import { getEncryptedAccount } from '@/utils/secureStorage'
import { deriveEthereumPrivateKey } from '@/utils/ethereum'

/**
 * Obtiene la private key Ethereum (hex) derivada del seed de una cuenta.
 * La misma semilla produce la cuenta Substrate (sr25519) y la EVM (secp256k1).
 *
 * @param address - Dirección SS58 de la cuenta
 * @param password - Contraseña para desencriptar
 * @returns Private key en formato hex (0x...)
 */
export async function getEthereumPrivateKeyForAccount(
  address: string,
  password: string
): Promise<string> {
  const account = await getEncryptedAccount(address)
  if (!account) {
    throw new Error('Cuenta no encontrada')
  }

  const decrypted = await decrypt(account.encryptedData, password)
  const parsed = JSON.parse(decrypted) as { uri?: string; mnemonic?: string }

  const seed = parsed.uri ?? parsed.mnemonic
  if (!seed) {
    throw new Error('La cuenta no tiene seed disponible (solo cuentas importadas con mnemonic/URI)')
  }

  return deriveEthereumPrivateKey(seed)
}
