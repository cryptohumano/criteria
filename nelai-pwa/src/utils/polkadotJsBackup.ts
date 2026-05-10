/**
 * Utilidades para importar backups completos de Polkadot.js
 * Formato: { encoded: string, encoding: {...}, accounts: [...] }
 */

export interface PolkadotJsBackupAccount {
  address: string
  meta: {
    name?: string
    genesisHash?: string
    whenCreated?: number
    [key: string]: any
  }
}

export interface PolkadotJsBackup {
  encoded: string
  encoding: {
    content: string[]
    type: string[]
    version: string
  }
  accounts: PolkadotJsBackupAccount[]
}

/**
 * Desencripta un backup completo de Polkadot.js y extrae las cuentas individuales
 * El formato batch-pkcs8 contiene múltiples cuentas encriptadas en un solo blob
 * 
 * NOTA: El formato batch-pkcs8 de Polkadot.js requiere desencriptar el blob completo
 * y luego parsear las cuentas individuales. Cada cuenta en el array desencriptado
 * tiene su propio formato JSON de Polkadot.js.
 */
export async function decryptPolkadotJsBackup(
  backup: PolkadotJsBackup,
  password: string
): Promise<Array<{ address: string; json: any; meta: any }>> {
  try {
    // Importar funciones de desencriptación de Polkadot.js
    const { jsonDecryptData, base64Decode } = await import('@polkadot/util-crypto')
    const { u8aToString } = await import('@polkadot/util')
    
    // El formato 'encoded' de Polkadot.js es un string base64
    // Necesitamos convertirlo a Uint8Array antes de pasarlo a jsonDecryptData
    const encodedBytes = base64Decode(backup.encoded)
    
    // Desencriptar el blob completo usando jsonDecryptData
    // Esto devuelve un Uint8Array con el contenido desencriptado
    const decryptedBytes = jsonDecryptData(encodedBytes, password)
    
    // Convertir el Uint8Array a string
    const decryptedData = u8aToString(decryptedBytes)
    
    // Parsear el contenido desencriptado
    let accountsData: any
    try {
      accountsData = JSON.parse(decryptedData)
    } catch (parseError) {
      console.error('[Polkadot.js Backup] Error al parsear JSON desencriptado:', parseError)
      throw new Error('El formato del backup no es compatible. Asegúrate de que sea un backup válido de Polkadot.js')
    }
    
    // El formato batch-pkcs8 desencriptado puede ser:
    // 1. Un array directo de cuentas: [{ address, encoded, ... }, ...]
    // 2. Un objeto con accounts: { accounts: [{ address, encoded, ... }, ...] }
    const accountsArray = Array.isArray(accountsData) 
      ? accountsData 
      : (accountsData.accounts || [])
    
    if (!Array.isArray(accountsArray) || accountsArray.length === 0) {
      throw new Error('No se encontraron cuentas en el backup desencriptado')
    }
    
    // Combinar con la metadata de backup.accounts
    // Cada cuenta en accountsArray debería tener su propio formato JSON de Polkadot.js
    const accounts = accountsArray.map((accountJson: any, index: number) => {
      const backupAccount = backup.accounts[index] || {}
      
      // Asegurar que cada cuenta tenga el formato correcto para addFromJson
      // Si accountJson ya tiene address y encoded, usarlo directamente
      // Si no, construir el JSON desde la metadata del backup
      const accountAddress = accountJson.address || backupAccount.address
      
      if (!accountAddress) {
        throw new Error(`Cuenta en índice ${index} no tiene dirección`)
      }
      
      return {
        address: accountAddress,
        json: accountJson, // Este JSON debería ser compatible con addFromJson de Polkadot.js
        meta: {
          ...backupAccount.meta,
          ...(accountJson.meta || {}),
        }
      }
    })
    
    return accounts
  } catch (error) {
    console.error('[Polkadot.js Backup] Error al desencriptar:', error)
    if (error instanceof Error) {
      if (error.message.includes('Invalid password') || error.message.includes('password')) {
        throw new Error('Contraseña incorrecta para el backup de Polkadot.js')
      }
      throw error
    }
    throw new Error(`Error al desencriptar el backup: ${error instanceof Error ? error.message : 'Error desconocido'}`)
  }
}

/**
 * Valida si un objeto es un backup completo de Polkadot.js
 */
export function isPolkadotJsBackup(data: any): data is PolkadotJsBackup {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.encoded === 'string' &&
    Array.isArray(data.accounts) &&
    typeof data.encoding === 'object' &&
    Array.isArray(data.encoding.content) &&
    data.encoding.content.includes('batch-pkcs8')
  )
}
