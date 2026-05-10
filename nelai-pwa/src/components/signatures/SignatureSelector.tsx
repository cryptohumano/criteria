/**
 * Componente para seleccionar y aplicar tipo de firma
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useKeyringContext } from '@/contexts/KeyringContext'
import SignatureCanvasComponent from './SignatureCanvas'
import { FileKey, PenTool, Shield } from 'lucide-react'
import type { Document } from '@/types/documents'
import { signDocumentWithSubstrate } from '@/services/signatures/SubstrateSigner'
import { addAutographicSignature } from '@/services/signatures/AutographicSigner'
import { toast } from 'sonner'
import Identicon from '@polkadot/react-identicon'

export interface SignatureSelectorProps {
  document: Document
  onSigned: (updatedDocument: Document) => void
  onCancel: () => void
}

export default function SignatureSelector({
  document,
  onSigned,
  onCancel,
}: SignatureSelectorProps) {
  const { accounts, getAccount } = useKeyringContext()
  // Inicializar con la cuenta del autor si existe, o la primera cuenta disponible
  const defaultAccount = document.relatedAccount || accounts[0]?.address || ''
  const [selectedAccount, setSelectedAccount] = useState<string>(defaultAccount)
  const [signatureImage, setSignatureImage] = useState<string | null>(null)
  const [isSigning, setIsSigning] = useState(false)
  const [activeTab, setActiveTab] = useState<'substrate' | 'autographic'>('substrate')

  // Cargar firma autográfica guardada si existe para la cuenta seleccionada
  useEffect(() => {
    const loadSavedAutographicSignature = async () => {
      if (selectedAccount && activeTab === 'autographic') {
        try {
          const { getAutographicSignature } = await import('@/utils/autographicSignatureStorage')
          const savedSignature = await getAutographicSignature(selectedAccount)
          if (savedSignature?.signatureImage) {
            setSignatureImage(savedSignature.signatureImage)
            console.log('[Signature Selector] Firma autográfica cargada para la cuenta')
          }
        } catch (error) {
          console.warn('[Signature Selector] No se pudo cargar firma autográfica guardada:', error)
        }
      }
    }
    loadSavedAutographicSignature()
  }, [selectedAccount, activeTab])

  const handleSubstrateSign = async () => {
    if (!selectedAccount) {
      toast.error('Por favor selecciona una cuenta')
      return
    }

    try {
      setIsSigning(true)

      const account = getAccount(selectedAccount)
      if (!account) {
        throw new Error('Cuenta no encontrada')
      }

      const updatedDocument = await signDocumentWithSubstrate({
        document,
        pair: account.pair,
      })

      toast.success('Documento firmado exitosamente')
      onSigned(updatedDocument)
    } catch (error) {
      console.error('[Signature Selector] Error al firmar:', error)
      toast.error(
        error instanceof Error ? error.message : 'Error al firmar el documento'
      )
    } finally {
      setIsSigning(false)
    }
  }

  const handleAutographicSign = async () => {
    if (!signatureImage) {
      toast.error('Por favor captura tu firma')
      return
    }

    try {
      setIsSigning(true)

      // Agregar firma autográfica en todas las páginas, esquina inferior derecha
      const updatedDocument = await addAutographicSignature({
        document,
        signatureImage,
        position: {
          page: -1, // -1 significa todas las páginas
          x: -1, // -1 significa desde la derecha (esquina inferior derecha)
          y: 20, // mm desde abajo
          width: 60,
          height: 30,
        },
        captureGPS: false, // Opcional: capturar GPS
      })
      
      // Verificar que la firma se agregó
      console.log('[Signature Selector] Firma agregada. Documento actualizado:', {
        signatures: updatedDocument.signatures?.length,
        pdfSize: updatedDocument.pdfSize,
      })

      // Si hay una cuenta seleccionada, guardar la firma autográfica para uso futuro
      // IMPORTANTE: Vincular la firma autográfica a la cuenta
      if (selectedAccount) {
        try {
          const { saveAutographicSignature } = await import('@/utils/autographicSignatureStorage')
          await saveAutographicSignature(selectedAccount, signatureImage)
          console.log('[Signature Selector] Firma autográfica guardada y vinculada a la cuenta:', selectedAccount)
          toast.success('Firma autográfica guardada para esta cuenta')
        } catch (error) {
          console.warn('[Signature Selector] No se pudo guardar la firma autográfica:', error)
          toast.warn('No se pudo guardar la firma autográfica para uso futuro')
          // No es crítico, continuar
        }
      } else {
        toast.warn('Selecciona una cuenta para vincular la firma autográfica')
      }

      toast.success('Firma autográfica agregada exitosamente')
      onSigned(updatedDocument)
    } catch (error) {
      console.error('[Signature Selector] Error al agregar firma autográfica:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error al agregar firma autográfica'
      )
    } finally {
      setIsSigning(false)
    }
  }

  const handleSignatureCapture = (image: string) => {
    setSignatureImage(image)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firmar Documento</CardTitle>
        <CardDescription>
          Selecciona el tipo de firma que deseas aplicar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="substrate" className="flex items-center gap-2">
              <FileKey className="h-4 w-4" />
              Digital (Substrate)
            </TabsTrigger>
            <TabsTrigger value="autographic" className="flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Autográfica
            </TabsTrigger>
          </TabsList>

          <TabsContent value="substrate" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="account-select">Cuenta para firmar</Label>
              <Select
                value={selectedAccount}
                onValueChange={setSelectedAccount}
              >
                <SelectTrigger id="account-select">
                  <SelectValue placeholder="Selecciona una cuenta">
                    {selectedAccount && (
                      <div className="flex items-center gap-2">
                        <Identicon
                          value={selectedAccount}
                          size={16}
                          theme="polkadot"
                        />
                        <span>
                          {accounts.find(a => a.address === selectedAccount)?.meta?.name || 
                           `${selectedAccount.slice(0, 8)}...${selectedAccount.slice(-6)}`}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.address} value={account.address}>
                      <div className="flex items-center gap-2">
                        <Identicon
                          value={account.address}
                          size={16}
                          theme="polkadot"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {account.meta?.name || 'Sin nombre'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {account.address.slice(0, 8)}...{account.address.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubstrateSign}
                disabled={!selectedAccount || isSigning}
                className="flex-1"
              >
                <Shield className="mr-2 h-4 w-4" />
                {isSigning ? 'Firmando...' : 'Firmar Documento'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="autographic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="autographic-account-select">Cuenta para vincular firma autográfica</Label>
              <Select
                value={selectedAccount}
                onValueChange={(value) => {
                  setSelectedAccount(value)
                  setSignatureImage(null) // Limpiar firma al cambiar cuenta
                }}
              >
                <SelectTrigger id="autographic-account-select">
                  <SelectValue placeholder="Selecciona una cuenta">
                    {selectedAccount && (
                      <div className="flex items-center gap-2">
                        <Identicon
                          value={selectedAccount}
                          size={16}
                          theme="polkadot"
                        />
                        <span>
                          {accounts.find(a => a.address === selectedAccount)?.meta?.name || 
                           `${selectedAccount.slice(0, 8)}...${selectedAccount.slice(-6)}`}
                        </span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.address} value={account.address}>
                      <div className="flex items-center gap-2">
                        <Identicon
                          value={account.address}
                          size={16}
                          theme="polkadot"
                        />
                        <span>{account.meta?.name || account.address}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && (
                <p className="text-xs text-muted-foreground">
                  La firma autográfica se vinculará a esta cuenta y se usará automáticamente al firmar con Substrate
                </p>
              )}
            </div>
            {signatureImage ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 bg-white">
                  <img
                    src={signatureImage}
                    alt="Firma capturada"
                    className="max-w-full h-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSignatureImage(null)}
                    className="flex-1"
                  >
                    Capturar de nuevo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAutographicSign}
                    disabled={isSigning}
                    className="flex-1"
                  >
                    {isSigning ? 'Agregando...' : 'Agregar Firma'}
                  </Button>
                </div>
              </div>
            ) : (
              <SignatureCanvasComponent
                onSave={handleSignatureCapture}
                onCancel={onCancel}
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

