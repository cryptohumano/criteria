import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Mountain as MountainIcon, 
  Calendar, 
  Thermometer, 
  Wind, 
  Eye,
  CheckCircle2,
  ArrowRight,
  SkipForward,
  Sparkles
} from 'lucide-react'
import type { MountainLog } from '@/types/mountainLogs'
import { toast } from 'sonner'

interface PlaneacionFormProps {
  log: MountainLog
  onUpdate: (log: MountainLog) => void
  onComplete: () => void
  onSkip: () => void
}

// Sugerencias de equipo según tipo de actividad
const equipoSugerencias = {
  montañismo: {
    tecnico: ['piolets', 'crampones', 'cuerdas', 'arneses', 'cascos'],
    campamento: ['carpa', 'sleepingBag', 'colchoneta', 'cocina'],
    vestuario: ['capasBase', 'capasMedias', 'capasExternas', 'guantes', 'gorros', 'gafas'],
    seguridad: ['gps', 'brujula', 'mapa', 'telefonoSatelital', 'radio', 'botiquin']
  },
  escalada: {
    tecnico: ['cuerdas', 'arneses', 'cascos', 'mosquetones', 'aseguradores', 'grigri', 'friends', 'nuts'],
    campamento: ['carpa', 'sleepingBag', 'colchoneta'],
    vestuario: ['capasBase', 'capasMedias', 'guantes', 'gafas'],
    seguridad: ['gps', 'brujula', 'mapa', 'telefonoSatelital', 'botiquin']
  },
  esqui: {
    tecnico: ['esquis', 'bastones', 'fijaciones', 'botas'],
    campamento: ['carpa', 'sleepingBag', 'colchoneta', 'cocina'],
    vestuario: ['capasBase', 'capasMedias', 'capasExternas', 'guantes', 'gorros', 'gafas'],
    seguridad: ['gps', 'brujula', 'mapa', 'telefonoSatelital', 'radio', 'botiquin', 'arva', 'pala', 'sonda']
  },
  alta_montana: {
    tecnico: ['piolets', 'crampones', 'cuerdas', 'arneses', 'cascos', 'mosquetones', 'aseguradores'],
    campamento: ['carpa4estaciones', 'sleepingBag', 'colchoneta', 'cocina'],
    vestuario: ['capasBase', 'capasMedias', 'capasExternas', 'guantes', 'gorros', 'gafas', 'mascara'],
    seguridad: ['gps', 'brujula', 'mapa', 'telefonoSatelital', 'radio', 'botiquin', 'oxigeno', 'altimetro']
  },
  senderismo: {
    tecnico: ['bastones'],
    campamento: ['carpa', 'sleepingBag', 'colchoneta'],
    vestuario: ['capasBase', 'capasMedias', 'capasExternas', 'guantes', 'gorros'],
    seguridad: ['gps', 'brujula', 'mapa', 'telefonoSatelital', 'botiquin']
  },
  trekking: {
    tecnico: ['bastones'],
    campamento: ['carpa', 'sleepingBag', 'colchoneta', 'cocina'],
    vestuario: ['capasBase', 'capasMedias', 'capasExternas', 'guantes', 'gorros'],
    seguridad: ['gps', 'brujula', 'mapa', 'telefonoSatelital', 'botiquin']
  }
}

