import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  User, 
  MapPin, 
  Calendar, 
  Users, 
  Phone, 
  Mail, 
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Mountain as MountainIcon,
  Clock
} from 'lucide-react'
import type { MountainLog } from '@/types/mountainLogs'
import { useKeyringContext } from '@/contexts/KeyringContext'
import Identicon from '@polkadot/react-identicon'

interface AvisoSalidaViewProps {
  avisoSalida: NonNullable<MountainLog['avisoSalida']>
  relatedAccount?: string // Cuenta asociada a la bitácora
}

export function AvisoSalidaView({ avisoSalida, relatedAccount }: AvisoSalidaViewProps) {
  const { accounts } = useKeyringContext()
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (time: string) => {
    return time || 'No especificada'
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Cuenta asociada a la bitácora */}
      {relatedAccount && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Cuenta asociada a esta bitácora</CardTitle>
            <CardDescription>
              La cuenta está asociada permanentemente a esta bitácora y al aviso de salida.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {(() => {
                const account = accounts.find(acc => acc.address === relatedAccount)
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
                    {relatedAccount.substring(0, 8)}...{relatedAccount.slice(-8)}
                  </span>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Datos del Guía */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Datos del Guía/Líder</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nombre Completo</p>
              <p className="text-base">{avisoSalida.guia.nombres} {avisoSalida.guia.apellidos}</p>
            </div>
            {avisoSalida.guia.rutPasaporte && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">RUT/Pasaporte</p>
                <p className="text-base">{avisoSalida.guia.rutPasaporte}</p>
              </div>
            )}
            {avisoSalida.guia.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base">{avisoSalida.guia.email}</p>
                </div>
              </div>
            )}
            {avisoSalida.guia.telefono && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Teléfono</p>
                  <p className="text-base">{avisoSalida.guia.telefono}</p>
                </div>
              </div>
            )}
            {avisoSalida.guia.nacionalidad && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nacionalidad</p>
                <p className="text-base">{avisoSalida.guia.nacionalidad}</p>
              </div>
            )}
            {avisoSalida.guia.edad && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Edad</p>
                <p className="text-base">{avisoSalida.guia.edad} años</p>
              </div>
            )}
            {avisoSalida.guia.profesion && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Profesión</p>
                <p className="text-base">{avisoSalida.guia.profesion}</p>
              </div>
            )}
            {avisoSalida.guia.domicilio && (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Domicilio</p>
                <p className="text-base">{avisoSalida.guia.domicilio}</p>
              </div>
            )}
            {avisoSalida.guia.institucionEmpresa && (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Institución/Empresa</p>
                <p className="text-base">{avisoSalida.guia.institucionEmpresa}</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              {avisoSalida.guia.experienciaSector ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Experiencia en el Sector</span>
            </div>
            <div className="flex items-center gap-2">
              {avisoSalida.guia.experienciaExpediciones ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Experiencia en Expediciones</span>
            </div>
            <div className="flex items-center gap-2">
              {avisoSalida.guia.seguroAccidente ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Seguro de Accidente</span>
            </div>
            {avisoSalida.guia.previsionSalud && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Previsión de Salud</p>
                <p className="text-base">{avisoSalida.guia.previsionSalud}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información de Actividad */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MountainIcon className="h-5 w-5" />
            <CardTitle>Información de la Actividad</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {avisoSalida.actividad.regionDestino && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Región de Destino</p>
                <p className="text-base">{avisoSalida.actividad.regionDestino}</p>
              </div>
            )}
            {avisoSalida.actividad.lugarDestino && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Lugar de Destino</p>
                <p className="text-base font-semibold">{avisoSalida.actividad.lugarDestino}</p>
              </div>
            )}
            {avisoSalida.actividad.ruta && (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Ruta</p>
                <p className="text-base">{avisoSalida.actividad.ruta}</p>
              </div>
            )}
            {avisoSalida.actividad.archivoRuta && (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Archivo de Ruta</p>
                <Badge variant="outline">{avisoSalida.actividad.archivoRuta}</Badge>
              </div>
            )}
            {avisoSalida.actividad.numeroParticipantes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nº de Participantes</p>
                <p className="text-base">{avisoSalida.actividad.numeroParticipantes}</p>
              </div>
            )}
            {avisoSalida.actividad.tipoActividad && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tipo de Actividad</p>
                <Badge>
                  {avisoSalida.actividad.tipoActividad === 'montañismo' ? 'Montañismo' :
                   avisoSalida.actividad.tipoActividad === 'escalada' ? 'Escalada' :
                   avisoSalida.actividad.tipoActividad === 'esqui' ? 'Esquí' :
                   avisoSalida.actividad.tipoActividad === 'alta_montana' ? 'Alta Montaña' :
                   'Otros'}
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fecha de Salida</p>
                <p className="text-base">{formatDate(avisoSalida.actividad.fechaSalida)}</p>
              </div>
            </div>
            {avisoSalida.actividad.fechaRegreso && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha de Regreso</p>
                  <p className="text-base">{formatDate(avisoSalida.actividad.fechaRegreso)}</p>
                </div>
              </div>
            )}
            {avisoSalida.actividad.horaInicio && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hora de Inicio</p>
                  <p className="text-base">{formatTime(avisoSalida.actividad.horaInicio)}</p>
                </div>
              </div>
            )}
            {avisoSalida.actividad.horaTermino && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hora de Término</p>
                  <p className="text-base">{formatTime(avisoSalida.actividad.horaTermino)}</p>
                </div>
              </div>
            )}
            {avisoSalida.actividad.aprovisionamientoDias && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aprovisionamiento</p>
                <p className="text-base">{avisoSalida.actividad.aprovisionamientoDias} día{avisoSalida.actividad.aprovisionamientoDias !== 1 ? 's' : ''}</p>
              </div>
            )}
            {avisoSalida.actividad.equipamientoUtilizar && (
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Equipamiento a Utilizar</p>
                <p className="text-base">{avisoSalida.actividad.equipamientoUtilizar}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contactos de Emergencia */}
      {avisoSalida.contactosEmergencia.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              <CardTitle>Contactos de Emergencia</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {avisoSalida.contactosEmergencia.map((contacto, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <p className="font-semibold mb-2">{contacto.nombres}</p>
                <div className="flex flex-wrap gap-2">
                  {contacto.telefonos.map((telefono, telIndex) => (
                    <Badge key={telIndex} variant="outline" className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {telefono}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Participantes */}
      {avisoSalida.participantes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>Lista de Participantes ({avisoSalida.participantes.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {avisoSalida.participantes.map((participante, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold">{participante.nombres}</p>
                      {participante.documentoIdentidad && (
                        <p className="text-sm text-muted-foreground">ID: {participante.documentoIdentidad}</p>
                      )}
                    </div>
                    <Badge variant="secondary">#{participante.numero}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {participante.telefono && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Tel:</span>
                        <span>{participante.telefono}</span>
                      </div>
                    )}
                    {participante.contactoEmergencia && (
                      <div>
                        <span className="text-muted-foreground">Emergencia:</span>
                        <span className="ml-1">{participante.contactoEmergencia}</span>
                      </div>
                    )}
                    {participante.telefonoEmergencia && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span>{participante.telefonoEmergencia}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Participantes con Enfermedades */}
      {avisoSalida.participantesConEnfermedades.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle>Participantes con Enfermedades/Lesiones</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {avisoSalida.participantesConEnfermedades.map((participante, index) => (
                <div key={index} className="p-3 border border-yellow-500/30 rounded-lg bg-background">
                  <p className="font-semibold mb-1">{participante.nombres}</p>
                  {participante.enfermedadLesion && (
                    <p className="text-sm mb-1">
                      <span className="font-medium">Enfermedad/Lesión:</span> {participante.enfermedadLesion}
                    </p>
                  )}
                  {participante.observaciones && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Observaciones:</span> {participante.observaciones}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Chequeo */}
      {avisoSalida.listaChequeo && Object.keys(avisoSalida.listaChequeo).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle>Lista de Chequeo</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {avisoSalida.listaChequeo.mediosOrientacion && (
                <div>
                  <p className="text-sm font-medium mb-2">Medios de Orientación</p>
                  <div className="flex flex-wrap gap-2">
                    {avisoSalida.listaChequeo.mediosOrientacion.gps && (
                      <Badge variant="outline">GPS</Badge>
                    )}
                    {avisoSalida.listaChequeo.mediosOrientacion.brujula && (
                      <Badge variant="outline">Brújula</Badge>
                    )}
                    {avisoSalida.listaChequeo.mediosOrientacion.otro && (
                      <Badge variant="outline">{avisoSalida.listaChequeo.mediosOrientacion.otro}</Badge>
                    )}
                  </div>
                </div>
              )}
              {avisoSalida.listaChequeo.telefonosComunicacion && (
                <div>
                  <p className="text-sm font-medium mb-2">Teléfonos de Comunicación</p>
                  <div className="flex flex-wrap gap-2">
                    {avisoSalida.listaChequeo.telefonosComunicacion.movil && (
                      <Badge variant="outline">Móvil</Badge>
                    )}
                    {avisoSalida.listaChequeo.telefonosComunicacion.satelital && (
                      <Badge variant="outline">Satelital: {avisoSalida.listaChequeo.telefonosComunicacion.satelital}</Badge>
                    )}
                  </div>
                </div>
              )}
              {avisoSalida.listaChequeo.radiosComunicacion && (
                <div>
                  <p className="text-sm font-medium mb-2">Radios de Comunicación</p>
                  <div className="flex flex-wrap gap-2">
                    {avisoSalida.listaChequeo.radiosComunicacion.vhf && (
                      <Badge variant="outline">VHF</Badge>
                    )}
                    {avisoSalida.listaChequeo.radiosComunicacion.uhf && (
                      <Badge variant="outline">UHF</Badge>
                    )}
                    {avisoSalida.listaChequeo.radiosComunicacion.duales && (
                      <Badge variant="outline">Duales: {avisoSalida.listaChequeo.radiosComunicacion.duales}</Badge>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {avisoSalida.listaChequeo.cartaTopografica && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Carta Topográfica</span>
                  </div>
                )}
                {avisoSalida.listaChequeo.chequeoAlimentacion && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Alimentación e Hidratación</span>
                  </div>
                )}
                {avisoSalida.listaChequeo.chequeoEquipoTecnico && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Equipo Técnico</span>
                  </div>
                )}
                {avisoSalida.listaChequeo.chequeoEquipoCampamento && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Equipo de Campamento</span>
                  </div>
                )}
                {avisoSalida.listaChequeo.chequeoVestuario && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Vestuario Personal</span>
                  </div>
                )}
                {avisoSalida.listaChequeo.proteccionFrioSolar && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Protección Frío y Solar</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
