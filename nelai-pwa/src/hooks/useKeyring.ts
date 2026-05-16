import { useEffect, useState, useCallback, useRef } from 'react'
import { Keyring } from '@polkadot/keyring'
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto'
import { u8aToHex, hexToU8a } from '@polkadot/util'
import type { KeyringPair } from '@polkadot/keyring/types'
import { encrypt, decrypt, encryptWithKey, decryptWithKey } from '@/utils/encryption'
import {
  saveEncryptedAccount,
  getAllEncryptedAccounts,
  deleteEncryptedAccount,
  type EncryptedAccount,
  type VaultCipherKind,
} from '@/utils/secureStorage'
import { closeSharedDB } from '@/utils/indexedDB'
import { deriveEthereumAddressFromSeed } from '@/utils/ethereum'
import {
  authenticateWithWebAuthn,
  deriveKeyFromWebAuthn,
  registerWebAuthnCredential,
} from '@/utils/webauthn'
import {
  getWebAuthnCredential,
  updateWebAuthnCredentialUsage,
  getAllWebAuthnCredentials,
  saveWebAuthnCredential,
} from '@/utils/webauthnStorage'

export type VaultCipherSummary = 'unknown' | 'none' | 'password' | 'webauthn' | 'mixed'

function summarizeVaultCiphers(accounts: EncryptedAccount[]): VaultCipherSummary {
  if (accounts.length === 0) return 'none'
  const kinds = new Set<VaultCipherKind>(accounts.map((a) => (a.vaultCipher ?? 'password') as VaultCipherKind))
  if (kinds.size > 1) return 'mixed'
  return kinds.has('webauthn') ? 'webauthn' : 'password'
}

/** Deriva la clave AES del vault tras una autenticación WebAuthn (prompt al usuario). */
async function deriveVaultMasterKeyFromWebAuthn(credentialId: string): Promise<CryptoKey> {
  if (!(await getWebAuthnCredential(credentialId))) {
    throw new Error('Credencial WebAuthn no encontrada')
  }

  const authResult = await authenticateWithWebAuthn(credentialId)
  await updateWebAuthnCredentialUsage(credentialId)

  const updated = (await getWebAuthnCredential(credentialId))!
  let masterKeySalt: Uint8Array
  if (updated.masterKeySalt) {
    const { base64UrlToArrayBuffer } = await import('@/utils/webauthn')
    const saltBuffer = base64UrlToArrayBuffer(updated.masterKeySalt)
    masterKeySalt = new Uint8Array(saltBuffer)
  } else {
    const { generateMasterKeySalt, arrayBufferToBase64Url } = await import('@/utils/webauthn')
    masterKeySalt = generateMasterKeySalt()
    updated.masterKeySalt = arrayBufferToBase64Url(masterKeySalt.buffer)
    await saveWebAuthnCredential(updated)
  }

  return deriveKeyFromWebAuthn(authResult.signature, authResult.authenticatorData, masterKeySalt)
}

export interface KeyringAccount {
  pair: KeyringPair
  address: string
  publicKey: Uint8Array
  meta: {
    name?: string
    [key: string]: any
  }
}