export function PlaneacionForm({ log, onUpdate, onComplete, onSkip }: PlaneacionFormProps) {
  const planeacion = log.planeacion || {
    nombreBitacora: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  const [nombreBitacora, setNombreBitacora] = useState(planeacion.nombreBitacora || '')
  const [tipoActividad, setTipoActividad] = useState<typeof planeacion.tipoActividad>(planeacion.tipoActividad)
  const [dificultad, setDificultad] = useState<typeof planeacion.dificultad>(planeacion.dificultad)
  const [duracionEstimada, setDuracionEstimada] = useState(planeacion.duracionEstimada || 1)
  const [temporada, setTemporada] = useState<typeof planeacion.temporada>(planeacion.temporada)
  const [notas, setNotas] = useState(planeacion.notas || '')

  const updatePlaneacion = (updates: Partial<typeof planeacion>) => {
    const updatedPlaneacion = {
      ...planeacion,
      ...updates,
      updatedAt: Date.now()
    }
    
    onUpdate({
      ...log,
      planeacion: updatedPlaneacion,
      title: nombreBitacora || log.title
    })
  }

  const handleTipoActividadChange = (tipo: typeof tipoActividad) => {
    setTipoActividad(tipo)
    updatePlaneacion({ tipoActividad: tipo })
    
    // Aplicar sugerencias de equipo automáticamente
    if (tipo && equipoSugerencias[tipo]) {
      const sugerencias = equipoSugerencias[tipo]
      updatePlaneacion({
        tipoActividad: tipo,
        equipoSugerido: {
          tecnico: sugerencias.tecnico.reduce((acc, item) => ({ ...acc, [item]: true }), {}),
          campamento: sugerencias.campamento.reduce((acc, item) => ({ ...acc, [item]: true }), {}),
          vestuario: sugerencias.vestuario.reduce((acc, item) => ({ ...acc, [item]: true }), {}),
          seguridad: sugerencias.seguridad.reduce((acc, item) => ({ ...acc, [item]: true }), {})
        }
      })
      
      toast.success('Equipo sugerido aplicado', {
        description: `Se han marcado los elementos de equipo recomendados para ${tipo}`
      })
    }
  }

  const handleComplete = () => {
    if (!nombreBitacora.trim()) {
      toast.error('El nombre de la bitácora es requerido')
      return
    }

    updatePlaneacion({
      nombreBitacora: nombreBitacora.trim(),
      tipoActividad,
      dificultad,
      duracionEstimada,
      temporada,
      notas: notas.trim() || undefined
    })

    onComplete()
  }

  const sugerenciasEquipo = tipoActividad ? equipoSugerencias[tipoActividad] : null

  return (
    <div className="space-y-6 pb-20">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MountainIcon className="h-5 w-5" />
              <CardTitle>Planeación de Expedición (Opcional)</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNombreBitacora('Ascenso al Cerro El Plomo')
                setTipoActividad('alta_montana')
                setDificultad('dificil')
                setDuracionEstimada(4)
                setTemporada('verano')
                setNotas('Expedición de alta montaña con condiciones variables. Equipo completo necesario.')
                handleTipoActividadChange('alta_montana')
                updatePlaneacion({
                  nombreBitacora: 'Ascenso al Cerro El Plomo',
                  tipoActividad: 'alta_montana',
                  dificultad: 'dificil',
                  duracionEstimada: 4,
                  temporada: 'verano',
                  notas: 'Expedición de alta montaña con condiciones variables. Equipo completo necesario.'
                })
                toast.success('Datos demo cargados', {
                  description: 'Planeación de ejemplo: Ascenso al Cerro El Plomo - Alta Montaña'
                })
              }}
              title="Llenar con datos de ejemplo"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Datos Demo
            </Button>
          </div>
          <CardDescription>
            Planifica tu expedición y obtén sugerencias de equipo. El nombre de la bitácora se asigna aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nombre de la bitácora - REQUERIDO */}
          <div className="space-y-2">
            <Label htmlFor="nombre-bitacora">Nombre de la Bitácora *</Label>
            <Input
              id="nombre-bitacora"
              value={nombreBitacora}
              onChange={(e) => {
                setNombreBitacora(e.target.value)
                updatePlaneacion({ nombreBitacora: e.target.value })
              }}
              placeholder="Ej: Ascenso al Cerro El Plomo"
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">
              Este nombre identificará tu bitácora y se relacionará con el aviso de salida
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo-actividad">Tipo de Actividad</Label>
              <Select
                value={tipoActividad || ''}
                onValueChange={(value) => handleTipoActividadChange(value as typeof tipoActividad)}
              >
                <SelectTrigger id="tipo-actividad">
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="montañismo">Montañismo</SelectItem>
                  <SelectItem value="escalada">Escalada</SelectItem>
                  <SelectItem value="esqui">Esquí</SelectItem>
                  <SelectItem value="alta_montana">Alta Montaña</SelectItem>
                  <SelectItem value="senderismo">Senderismo</SelectItem>
                  <SelectItem value="trekking">Trekking</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dificultad">Dificultad</Label>
              <Select
                value={dificultad || ''}
                onValueChange={(value) => {
                  setDificultad(value as typeof dificultad)
                  updatePlaneacion({ dificultad: value as typeof dificultad })
                }}
              >
                <SelectTrigger id="dificultad">
                  <SelectValue placeholder="Selecciona dificultad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facil">Fácil</SelectItem>
                  <SelectItem value="moderada">Moderada</SelectItem>
                  <SelectItem value="dificil">Difícil</SelectItem>
                  <SelectItem value="muy_dificil">Muy Difícil</SelectItem>
                  <SelectItem value="extrema">Extrema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duracion">Duración Estimada (días)</Label>
              <Input
                id="duracion"
                type="number"
                min="1"
                value={duracionEstimada}
                onChange={(e) => {
                  const days = parseInt(e.target.value) || 1
                  setDuracionEstimada(days)
                  updatePlaneacion({ duracionEstimada: days })
                }}
                placeholder="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="temporada">Temporada</Label>
              <Select
                value={temporada || ''}
                onValueChange={(value) => {
                  setTemporada(value as typeof temporada)
                  updatePlaneacion({ temporada: value as typeof temporada })
                }}
              >
                <SelectTrigger id="temporada">
                  <SelectValue placeholder="Selecciona temporada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verano">Verano</SelectItem>
                  <SelectItem value="invierno">Invierno</SelectItem>
                  <SelectItem value="primavera">Primavera</SelectItem>
                  <SelectItem value="otoño">Otoño</SelectItem>
                  <SelectItem value="todo_el_año">Todo el Año</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sugerencias de Equipo */}
          {tipoActividad && sugerenciasEquipo && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Equipo Sugerido para {tipoActividad}</CardTitle>
                <CardDescription className="text-xs">
                  Basado en el tipo de actividad seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Equipo Técnico</p>
                  <div className="flex flex-wrap gap-2">
                    {sugerenciasEquipo.tecnico.map((item) => (
                      <Badge key={item} variant="outline" className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Equipo de Campamento</p>
                  <div className="flex flex-wrap gap-2">
                    {sugerenciasEquipo.campamento.map((item) => (
                      <Badge key={item} variant="outline" className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Vestuario</p>
                  <div className="flex flex-wrap gap-2">
                    {sugerenciasEquipo.vestuario.map((item) => (
                      <Badge key={item} variant="outline" className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Seguridad</p>
                  <div className="flex flex-wrap gap-2">
                    {sugerenciasEquipo.seguridad.map((item) => (
                      <Badge key={item} variant="outline" className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="notas">Notas de Planeación</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => {
                setNotas(e.target.value)
                updatePlaneacion({ notas: e.target.value })
              }}
              placeholder="Notas adicionales sobre la planeación, condiciones esperadas, etc."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 space-y-2 z-10 safe-area-bottom">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onSkip}
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Omitir Planeación
          </Button>
          <Button
            className="flex-1"
            onClick={handleComplete}
            disabled={!nombreBitacora.trim()}
          >
            Continuar a Aviso de Salida
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
