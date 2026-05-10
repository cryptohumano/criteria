import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, AlertTriangle, Sparkles } from 'lucide-react'
import { useGuideAgent } from '@/hooks/useGuideAgent'
import { GuideModal } from '@/components/criteria/GuideModal'
import type { MountainLog } from '@/types/mountainLogs'
import { fillDummyData } from '@/data/dummyAvisoSalida'
import { toast } from 'sonner'
import { DummyDataSummary } from './DummyDataSummary'
import { useKeyringContext } from '@/contexts/KeyringContext'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'
import Identicon from '@polkadot/react-identicon'

interface AvisoSalidaFormProps {
  log: MountainLog
  onUpdate: (log: MountainLog) => void
  onComplete: () => void
}

export function AvisoSalidaForm({ log, onUpdate, onComplete }: AvisoSalidaFormProps) {
  const [currentSection, setCurrentSection] = useState(1)
  const [showDummySummary, setShowDummySummary] = useState(false)
  const { accounts } = useKeyringContext()
  const { activeAccount } = useActiveAccount()
  const { showModal: showGuideModal, setShowModal: setShowGuideModal, triggerGuide, acknowledge } = useGuideAgent('register-aviso-onchain')
  
  // Usar el avisoSalida del log actualizado
  const avisoSalida = log.avisoSalida || {
    guia: {
      nombres: '',
      apellidos: '',
      experienciaSector: false,
      experienciaExpediciones: false,
      seguroAccidente: false
    },
    actividad: {
      fechaSalida: Date.now()
    },
    contactosEmergencia: [],
    participantes: [],
    participantesConEnfermedades: [],
    listaChequeo: {}
  }

  const updateAvisoSalida = (updates: Partial<typeof avisoSalida>) => {
    onUpdate({
      ...log,
      avisoSalida: {
        ...avisoSalida,
        ...updates
      }
    })
  }

  const updateGuia = (updates: Partial<typeof avisoSalida.guia>) => {
    updateAvisoSalida({
      guia: {
        ...avisoSalida.guia,
        ...updates
      }
    })
  }

  const updateActividad = (updates: Partial<typeof avisoSalida.actividad>) => {
    updateAvisoSalida({
      actividad: {
        ...avisoSalida.actividad,
        ...updates
      }
    })
  }

  const addContactoEmergencia = () => {
    updateAvisoSalida({
      contactosEmergencia: [
        ...avisoSalida.contactosEmergencia,
        { nombres: '', telefonos: [''] }
      ]
    })
  }

  const removeContactoEmergencia = (index: number) => {
    updateAvisoSalida({
      contactosEmergencia: avisoSalida.contactosEmergencia.filter((_, i) => i !== index)
    })
  }

  const updateContactoEmergencia = (index: number, field: 'nombres' | 'telefonos', value: string | string[]) => {
    const updated = [...avisoSalida.contactosEmergencia]
    updated[index] = { ...updated[index], [field]: value }
    updateAvisoSalida({ contactosEmergencia: updated })
  }

  const addParticipante = () => {
    updateAvisoSalida({
      participantes: [
        ...avisoSalida.participantes,
        {
          numero: avisoSalida.participantes.length + 1,
          nombres: '',
          contactoEmergencia: '',
          telefonoEmergencia: ''
        }
      ]
    })
  }

  const removeParticipante = (index: number) => {
    updateAvisoSalida({
      participantes: avisoSalida.participantes.filter((_, i) => i !== index).map((p, i) => ({
        ...p,
        numero: i + 1
      }))
    })
  }

  const updateParticipante = (index: number, field: string, value: string) => {
    const updated = [...avisoSalida.participantes]
    updated[index] = { ...updated[index], [field]: value }
    updateAvisoSalida({ participantes: updated })
  }

  const addParticipanteEnfermedad = () => {
    updateAvisoSalida({
      participantesConEnfermedades: [
        ...avisoSalida.participantesConEnfermedades,
        {
          numero: avisoSalida.participantesConEnfermedades.length + 1,
          nombres: ''
        }
      ]
    })
  }

  const removeParticipanteEnfermedad = (index: number) => {
    updateAvisoSalida({
      participantesConEnfermedades: avisoSalida.participantesConEnfermedades
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, numero: i + 1 }))
    })
  }

  const updateParticipanteEnfermedad = (index: number, field: string, value: string) => {
    const updated = [...avisoSalida.participantesConEnfermedades]
    updated[index] = { ...updated[index], [field]: value }
    updateAvisoSalida({ participantesConEnfermedades: updated })
  }

  const sections = [
    { id: 1, title: 'Datos del Guía', required: true },
    { id: 2, title: 'Información de Actividad', required: true },
    { id: 3, title: 'Contactos de Emergencia', required: true },
    { id: 4, title: 'Participantes', required: false },
    { id: 5, title: 'Lista de Chequeo', required: false }
  ]

  const canProceed = () => {
    if (currentSection === 1) {
      return avisoSalida.guia.nombres && avisoSalida.guia.apellidos
    }
    if (currentSection === 2) {
      return avisoSalida.actividad.lugarDestino && avisoSalida.actividad.fechaSalida
    }
    if (currentSection === 3) {
      return avisoSalida.contactosEmergencia.length > 0
    }
    return true
  }

  const payloadSummary = avisoSalida?.guia?.nombres
    ? `guía ${avisoSalida.guia.nombres} ${avisoSalida.guia.apellidos}, destino ${avisoSalida.actividad?.lugarDestino || 'N/A'}, ${avisoSalida.participantes?.length || 0} participantes, ${avisoSalida.contactosEmergencia?.length || 0} contactos`
    : undefined

  return (
    <div className="space-y-6 pb-20 bg-background min-h-screen">
      <GuideModal
        open={showGuideModal}
        onOpenChange={setShowGuideModal}
        actionType="register-aviso-onchain"
        onAcknowledged={acknowledge}
        hasPersonalData
        payloadSummary={payloadSummary}
      />
      {/* Resumen de datos dummy si se cargaron */}
      {showDummySummary && log.avisoSalida && (
        <DummyDataSummary avisoSalida={log.avisoSalida} />
      )}
      
      {/* Header con progreso */}
      <div className="sticky top-0 z-10 bg-background border-b pb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 flex-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setCurrentSection(section.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentSection === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {section.id}. {section.title}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const filledLog = fillDummyData(log)
              onUpdate(filledLog)
              
              // Mostrar resumen detallado de lo que se llenó
              const aviso = filledLog.avisoSalida
              if (aviso) {
                const resumen = [
                  `👤 Guía: ${aviso.guia.nombres} ${aviso.guia.apellidos}`,
                  `🏔️ Destino: ${aviso.actividad.lugarDestino}`,
                  `👥 ${aviso.participantes.length} participantes`,
                  `📞 ${aviso.contactosEmergencia.length} contactos de emergencia`,
                  `📋 Lista de chequeo completa`,
                  `📅 Salida: ${new Date(aviso.actividad.fechaSalida).toLocaleDateString('es-ES')}`
                ].join('\n')
                
                toast.success('✅ Datos demo cargados', {
                  description: `Guía: ${aviso.guia.nombres} ${aviso.guia.apellidos} | Destino: ${aviso.actividad.lugarDestino} | ${aviso.participantes.length} participantes | ${aviso.contactosEmergencia.length} contactos`,
                  duration: 6000
                })
                
                // Ir a la primera sección para que vea los datos inmediatamente
                setTimeout(() => {
                  setCurrentSection(1)
                }, 100)
                
                // Ir a la primera sección para que vea los datos
                setCurrentSection(1)
              }
            }}
            title="Llenar con datos de ejemplo (Juan Carlos Pérez, Cerro El Plomo, 4 participantes)"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Datos Demo
          </Button>
        </div>
      </div>

      {/* Selector de cuenta - Solo mostrar si hay más de una cuenta Y la bitácora aún no tiene cuenta asignada */}
      {accounts.length > 1 && !log.relatedAccount && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Cuenta asociada a esta bitácora</CardTitle>
            <CardDescription>
              Selecciona la cuenta que estará asociada permanentemente a esta bitácora y al aviso de salida. No se podrá cambiar después.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="account-selector-aviso">Cuenta</Label>
              <Select
                value={log.relatedAccount || activeAccount || accounts[0]?.address || ''}
                onValueChange={(newAccountAddress) => {
                  onUpdate({
                    ...log,
                    relatedAccount: newAccountAddress,
                    updatedAt: Date.now(),
                  })
                }}
              >
                <SelectTrigger id="account-selector-aviso">
                  <SelectValue>
                    {log.relatedAccount
                      ? (() => {
                          const account = accounts.find(acc => acc.address === log.relatedAccount)
                          return account ? (
                            <div className="flex items-center gap-2">
                              <Identicon
                                value={account.address}
                                size={16}
                                theme="polkadot"
                              />
                              <span>{account.meta.name || 'Sin nombre'}</span>
                            </div>
                          ) : `${log.relatedAccount.substring(0, 8)}...`
                        })()
                      : 'Seleccionar cuenta'}
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
                            {account.meta.name || 'Sin nombre'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {account.address.substring(0, 8)}...{account.address.slice(-8)}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Esta cuenta se usará para firmar emergencias y documentos relacionados con esta bitácora.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mostrar cuenta actual si ya está asignada (solo lectura) */}
      {log.relatedAccount && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Cuenta asociada a esta bitácora</CardTitle>
            <CardDescription>
              La cuenta está asociada permanentemente a esta bitácora y no se puede cambiar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {(() => {
                const account = accounts.find(acc => acc.address === log.relatedAccount)
                return account ? (
                  <>
                    <Identicon
                      value={account.address}
                      size={20}
                      theme="polkadot"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        {account.meta.name || 'Sin nombre'}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {account.address.substring(0, 8)}...{account.address.slice(-8)}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-sm font-mono">
                    {log.relatedAccount.substring(0, 8)}...{log.relatedAccount.slice(-8)}
                  </span>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección 1: Datos del Guía */}
      {currentSection === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Datos Personales del Guía</CardTitle>
            <CardDescription>
              Ingresa tus datos personales para poder ayudarte más rápido ante una emergencia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombres">Nombres *</Label>
                <Input
                  id="nombres"
                  value={avisoSalida.guia.nombres}
                  onChange={(e) => updateGuia({ nombres: e.target.value })}
                  placeholder="Ingresa tus nombres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellidos">Apellidos *</Label>
                <Input
                  id="apellidos"
                  value={avisoSalida.guia.apellidos}
                  onChange={(e) => updateGuia({ apellidos: e.target.value })}
                  placeholder="Ingresa tus apellidos"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documento">Documento de Identidad</Label>
                <Input
                  id="documento"
                  value={avisoSalida.guia.documentoIdentidad || ''}
                  onChange={(e) => updateGuia({ documentoIdentidad: e.target.value })}
                  placeholder="Tipo de documento"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rut">RUT/Pasaporte</Label>
                <Input
                  id="rut"
                  value={avisoSalida.guia.rutPasaporte || ''}
                  onChange={(e) => updateGuia({ rutPasaporte: e.target.value })}
                  placeholder="Número de documento"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={avisoSalida.guia.email || ''}
                  onChange={(e) => updateGuia({ email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  type="tel"
                  value={avisoSalida.guia.telefono || ''}
                  onChange={(e) => updateGuia({ telefono: e.target.value })}
                  placeholder="+56 9 1234 5678"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nacionalidad">Nacionalidad</Label>
                <Input
                  id="nacionalidad"
                  value={avisoSalida.guia.nacionalidad || ''}
                  onChange={(e) => updateGuia({ nacionalidad: e.target.value })}
                  placeholder="Chilena"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edad">Edad</Label>
                <Input
                  id="edad"
                  type="number"
                  value={avisoSalida.guia.edad || ''}
                  onChange={(e) => updateGuia({ edad: parseInt(e.target.value) || undefined })}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profesion">Profesión</Label>
                <Input
                  id="profesion"
                  value={avisoSalida.guia.profesion || ''}
                  onChange={(e) => updateGuia({ profesion: e.target.value })}
                  placeholder="Guía de Montaña"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domicilio">Domicilio</Label>
              <Input
                id="domicilio"
                value={avisoSalida.guia.domicilio || ''}
                onChange={(e) => updateGuia({ domicilio: e.target.value })}
                placeholder="Dirección completa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="institucion">Institución o Empresa</Label>
              <Input
                id="institucion"
                value={avisoSalida.guia.institucionEmpresa || ''}
                onChange={(e) => updateGuia({ institucionEmpresa: e.target.value })}
                placeholder="Nombre de la institución"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="experiencia-sector"
                  checked={avisoSalida.guia.experienciaSector}
                  onCheckedChange={(checked) => updateGuia({ experienciaSector: !!checked })}
                />
                <Label htmlFor="experiencia-sector" className="font-normal cursor-pointer">
                  Experiencia en el Sector
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="experiencia-expediciones"
                  checked={avisoSalida.guia.experienciaExpediciones}
                  onCheckedChange={(checked) => updateGuia({ experienciaExpediciones: !!checked })}
                />
                <Label htmlFor="experiencia-expediciones" className="font-normal cursor-pointer">
                  Experiencia en Expediciones
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="seguro-accidente"
                  checked={avisoSalida.guia.seguroAccidente}
                  onCheckedChange={(checked) => updateGuia({ seguroAccidente: !!checked })}
                />
                <Label htmlFor="seguro-accidente" className="font-normal cursor-pointer">
                  ¿Seguro de Accidente?
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prevision">Previsión de Salud</Label>
              <Input
                id="prevision"
                value={avisoSalida.guia.previsionSalud || ''}
                onChange={(e) => updateGuia({ previsionSalud: e.target.value })}
                placeholder="FONASA, ISAPRE, etc."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección 2: Información de Actividad */}
      {currentSection === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Información de la Actividad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="region">Región de Destino</Label>
                <Input
                  id="region"
                  value={avisoSalida.actividad.regionDestino || ''}
                  onChange={(e) => updateActividad({ regionDestino: e.target.value })}
                  placeholder="Región"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lugar">Lugar de Destino *</Label>
                <Input
                  id="lugar"
                  value={avisoSalida.actividad.lugarDestino || ''}
                  onChange={(e) => updateActividad({ lugarDestino: e.target.value })}
                  placeholder="Nombre del lugar"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruta">Ruta (Opcional)</Label>
              <Input
                id="ruta"
                value={avisoSalida.actividad.ruta || ''}
                onChange={(e) => updateActividad({ ruta: e.target.value })}
                placeholder="Nombre de la ruta"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="archivo-ruta">Archivo KMZ/GPX (Opcional)</Label>
              <Input
                id="archivo-ruta"
                type="file"
                accept=".kmz,.gpx"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    updateActividad({ archivoRuta: file.name })
                    
                    // Procesar archivo GPX si es posible
                    if (file.name.endsWith('.gpx')) {
                      try {
                        const { parseGPX, convertGPXWaypointsToGPSPoints, calculateGPXStats } = await import('@/utils/gpxParser')
                        const parsed = await parseGPX(file)
                        
                        // Mostrar información útil al usuario
                        if (parsed.waypoints.length > 0 || parsed.tracks.length > 0) {
                          const waypoints = convertGPXWaypointsToGPSPoints(parsed.waypoints)
                          const stats = calculateGPXStats(waypoints)
                          
                          // Guardar información procesada (se puede usar después para pre-cargar milestones)
                          console.log('GPX procesado:', {
                            waypoints: parsed.waypoints.length,
                            tracks: parsed.tracks.length,
                            distancia: `${(stats.totalDistance / 1000).toFixed(2)} km`,
                            elevacionMax: stats.maxElevation ? `${Math.round(stats.maxElevation)}m` : 'N/A'
                          })
                          
                          // TODO: Opcionalmente, pre-cargar waypoints como milestones
                          // O mostrar un resumen al usuario
                        }
                      } catch (error) {
                        console.error('Error al procesar GPX:', error)
                        // No bloquear el flujo si hay error
                      }
                    }
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                El archivo GPX/KMZ puede contener waypoints y rutas que se pueden usar para pre-cargar milestones en tu bitácora.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="participantes">Nº de Participantes</Label>
                <Input
                  id="participantes"
                  type="number"
                  value={avisoSalida.actividad.numeroParticipantes || ''}
                  onChange={(e) => updateActividad({ numeroParticipantes: parseInt(e.target.value) || undefined })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actividad">Actividad a Practicar</Label>
                <Select
                  value={avisoSalida.actividad.tipoActividad || ''}
                  onValueChange={(value) => updateActividad({ tipoActividad: value as any })}
                >
                  <SelectTrigger id="actividad">
                    <SelectValue placeholder="Selecciona actividad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="montañismo">Montañismo</SelectItem>
                    <SelectItem value="escalada">Escalada</SelectItem>
                    <SelectItem value="esqui">Esquí</SelectItem>
                    <SelectItem value="alta_montana">Alta Montaña</SelectItem>
                    <SelectItem value="otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipamiento">Equipamiento a Utilizar</Label>
              <Textarea
                id="equipamiento"
                value={avisoSalida.actividad.equipamientoUtilizar || ''}
                onChange={(e) => updateActividad({ equipamientoUtilizar: e.target.value })}
                placeholder="Lista de equipamiento"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha-salida">Fecha de Salida *</Label>
                <Input
                  id="fecha-salida"
                  type="date"
                  value={new Date(avisoSalida.actividad.fechaSalida).toISOString().split('T')[0]}
                  onChange={(e) => {
                    const date = new Date(e.target.value)
                    updateActividad({ fechaSalida: date.getTime() })
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha-regreso">Fecha de Regreso</Label>
                <Input
                  id="fecha-regreso"
                  type="date"
                  value={avisoSalida.actividad.fechaRegreso 
                    ? new Date(avisoSalida.actividad.fechaRegreso).toISOString().split('T')[0]
                    : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const date = new Date(e.target.value)
                      updateActividad({ fechaRegreso: date.getTime() })
                    } else {
                      updateActividad({ fechaRegreso: undefined })
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hora-inicio">Hora de Inicio</Label>
                <Input
                  id="hora-inicio"
                  type="time"
                  value={avisoSalida.actividad.horaInicio || ''}
                  onChange={(e) => updateActividad({ horaInicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hora-termino">Hora de Término</Label>
                <Input
                  id="hora-termino"
                  type="time"
                  value={avisoSalida.actividad.horaTermino || ''}
                  onChange={(e) => updateActividad({ horaTermino: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aprovisionamiento">Aprovisionamiento para cuántos días?</Label>
              <Input
                id="aprovisionamiento"
                type="number"
                value={avisoSalida.actividad.aprovisionamientoDias || ''}
                onChange={(e) => updateActividad({ aprovisionamientoDias: parseInt(e.target.value) || undefined })}
                placeholder="0"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección 3: Contactos de Emergencia */}
      {currentSection === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Contactos de Emergencia *</CardTitle>
            <CardDescription>
              Agrega al menos un contacto de emergencia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {avisoSalida.contactosEmergencia.map((contacto, index) => (
              <Card key={index}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Contacto {index + 1}</h4>
                    {avisoSalida.contactosEmergencia.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeContactoEmergencia(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Nombres</Label>
                    <Input
                      value={contacto.nombres}
                      onChange={(e) => updateContactoEmergencia(index, 'nombres', e.target.value)}
                      placeholder="Nombres completos"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfonos (separados por coma)</Label>
                    <Input
                      value={contacto.telefonos.join(', ')}
                      onChange={(e) => {
                        const telefonos = e.target.value.split(',').map(t => t.trim()).filter(t => t)
                        updateContactoEmergencia(index, 'telefonos', telefonos.length > 0 ? telefonos : [''])
                      }}
                      placeholder="+56 9 1234 5678, +56 9 8765 4321"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={addContactoEmergencia}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Contacto de Emergencia
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sección 4: Participantes - Continuará en siguiente mensaje por longitud */}
      {currentSection === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Participantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {avisoSalida.participantes.map((participante, index) => (
              <Card key={index}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Participante {participante.numero}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeParticipante(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nombres</Label>
                      <Input
                        value={participante.nombres}
                        onChange={(e) => updateParticipante(index, 'nombres', e.target.value)}
                        placeholder="Nombres completos"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Documento de Identidad</Label>
                      <Input
                        value={participante.documentoIdentidad || ''}
                        onChange={(e) => updateParticipante(index, 'documentoIdentidad', e.target.value)}
                        placeholder="RUT/Pasaporte"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input
                        value={participante.telefono || ''}
                        onChange={(e) => updateParticipante(index, 'telefono', e.target.value)}
                        placeholder="+56 9 1234 5678"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contacto de Emergencia</Label>
                      <Input
                        value={participante.contactoEmergencia || ''}
                        onChange={(e) => updateParticipante(index, 'contactoEmergencia', e.target.value)}
                        placeholder="Nombre del contacto"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Teléfono de Emergencia</Label>
                      <Input
                        value={participante.telefonoEmergencia || ''}
                        onChange={(e) => updateParticipante(index, 'telefonoEmergencia', e.target.value)}
                        placeholder="+56 9 1234 5678"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={addParticipante}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Participante
            </Button>

            {/* Participantes con enfermedades */}
            <div className="mt-6 space-y-4">
              <h3 className="font-semibold">Participantes con Enfermedades o Lesiones Crónicas</h3>
              {avisoSalida.participantesConEnfermedades.map((participante, index) => (
                <Card key={index}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Participante {participante.numero}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParticipanteEnfermedad(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nombres</Label>
                        <Input
                          value={participante.nombres}
                          onChange={(e) => updateParticipanteEnfermedad(index, 'nombres', e.target.value)}
                          placeholder="Nombres completos"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Enfermedad o Lesión</Label>
                        <Input
                          value={participante.enfermedadLesion || ''}
                          onChange={(e) => updateParticipanteEnfermedad(index, 'enfermedadLesion', e.target.value)}
                          placeholder="Ej: Diabetes, Traumas, etc."
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Observaciones o Indicaciones</Label>
                        <Textarea
                          value={participante.observaciones || ''}
                          onChange={(e) => updateParticipanteEnfermedad(index, 'observaciones', e.target.value)}
                          placeholder="Indicaciones médicas importantes"
                          rows={2}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={addParticipanteEnfermedad}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Participante con Enfermedad
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sección 5: Lista de Chequeo - Simplificada por espacio */}
      {currentSection === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Lista de Chequeo de Equipamiento</CardTitle>
            <CardDescription>
              Selecciona todo el equipo apropiado para la actividad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Medios de orientación */}
            <div className="space-y-3">
              <Label>Medios de Orientación</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={avisoSalida.listaChequeo.mediosOrientacion?.gps || false}
                    onCheckedChange={(checked) => {
                      updateAvisoSalida({
                        listaChequeo: {
                          ...avisoSalida.listaChequeo,
                          mediosOrientacion: {
                            ...avisoSalida.listaChequeo.mediosOrientacion,
                            gps: !!checked
                          }
                        }
                      })
                    }}
                  />
                  <Label className="font-normal">GPS</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={avisoSalida.listaChequeo.mediosOrientacion?.brujula || false}
                    onCheckedChange={(checked) => {
                      updateAvisoSalida({
                        listaChequeo: {
                          ...avisoSalida.listaChequeo,
                          mediosOrientacion: {
                            ...avisoSalida.listaChequeo.mediosOrientacion,
                            brujula: !!checked
                          }
                        }
                      })
                    }}
                  />
                  <Label className="font-normal">Brújula</Label>
                </div>
              </div>
            </div>

            {/* Otros chequeos básicos */}
            <div className="space-y-3">
              <Label>Equipamiento General</Label>
              {[
                { key: 'cartaTopografica', label: 'Carta Topográfica de la zona' },
                { key: 'chequeoAlimentacion', label: 'Chequeo Alimentación e hidratación' },
                { key: 'chequeoEquipoTecnico', label: 'Chequeo Equipo técnico' },
                { key: 'chequeoEquipoCampamento', label: 'Chequeo Equipo de Campamento' },
                { key: 'chequeoVestuario', label: 'Chequeo Vestuario personal' },
                { key: 'proteccionFrioSolar', label: 'Protección de frío y solar' }
              ].map((item) => (
                <div key={item.key} className="flex items-center space-x-2">
                  <Checkbox
                    checked={avisoSalida.listaChequeo[item.key as keyof typeof avisoSalida.listaChequeo] || false}
                    onCheckedChange={(checked) => {
                      updateAvisoSalida({
                        listaChequeo: {
                          ...avisoSalida.listaChequeo,
                          [item.key]: !!checked
                        }
                      })
                    }}
                  />
                  <Label className="font-normal">{item.label}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navegación entre secciones */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 space-y-2 z-10 safe-area-bottom aviso-salida-footer">
        <div className="flex gap-2">
          {currentSection > 1 && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentSection(currentSection - 1)}
            >
              Anterior
            </Button>
          )}
          {currentSection < sections.length ? (
            <Button
              className="flex-1"
              onClick={() => setCurrentSection(currentSection + 1)}
              disabled={!canProceed()}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => triggerGuide(onComplete)}
              disabled={!canProceed()}
            >
              Completar Aviso de Salida
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