export function useKeyring() {
  const [keyring, setKeyring] = useState<Keyring | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [accounts, setAccounts] = useState<KeyringAccount[]>([])
  const [derivedEthereumAddresses, setDerivedEthereumAddresses] = useState<Record<string, string>>({})
  const [isUnlocked, setIsUnlocked] = useState(false)
  // Estado explícito para evitar confundir "no hay cuentas" con "no pude leer el storage".
  const [storedAccountsStatus, setStoredAccountsStatus] = useState<'unknown' | 'none' | 'some' | 'error'>('unknown')
  const [storedAccountsError, setStoredAccountsError] = useState<string | null>(null)
  const hasStoredAccounts = storedAccountsStatus === 'some'
  const [hasWebAuthnCredentials, setHasWebAuthnCredentials] = useState(false)
  const [vaultCipherSummary, setVaultCipherSummary] = useState<VaultCipherSummary>('unknown')
  /** Solo en memoria mientras el vault WebAuthn está desbloqueado; evita re-prompt en importaciones múltiples. */
  const webAuthnVaultMasterKeyRef = useRef<CryptoKey | null>(null)

  // Función para verificar y actualizar el estado de credenciales WebAuthn
  const checkWebAuthnCredentials = useCallback(async () => {
    try {
      const webauthnCreds = await getAllWebAuthnCredentials()
      const hasCreds = webauthnCreds.length > 0
      setHasWebAuthnCredentials(hasCreds)
      console.log(`[Keyring] Credenciales WebAuthn: ${webauthnCreds.length} (actualizado)`)
      return hasCreds
    } catch (error) {
      console.error('[Keyring] ❌ Error al verificar credenciales WebAuthn:', error)
      setHasWebAuthnCredentials(false)
      return false
    }
  }, [])

  // Función para verificar y actualizar el estado de cuentas almacenadas
  const checkStoredAccounts = useCallback(async () => {
    try {
      const stored = await getAllEncryptedAccounts()
      const hasAccounts = stored.length > 0
      setStoredAccountsStatus(hasAccounts ? 'some' : 'none')
      setVaultCipherSummary(hasAccounts ? summarizeVaultCiphers(stored) : 'none')
      setStoredAccountsError(null)
      console.log(`[Keyring] Cuentas almacenadas: ${stored.length} (actualizado)`)
      return hasAccounts
    } catch (error) {
      console.error('[Keyring] ❌ Error al verificar cuentas almacenadas:', error)
      setStoredAccountsStatus('error')
      setVaultCipherSummary('unknown')
      setStoredAccountsError(error instanceof Error ? error.message : String(error))
      return false
    }
  }, [])

  type VaultWriteAccess = { mode: 'password'; password: string } | { mode: 'webauthn'; masterKey: CryptoKey }

  const assertVaultWriteAccess = useCallback(async (password?: string): Promise<VaultWriteAccess> => {
    const encryptedAccounts = await getAllEncryptedAccounts()
    if (encryptedAccounts.length === 0) {
      throw new Error('No hay cuentas en el vault para validar el acceso de escritura.')
    }
    const summary = summarizeVaultCiphers(encryptedAccounts)
    if (summary === 'webauthn') {
      const creds = await getAllWebAuthnCredentials()
      if (creds.length === 0) {
        throw new Error(
          'El almacén está cifrado con tu dispositivo (WebAuthn), pero no hay credencial registrada.',
        )
      }
      const first = encryptedAccounts[0]
      if (webAuthnVaultMasterKeyRef.current) {
        try {
          await decryptWithKey(first.encryptedData, webAuthnVaultMasterKeyRef.current)
          return { mode: 'webauthn', masterKey: webAuthnVaultMasterKeyRef.current }
        } catch {
          webAuthnVaultMasterKeyRef.current = null
        }
      }
      const masterKey = await deriveVaultMasterKeyFromWebAuthn(creds[0].id)
      await decryptWithKey(first.encryptedData, masterKey)
      webAuthnVaultMasterKeyRef.current = masterKey
      return { mode: 'webauthn', masterKey }
    }
    if (summary === 'mixed') {
      console.warn('[Keyring] Vault con cifrado mixto; se usa validación por contraseña para cuentas compatibles.')
    }
    if (!password) {
      throw new Error('Ingresa la contraseña del wallet para agregar una cuenta.')
    }
    await decrypt(encryptedAccounts[0].encryptedData, password)
    return { mode: 'password', password }
  }, [])

  useEffect(() => {
    let isMounted = true // Flag para evitar actualizaciones después de desmontar
    
    const initKeyring = async () => {
      console.log('[Keyring] Iniciando inicialización...')
      try {
        console.log('[Keyring] Esperando cryptoWaitReady()...')
        await cryptoWaitReady()
        if (!isMounted) return
        
        console.log('[Keyring] cryptoWaitReady() completado')
        
        // Crear Keyring sin tipo específico para soportar múltiples tipos (sr25519, ed25519, ecdsa)
        const kr = new Keyring({ ss58Format: 42 })
        if (!isMounted) return
        setKeyring(kr)
        console.log('[Keyring] Keyring creado exitosamente')
        
        // Verificar si hay cuentas almacenadas
        await checkStoredAccounts()
        
        // Verificar si hay credenciales WebAuthn
        await checkWebAuthnCredentials()
        
        if (!isMounted) return
        setIsReady(true)
        console.log('[Keyring] ✅ Inicialización completada')
      } catch (error) {
        console.error('[Keyring] ❌ Error al inicializar keyring:', error)
        if (isMounted) {
          setIsReady(true) // Marcar como listo incluso si hay error para mostrar el componente
        }
      }
    }

    initKeyring()
    
    return () => {
      isMounted = false // Limpiar flag al desmontar
    }
  }, [checkStoredAccounts, checkWebAuthnCredentials])

  const generateMnemonic = useCallback(() => {
    return mnemonicGenerate()
  }, [])

  /**
   * Desbloquea el keyring con una contraseña
   * Carga las cuentas encriptadas desde IndexedDB
   */
  const unlock = useCallback(async (password: string): Promise<boolean> => {
    if (!keyring) return false

    try {
      const encryptedAccounts = await getAllEncryptedAccounts()
      
      if (encryptedAccounts.length === 0) {
        setIsUnlocked(true)
        return true
      }

      const cipherSummary = summarizeVaultCiphers(encryptedAccounts)
      if (cipherSummary === 'webauthn') {
        return false
      }

      const passwordTestTargets = encryptedAccounts.filter(
        (a) => (a.vaultCipher ?? 'password') !== 'webauthn',
      )
      if (passwordTestTargets.length === 0) {
        return false
      }

      try {
        await decrypt(passwordTestTargets[0].encryptedData, password)
      } catch {
        return false
      }

      // Desencriptar y cargar todas las cuentas
      console.log(`[Keyring] 📦 Cargando ${encryptedAccounts.length} cuenta(s) desde IndexedDB...`)
      const loadedAccounts: KeyringAccount[] = []
      const failedAccounts: Array<{ address: string; error: any }> = []
      const derivedEvm: Record<string, string> = {}

      for (const encAccount of encryptedAccounts) {
        if ((encAccount.vaultCipher ?? 'password') === 'webauthn') {
          continue
        }
        try {
          const decryptedData = await decrypt(encAccount.encryptedData, password)
          const parsed = JSON.parse(decryptedData)
          
          // Verificar si es una cuenta de Polkadot.js
          if (parsed.isPolkadotJson && parsed.jsonData && parsed.jsonPassword) {
            // Es una cuenta importada desde Polkadot.js
            // Usar addFromJson con el JSON y su contraseña
            const pair = keyring.addFromJson(parsed.jsonData, parsed.jsonPassword)
            
            // Verificar que la dirección coincida
            if (pair.address !== encAccount.address) {
              console.warn(`[Keyring] ⚠️ Dirección no coincide: esperada ${encAccount.address}, obtenida ${pair.address}`)
            }
            
            // Asegurar que el pair esté desbloqueado
            if (pair.isLocked) {
              console.log(`[Keyring] 🔓 Desbloqueando pair al cargar: ${pair.address}`)
              pair.unlock(parsed.jsonPassword)
              if (pair.isLocked) {
                console.error(`[Keyring] ❌ No se pudo desbloquear el pair: ${pair.address}`)
                failedAccounts.push({ 
                  address: encAccount.address, 
                  error: new Error('No se pudo desbloquear el pair') 
                })
                continue
              }
            }
            
            loadedAccounts.push({
              pair,
              address: pair.address,
              publicKey: pair.publicKey,
              meta: pair.meta,
            })
            // Polkadot.js JSON: no tenemos seed para derivar EVM
            console.log(`[Keyring] ✅ Cuenta de Polkadot.js cargada y desbloqueada: ${pair.address}`)
          } else {
            // Es una cuenta normal (mnemonic/uri)
            const { uri, mnemonic, type } = parsed
            
            // Usar uri si está disponible, sino mnemonic
            const seed = uri || mnemonic
            if (!seed) {
              const error = new Error('No tiene uri ni mnemonic')
              console.error(`[Keyring] ❌ Cuenta ${encAccount.address}: ${error.message}`)
              failedAccounts.push({ address: encAccount.address, error })
              continue
            }

            // Derivar dirección EVM (misma derivación que DKG)
            try {
              derivedEvm[encAccount.address] = deriveEthereumAddressFromSeed(seed)
            } catch (e) {
              console.debug(`[Keyring] No se pudo derivar EVM para ${encAccount.address}:`, e)
            }
            
            // Agregar al keyring
            const pair = keyring.addFromUri(seed, encAccount.meta, type || 'sr25519')
            
            // Verificar que la dirección coincida
            if (pair.address !== encAccount.address) {
              console.warn(`[Keyring] ⚠️ Dirección no coincide: esperada ${encAccount.address}, obtenida ${pair.address}`)
            }
            
            loadedAccounts.push({
              pair,
              address: pair.address,
              publicKey: pair.publicKey,
              meta: pair.meta,
            })
            console.log(`[Keyring] ✅ Cuenta cargada: ${pair.address} (tipo: ${type || 'sr25519'})`)
          }
        } catch (error) {
          console.error(`[Keyring] ❌ Error al cargar cuenta ${encAccount.address}:`, error)
          failedAccounts.push({ address: encAccount.address, error })
        }
      }

      // Resumen de carga
      console.log(`[Keyring] 📊 Resumen de carga:`)
      console.log(`  ✅ Cargadas exitosamente: ${loadedAccounts.length}`)
      console.log(`  ❌ Fallidas: ${failedAccounts.length}`)
      
      if (failedAccounts.length > 0) {
        console.warn(`[Keyring] ⚠️ Las siguientes cuentas no se pudieron cargar:`, failedAccounts)
      }

      // Verificar sincronización con keyring
      const keyringPairs = keyring.getPairs()
      console.log(`[Keyring] 🔍 Verificación de sincronización:`)
      console.log(`  Keyring tiene ${keyringPairs.length} par(es)`)
      console.log(`  Estado React tiene ${loadedAccounts.length} cuenta(s)`)
      
      if (keyringPairs.length !== loadedAccounts.length) {
        console.warn(`[Keyring] ⚠️ Desincronización detectada entre keyring y estado React`)
      }

      setAccounts(loadedAccounts)
      setDerivedEthereumAddresses(derivedEvm)
      setIsUnlocked(true)
      webAuthnVaultMasterKeyRef.current = null
      return true
    } catch (error) {
      console.error('Error al desbloquear keyring:', error)
      return false
    }
  }, [keyring])

  /**
   * Desbloquea el keyring usando WebAuthn
   * Deriva una clave maestra desde la firma WebAuthn y la usa para desencriptar las cuentas
   */
  const unlockWithWebAuthn = useCallback(async (credentialId: string): Promise<boolean> => {
    if (!keyring) return false

    try {
      const encryptedAccounts = await getAllEncryptedAccounts()

      if (encryptedAccounts.length === 0) {
        setIsUnlocked(true)
        return true
      }

      const webauthnTargets = encryptedAccounts.filter(
        (a) => (a.vaultCipher ?? 'password') === 'webauthn',
      )
      if (webauthnTargets.length === 0) {
        console.warn('[Keyring] No hay cuentas cifradas con WebAuthn; usa la contraseña del vault.')
        return false
      }

      if (summarizeVaultCiphers(encryptedAccounts) === 'mixed') {
        console.warn('[Keyring] Vault mixto: solo se cargarán cuentas cifradas con WebAuthn.')
      }

      const masterKey = await deriveVaultMasterKeyFromWebAuthn(credentialId)

      const loadedAccounts: KeyringAccount[] = []
      const derivedEvm: Record<string, string> = {}

      for (const encAccount of encryptedAccounts) {
        if ((encAccount.vaultCipher ?? 'password') !== 'webauthn') continue

        try {
          const decryptedData = await decryptWithKey(encAccount.encryptedData, masterKey)
          const parsed = JSON.parse(decryptedData)

          if (parsed.isPolkadotJson && parsed.jsonData && parsed.jsonPassword) {
            const pair = keyring.addFromJson(parsed.jsonData, parsed.jsonPassword)
            if (pair.address !== encAccount.address) {
              console.warn(
                `[Keyring] ⚠️ Dirección no coincide: esperada ${encAccount.address}, obtenida ${pair.address}`,
              )
            }
            if (pair.isLocked) {
              pair.unlock(parsed.jsonPassword)
              if (pair.isLocked) {
                console.error(`[Keyring] ❌ No se pudo desbloquear el pair: ${pair.address}`)
                continue
              }
            }
            loadedAccounts.push({
              pair,
              address: pair.address,
              publicKey: pair.publicKey,
              meta: pair.meta,
            })
            console.log(`[Keyring] ✅ Cuenta de Polkadot.js cargada (WebAuthn): ${pair.address}`)
          } else {
            const { uri, mnemonic, type } = parsed
            const seed = uri || mnemonic
            if (!seed) {
              console.error(`[Keyring] ❌ Cuenta ${encAccount.address} no tiene uri ni mnemonic`)
              continue
            }
            try {
              derivedEvm[encAccount.address] = deriveEthereumAddressFromSeed(seed)
            } catch (e) {
              console.debug(`[Keyring] No se pudo derivar EVM para ${encAccount.address}:`, e)
            }
            const pair = keyring.addFromUri(seed, encAccount.meta, type || 'sr25519')
            if (pair.address !== encAccount.address) {
              console.warn(
                `[Keyring] ⚠️ Dirección no coincide: esperada ${encAccount.address}, obtenida ${pair.address}`,
              )
            }
            loadedAccounts.push({
              pair,
              address: pair.address,
              publicKey: pair.publicKey,
              meta: pair.meta,
            })
            console.log(`[Keyring] ✅ Cuenta cargada (WebAuthn): ${pair.address}`)
          }
        } catch (error) {
          console.warn(`[Keyring] ⚠️ No se pudo desencriptar cuenta ${encAccount.address} con WebAuthn:`, error)
        }
      }

      if (loadedAccounts.length === 0) {
        console.warn('[Keyring] ⚠️ WebAuthn no pudo descifrar ninguna cuenta.')
        return false
      }

      console.log(`[Keyring] ✅ ${loadedAccounts.length} cuenta(s) cargada(s) con WebAuthn`)
      setAccounts(loadedAccounts)
      setDerivedEthereumAddresses(derivedEvm)
      setIsUnlocked(true)
      webAuthnVaultMasterKeyRef.current = masterKey
      return true
    } catch (error) {
      console.error('[Keyring] ❌ Error al desbloquear con WebAuthn:', error)
      return false
    }
  }, [keyring])

  const createIdentityWithWebAuthn = useCallback(
    async (opts?: { userName?: string; displayName?: string; accountLabel?: string }) => {
      if (!keyring) {
        console.error('[Keyring] ❌ createIdentityWithWebAuthn: keyring no inicializado')
        return null
      }

      const existing = await getAllEncryptedAccounts()
      if (existing.length > 0) {
        console.warn('[Keyring] createIdentityWithWebAuthn: ya existe un vault en este dispositivo')
        return null
      }

      const userIdBytes = crypto.getRandomValues(new Uint8Array(16))
      const userId = Array.from(userIdBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const userName = opts?.userName?.trim() || 'usuario'
      const displayName = (opts?.displayName?.trim() || userName).trim() || 'CriterIA'

      const credential = await registerWebAuthnCredential(
        userId,
        userName,
        displayName,
        'Este dispositivo',
      )
      await saveWebAuthnCredential(credential)
      await checkWebAuthnCredentials()

      const masterKey = await deriveVaultMasterKeyFromWebAuthn(credential.id)
      const mnemonic = mnemonicGenerate()
      const name = opts?.accountLabel?.trim() || 'Mi identidad'
      const type = 'sr25519' as const

      const pair = keyring.addFromUri(mnemonic, { name }, type)
      const account: KeyringAccount = {
        pair,
        address: pair.address,
        publicKey: pair.publicKey,
        meta: pair.meta,
      }

      setAccounts((prev) => [...prev, account])
      setIsUnlocked(true)

      try {
        const evmAddr = deriveEthereumAddressFromSeed(mnemonic)
        setDerivedEthereumAddresses((prev) => ({ ...prev, [account.address]: evmAddr }))
      } catch (e) {
        console.debug(`[Keyring] No se pudo derivar EVM para ${account.address}:`, e)
      }

      const encryptedData = await encryptWithKey(
        JSON.stringify({ mnemonic, uri: null, type }),
        masterKey,
      )
      await saveEncryptedAccount({
        address: account.address,
        encryptedData,
        vaultCipher: 'webauthn',
        publicKey: u8aToHex(account.publicKey),
        type,
        meta: account.meta,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await checkStoredAccounts()
      console.log(`[Keyring] ✅ Identidad creada con WebAuthn: ${account.address}`)
      webAuthnVaultMasterKeyRef.current = masterKey
      return account
    },
    [keyring, checkStoredAccounts, checkWebAuthnCredentials],
  )

  /**
   * Bloquea el keyring, eliminando las claves de memoria
   */
  const lock = useCallback(() => {
    if (!keyring) return
    
    // Remover todos los pares del keyring
    accounts.forEach(acc => {
      try {
        keyring.removePair(acc.address)
      } catch {}
    })
    
    setAccounts([])
    setDerivedEthereumAddresses({})
    setIsUnlocked(false)
    webAuthnVaultMasterKeyRef.current = null
    // Libera la conexión a IndexedDB para que "eliminar todo" / deleteDatabase no quede en `blocked`
    closeSharedDB()
  }, [keyring, accounts])

  const addFromMnemonic = useCallback(async (mnemonic: string, name?: string, type: 'sr25519' | 'ed25519' | 'ecdsa' = 'sr25519', password?: string): Promise<KeyringAccount | null> => {
    if (!keyring) {
      console.error('[Keyring] ❌ No se puede agregar cuenta: keyring no inicializado')
      return null
    }

    // Verificar directamente en IndexedDB si hay cuentas almacenadas
    // (más confiable que el estado React que puede no estar actualizado)
    const encryptedAccounts = await getAllEncryptedAccounts()
    const hasStored = encryptedAccounts.length > 0

    // Permitir agregar cuenta si:
    // 1. No hay cuentas almacenadas (primera vez) - no requiere desbloqueo
    // 2. O si está desbloqueado (cuentas existentes)
    if (!isUnlocked && hasStored) {
      console.error('[Keyring] ❌ No se puede agregar cuenta: keyring no desbloqueado')
      return null
    }

    // Si ya existe un vault (hay cuentas almacenadas), validar acceso de escritura
    // (contraseña o WebAuthn según cómo esté cifrado el almacén).
    let writeAccess: VaultWriteAccess
    if (hasStored) {
      writeAccess = await assertVaultWriteAccess(password)
    } else {
      if (!password || password.length < 8) {
        throw new Error(
          'Elige una contraseña de al menos 8 caracteres para cifrar la llave en este dispositivo.',
        )
      }
      writeAccess = { mode: 'password', password }
    }

    // Si no hay cuentas almacenadas, marcar como desbloqueado para permitir la creación
    if (!hasStored && !isUnlocked) {
      console.log('[Keyring] Primera cuenta: marcando keyring como desbloqueado')
      setIsUnlocked(true)
    }

    try {
      // 1. Agregar al keyring
      const pair = keyring.addFromUri(mnemonic, { name: name || 'Account' }, type)
      console.log(`[Keyring] ✅ Cuenta agregada al keyring: ${pair.address}`)
      
      const account: KeyringAccount = {
        pair,
        address: pair.address,
        publicKey: pair.publicKey,
        meta: pair.meta,
      }

      // 2. Actualizar estado React
      setAccounts((prev) => {
        const updated = [...prev, account]
        console.log(`[Keyring] 📊 Total de cuentas en estado React: ${updated.length}`)
        return updated
      })

      // Derivar dirección EVM para la nueva cuenta
      try {
        const evmAddr = deriveEthereumAddressFromSeed(mnemonic)
        setDerivedEthereumAddresses((prev) => ({ ...prev, [account.address]: evmAddr }))
      } catch (e) {
        console.debug(`[Keyring] No se pudo derivar EVM para ${account.address}:`, e)
      }

      // 3. Guardar encriptado en IndexedDB
      try {
        const payload = JSON.stringify({ mnemonic, uri: null, type })
        const encryptedData =
          writeAccess.mode === 'password'
            ? await encrypt(payload, writeAccess.password)
            : await encryptWithKey(payload, writeAccess.masterKey)
        const vaultCipher: VaultCipherKind = writeAccess.mode === 'password' ? 'password' : 'webauthn'
        await saveEncryptedAccount({
          address: account.address,
          encryptedData,
          vaultCipher,
          publicKey: u8aToHex(account.publicKey),
          type,
          meta: account.meta,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        console.log(`[Keyring] ✅ Cuenta guardada en IndexedDB: ${account.address}`)

        await checkStoredAccounts()
      } catch (error) {
        console.error('[Keyring] ❌ Error al guardar cuenta encriptada:', error)
        // Remover del keyring si falla el guardado
        try {
          keyring.removePair(account.address)
          setAccounts((prev) => prev.filter((acc) => acc.address !== account.address))
        } catch {}
        throw error
      }

      return account
    } catch (error) {
      console.error('[Keyring] ❌ Error al agregar cuenta desde mnemonic:', error)
      throw error
    }
  }, [keyring, isUnlocked, hasStoredAccounts, assertVaultWriteAccess, checkStoredAccounts])

  /**
   * Importa una cuenta desde un archivo JSON de Polkadot.js
   * @param jsonData Objeto JSON con el formato de Polkadot.js
   * @param jsonPassword Contraseña para desencriptar el JSON
   * @param password Contraseña opcional para encriptar en nuestro sistema
   */
  const addFromJson = useCallback(async (
    jsonData: object,
    jsonPassword: string,
    password?: string
  ): Promise<KeyringAccount | null> => {
    if (!keyring) {
      console.error('[Keyring] ❌ No se puede agregar cuenta: keyring no inicializado')
      return null
    }

    // Verificar directamente en IndexedDB si hay cuentas almacenadas
    const encryptedAccounts = await getAllEncryptedAccounts()
    const hasStored = encryptedAccounts.length > 0

    // Permitir agregar cuenta si:
    // 1. No hay cuentas almacenadas (primera vez) - no requiere desbloqueo
    // 2. O si está desbloqueado (cuentas existentes)
    if (!isUnlocked && hasStored) {
      console.error('[Keyring] ❌ No se puede agregar cuenta: keyring no desbloqueado')
      return null
    }

    let writeAccess: VaultWriteAccess
    if (hasStored) {
      writeAccess = await assertVaultWriteAccess(password)
    } else {
      if (!password || password.length < 8) {
        throw new Error(
          'Elige una contraseña de al menos 8 caracteres para cifrar la llave en este dispositivo.',
        )
      }
      writeAccess = { mode: 'password', password }
    }

    // Si no hay cuentas almacenadas, marcar como desbloqueado
    if (!hasStored && !isUnlocked) {
      console.log('[Keyring] Primera cuenta: marcando keyring como desbloqueado')
      setIsUnlocked(true)
    }

    try {
      // Validar formato JSON de Polkadot.js
      if (!('address' in jsonData) || !('encoded' in jsonData)) {
        throw new Error('El JSON no tiene el formato correcto de Polkadot.js (falta address o encoded)')
      }

      // Agregar al keyring usando el método de Polkadot.js
      const pair = keyring.addFromJson(jsonData as any, jsonPassword)
      console.log(`[Keyring] ✅ Cuenta agregada al keyring desde JSON: ${pair.address}`)
      
      // Verificar si el pair está bloqueado y desbloquearlo si es necesario
      // En Polkadot.js, addFromJson puede dejar el pair bloqueado si el JSON está encriptado
      if (pair.isLocked) {
        console.log(`[Keyring] 🔓 Desbloqueando pair: ${pair.address}`)
        pair.unlock(jsonPassword)
        if (pair.isLocked) {
          console.warn(`[Keyring] ⚠️ No se pudo desbloquear el pair: ${pair.address}`)
        } else {
          console.log(`[Keyring] ✅ Pair desbloqueado: ${pair.address}`)
        }
      }

      const account: KeyringAccount = {
        pair,
        address: pair.address,
        publicKey: pair.publicKey,
        meta: pair.meta,
      }

      // Actualizar estado React
      setAccounts((prev) => {
        const updated = [...prev, account]
        console.log(`[Keyring] 📊 Total de cuentas en estado React: ${updated.length}`)
        return updated
      })

      // Guardar encriptado en IndexedDB
      try {
        const cryptoType = (jsonData as any).encoding?.content?.[1] || 'sr25519'

        const dataToEncrypt = JSON.stringify({
          jsonData,
          isPolkadotJson: true,
          jsonPassword: jsonPassword,
        })
        console.log(`[Keyring] 🔐 Encriptando datos para guardar en IndexedDB...`)
        const encryptedData =
          writeAccess.mode === 'password'
            ? await encrypt(dataToEncrypt, writeAccess.password)
            : await encryptWithKey(dataToEncrypt, writeAccess.masterKey)
        const vaultCipher: VaultCipherKind = writeAccess.mode === 'password' ? 'password' : 'webauthn'

        const accountToSave = {
          address: account.address,
          encryptedData,
          vaultCipher,
          publicKey: u8aToHex(account.publicKey),
          type: cryptoType,
          meta: account.meta,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        console.log(`[Keyring] 💾 Guardando cuenta en IndexedDB: ${account.address}`)
        await saveEncryptedAccount(accountToSave)

        const savedAccounts = await getAllEncryptedAccounts()
        const wasSaved = savedAccounts.some((acc) => acc.address === account.address)

        if (wasSaved) {
          console.log(`[Keyring] ✅ Cuenta guardada y verificada en IndexedDB: ${account.address}`)
          await checkStoredAccounts()
        } else {
          console.error(`[Keyring] ❌ Cuenta NO encontrada en IndexedDB después de guardar: ${account.address}`)
          throw new Error('La cuenta no se guardó correctamente en IndexedDB')
        }
      } catch (error) {
        console.error('[Keyring] ❌ Error al guardar cuenta encriptada:', error)
        try {
          keyring.removePair(account.address)
          setAccounts((prev) => prev.filter((acc) => acc.address !== account.address))
        } catch {}
        throw error
      }

      return account
    } catch (error) {
      console.error('[Keyring] ❌ Error al agregar cuenta desde JSON:', error)
      throw error
    }
  }, [assertVaultWriteAccess, checkStoredAccounts, keyring, isUnlocked, hasStoredAccounts])

  const addFromUri = useCallback(async (uri: string, name?: string, type: 'sr25519' | 'ed25519' | 'ecdsa' = 'sr25519', password?: string): Promise<KeyringAccount | null> => {
    if (!keyring || !isUnlocked) {
      console.error('[Keyring] ❌ No se puede agregar cuenta: keyring no inicializado o no desbloqueado')
      return null
    }

    try {
      // 1. Agregar al keyring
      const pair = keyring.addFromUri(uri, { name: name || 'Account' }, type)
      console.log(`[Keyring] ✅ Cuenta agregada al keyring: ${pair.address}`)
      
      const account: KeyringAccount = {
        pair,
        address: pair.address,
        publicKey: pair.publicKey,
        meta: pair.meta,
      }

      // 2. Actualizar estado React
      setAccounts((prev) => {
        const updated = [...prev, account]
        console.log(`[Keyring] 📊 Total de cuentas en estado React: ${updated.length}`)
        return updated
      })

      // Derivar dirección EVM para la nueva cuenta
      try {
        const evmAddr = deriveEthereumAddressFromSeed(uri)
        setDerivedEthereumAddresses((prev) => ({ ...prev, [account.address]: evmAddr }))
      } catch (e) {
        console.debug(`[Keyring] No se pudo derivar EVM para ${account.address}:`, e)
      }

      // 3. Guardar encriptado en IndexedDB
      const encryptedAccounts = await getAllEncryptedAccounts()
      let writeAccess: VaultWriteAccess
      if (encryptedAccounts.length > 0) {
        writeAccess = await assertVaultWriteAccess(password)
      } else {
        if (!password || password.length < 8) {
          throw new Error(
            'Elige una contraseña de al menos 8 caracteres para cifrar la llave en este dispositivo.',
          )
        }
        writeAccess = { mode: 'password', password }
      }

      try {
        const payload = JSON.stringify({ uri, mnemonic: null, type })
        const encryptedData =
          writeAccess.mode === 'password'
            ? await encrypt(payload, writeAccess.password)
            : await encryptWithKey(payload, writeAccess.masterKey)
        const vaultCipher: VaultCipherKind = writeAccess.mode === 'password' ? 'password' : 'webauthn'
        await saveEncryptedAccount({
          address: account.address,
          encryptedData,
          vaultCipher,
          publicKey: u8aToHex(account.publicKey),
          type,
          meta: account.meta,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
        console.log(`[Keyring] ✅ Cuenta guardada en IndexedDB: ${account.address}`)

        await checkStoredAccounts()
      } catch (error) {
        console.error('[Keyring] ❌ Error al guardar cuenta encriptada:', error)
        try {
          keyring.removePair(account.address)
          setAccounts((prev) => prev.filter((acc) => acc.address !== account.address))
        } catch {}
        throw error
      }

      return account
    } catch (error) {
      console.error('[Keyring] ❌ Error al agregar cuenta desde URI:', error)
      throw error
    }
  }, [assertVaultWriteAccess, checkStoredAccounts, keyring, isUnlocked])

  const removeAccount = useCallback(async (address: string) => {
    if (!keyring) return false

    try {
      keyring.removePair(address)
      setAccounts((prev) => prev.filter((acc) => acc.address !== address))
      setDerivedEthereumAddresses((prev) => {
        const next = { ...prev }
        delete next[address]
        return next
      })
      
      // Eliminar de IndexedDB
      await deleteEncryptedAccount(address)

      await checkStoredAccounts()

      return true
    } catch (error) {
      console.error('Error al eliminar cuenta:', error)
      return false
    }
  }, [keyring, checkStoredAccounts])

  const getAccount = useCallback((address: string) => {
    return accounts.find((acc) => acc.address === address)
  }, [accounts])

  const getDerivedEthereumAddress = useCallback((address: string): string | null => {
    return derivedEthereumAddresses[address] ?? null
  }, [derivedEthereumAddresses])

  const setSS58Format = useCallback((format: number) => {
    if (!keyring) return
    keyring.setSS58Format(format)
    // Actualizar direcciones de todas las cuentas
    setAccounts((prev) =>
      prev.map((acc) => ({
        ...acc,
        address: acc.pair.address,
      })),
    )
  }, [keyring])

  const exportMnemonicForAccount = useCallback(
    async (
      address: string,
      vaultPassword?: string,
    ): Promise<{ kind: 'mnemonic' | 'uri' | 'none'; secret: string | null; reason?: string }> => {
      const enc = (await getAllEncryptedAccounts()).find((e) => e.address === address)
      if (!enc) {
        return { kind: 'none', secret: null, reason: 'Cuenta no encontrada en el almacén local.' }
      }

      let plain: string | undefined
      if ((enc.vaultCipher ?? 'password') === 'webauthn') {
        if (webAuthnVaultMasterKeyRef.current) {
          try {
            plain = await decryptWithKey(enc.encryptedData, webAuthnVaultMasterKeyRef.current)
          } catch {
            webAuthnVaultMasterKeyRef.current = null
          }
        }
        if (plain === undefined) {
          const creds = await getAllWebAuthnCredentials()
          if (!creds.length) {
            throw new Error('No hay credencial WebAuthn registrada para descifrar este almacén.')
          }
          const masterKey = await deriveVaultMasterKeyFromWebAuthn(creds[0].id)
          plain = await decryptWithKey(enc.encryptedData, masterKey)
          webAuthnVaultMasterKeyRef.current = masterKey
        }
      } else {
        if (!vaultPassword?.trim()) {
          throw new Error('Ingresa la contraseña del almacén para ver la frase.')
        }
        plain = await decrypt(enc.encryptedData, vaultPassword.trim())
      }

      const parsed = JSON.parse(plain as string) as Record<string, unknown>
      if (parsed.isPolkadotJson) {
        return {
          kind: 'none',
          secret: null,
          reason: 'Cuenta importada desde JSON de Polkadot.js: no hay frase mnemónica en texto plano.',
        }
      }
      if (typeof parsed.mnemonic === 'string' && parsed.mnemonic.trim()) {
        return { kind: 'mnemonic', secret: parsed.mnemonic.trim() }
      }
      if (typeof parsed.uri === 'string' && parsed.uri.trim()) {
        return { kind: 'uri', secret: parsed.uri.trim() }
      }
      return { kind: 'none', secret: null, reason: 'No hay mnemónico ni URI guardados en este registro.' }
    },
    [],
  )

  return {
    keyring,
    isReady,
    accounts,
    isUnlocked,
    hasStoredAccounts,
    storedAccountsStatus,
    storedAccountsError,
    hasWebAuthnCredentials,
    vaultCipherSummary,
    generateMnemonic,
    unlock,
    unlockWithWebAuthn,
    lock,
    addFromMnemonic,
    addFromUri,
    addFromJson,
    removeAccount,
    createIdentityWithWebAuthn,
    exportMnemonicForAccount,
    getAccount,
    getDerivedEthereumAddress,
    setSS58Format,
    refreshWebAuthnCredentials: checkWebAuthnCredentials,
    refreshStoredAccounts: checkStoredAccounts,
  }
}

