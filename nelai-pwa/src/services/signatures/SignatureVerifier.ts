/**
 * Servicio para verificar firmas de documentos
 */

import type { Document, DocumentSignature } from '@/types/documents'
import { calculatePDFHash } from '@/services/pdf/PDFHash'
import { verifySubstrateSignature } from './SubstrateSigner'

export interface VerificationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  details: {
    integrity: {
      valid: boolean
      message: string
    }
    signatures: Array<{
      signatureId: string
      type: DocumentSignature['type']
      valid: boolean
      message: string
    }>
  }
}

/**
 * Verifica la integridad y todas las firmas de un documento
 */
export async function verifyDocument(document: Document): Promise<VerificationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const signatureResults: VerificationResult['details']['signatures'] = []

  // 1. Verificar integridad del PDF
  let integrityValid = false
  let integrityMessage = ''

  if (!document.pdf) {
    integrityValid = false
    integrityMessage = 'El PDF no está disponible'
    errors.push('PDF no disponible para verificación')
  } else {
    try {
      const currentHash = await calculatePDFHash(document.pdf)
      integrityValid = currentHash.toLowerCase() === document.pdfHash.toLowerCase()

      if (integrityValid) {
        integrityMessage = 'El documento no ha sido modificado'
      } else {
        integrityMessage = 'El documento ha sido modificado después de la creación'
        errors.push('Hash del PDF no coincide - el documento puede haber sido alterado')
      }
    } catch (error) {
      integrityValid = false
      integrityMessage = `Error al calcular hash: ${error instanceof Error ? error.message : 'Error desconocido'}`
      errors.push(integrityMessage)
    }
  }

  // 2. Verificar cada firma
  for (const signature of document.signatures || []) {
    let signatureValid = false
    let signatureMessage = ''

    try {
      switch (signature.type) {
        case 'substrate':
          signatureValid = await verifySubstrateSignature(document, signature)
          signatureMessage = signatureValid
            ? 'Firma Substrate válida'
            : 'Firma Substrate inválida o hash no coincide'
          break

        case 'x509':
          // TODO: Implementar verificación X.509
          signatureMessage = 'Verificación X.509 no implementada aún'
          warnings.push(`Firma X.509 ${signature.id} no verificada`)
          break

        case 'autographic':
          // Las firmas autográficas no tienen verificación criptográfica
          // Solo verificamos que existan y tengan metadata válida
          signatureValid = !!(
            signature.autographic?.image &&
            signature.autographic?.position
          )
          signatureMessage = signatureValid
            ? 'Firma autográfica presente'
            : 'Firma autográfica incompleta'
          if (!signatureValid) {
            warnings.push(`Firma autográfica ${signature.id} incompleta`)
          }
          break

        case 'hybrid':
          // Verificar ambas partes (autográfica + digital)
          const hasAutographic = !!(
            signature.autographic?.image &&
            signature.autographic?.position
          )
          const hasDigital =
            (signature.signer && signature.signature) ||
            signature.x509?.signature

          signatureValid = hasAutographic && hasDigital
          signatureMessage = signatureValid
            ? 'Firma híbrida completa (autográfica + digital)'
            : 'Firma híbrida incompleta'
          if (!signatureValid) {
            warnings.push(`Firma híbrida ${signature.id} incompleta`)
          }
          break

        default:
          signatureMessage = `Tipo de firma desconocido: ${signature.type}`
          warnings.push(signatureMessage)
      }
    } catch (error) {
      signatureValid = false
      signatureMessage = `Error al verificar firma: ${error instanceof Error ? error.message : 'Error desconocido'}`
      errors.push(`Firma ${signature.id}: ${signatureMessage}`)
    }

    signatureResults.push({
      signatureId: signature.id,
      type: signature.type,
      valid: signatureValid,
      message: signatureMessage,
    })
  }

  // 3. Determinar validez general
  const allSignaturesValid = signatureResults.every(result => result.valid)
  const valid = integrityValid && allSignaturesValid && errors.length === 0

  return {
    valid,
    errors,
    warnings,
    details: {
      integrity: {
        valid: integrityValid,
        message: integrityMessage,
      },
      signatures: signatureResults,
    },
  }
}

/**
 * Verifica una firma específica
 */
export async function verifySignature(
  document: Document,
  signatureId: string
): Promise<{
  valid: boolean
  message: string
}> {
  const signature = document.signatures?.find(sig => sig.id === signatureId)

  if (!signature) {
    return {
      valid: false,
      message: 'Firma no encontrada',
    }
  }

  switch (signature.type) {
    case 'substrate':
      const valid = await verifySubstrateSignature(document, signature)
      return {
        valid,
        message: valid
          ? 'Firma Substrate válida'
          : 'Firma Substrate inválida',
      }

    case 'autographic':
      const hasImage = !!signature.autographic?.image
      return {
        valid: hasImage,
        message: hasImage
          ? 'Firma autográfica presente'
          : 'Firma autográfica incompleta',
      }

    default:
      return {
        valid: false,
        message: `Tipo de firma no soportado para verificación: ${signature.type}`,
      }
  }
}

