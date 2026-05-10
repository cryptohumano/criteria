/**
 * Datos dummy para el formulario de Aviso de Salida
 * Útil para testing y demostración
 */

import type { MountainLog } from '@/types/mountainLogs'

export const dummyAvisoSalida: Partial<MountainLog['avisoSalida']> = {
  guia: {
    nombres: 'Juan Carlos',
    apellidos: 'Pérez González',
    documentoIdentidad: 'Cédula de Identidad',
    rutPasaporte: '12.345.678-9',
    email: 'juan.perez@ejemplo.com',
    telefono: '+56 9 1234 5678',
    nacionalidad: 'Chilena',
    edad: 35,
    profesion: 'Guía de Montaña Certificado',
    telefonos: ['+56 9 1234 5678', '+56 9 8765 4321'],
    domicilio: 'Av. Providencia 1234, Santiago, Región Metropolitana',
    institucionEmpresa: 'Escuela Nacional de Montañismo',
    experienciaSector: true,
    experienciaExpediciones: true,
    seguroAccidente: true,
    previsionSalud: 'ISAPRE Consalud'
  },
  actividad: {
    regionDestino: 'Región de Valparaíso',
    lugarDestino: 'Cerro El Plomo',
    ruta: 'Ruta Normal por Glaciar La Ollada',
    archivoRuta: '',
    numeroParticipantes: 4,
    actividadPracticar: 'Alta Montaña',
    tipoActividad: 'alta_montana',
    equipamientoUtilizar: 'Crampones, piolets, arneses, cuerdas dinámicas, casco, mosquetones, aseguradores, cordines, linternas frontales',
    fechaSalida: new Date('2024-12-15').getTime(),
    fechaRegreso: new Date('2024-12-18').getTime(),
    horaInicio: '06:00',
    horaTermino: '18:00',
    aprovisionamientoDias: 4
  },
  contactosEmergencia: [
    {
      nombres: 'María Elena Rodríguez',
      telefonos: ['+56 9 9876 5432', '+56 2 2345 6789']
    },
    {
      nombres: 'Carlos Andrés Pérez',
      telefonos: ['+56 9 1111 2222']
    },
    {
      nombres: 'Carabineros San Gabriel',
      telefonos: ['+56 2 1234 5678']
    }
  ],
  participantes: [
    {
      numero: 1,
      nombres: 'Ana Sofía Martínez',
      documentoIdentidad: '13.456.789-0',
      telefono: '+56 9 2222 3333',
      contactoEmergencia: 'Roberto Martínez',
      telefonoEmergencia: '+56 9 3333 4444'
    },
    {
      numero: 2,
      nombres: 'Pedro Ignacio López',
      documentoIdentidad: '14.567.890-1',
      telefono: '+56 9 4444 5555',
      contactoEmergencia: 'Carmen López',
      telefonoEmergencia: '+56 9 5555 6666'
    },
    {
      numero: 3,
      nombres: 'Fernanda Constanza Silva',
      documentoIdentidad: '15.678.901-2',
      telefono: '+56 9 6666 7777',
      contactoEmergencia: 'Patricio Silva',
      telefonoEmergencia: '+56 9 7777 8888'
    },
    {
      numero: 4,
      nombres: 'Diego Alejandro Torres',
      documentoIdentidad: '16.789.012-3',
      telefono: '+56 9 8888 9999',
      contactoEmergencia: 'Laura Torres',
      telefonoEmergencia: '+56 9 9999 0000'
    }
  ],
  participantesConEnfermedades: [
    {
      numero: 2,
      nombres: 'Pedro Ignacio López',
      enfermedadLesion: 'Asma leve',
      observaciones: 'Lleva inhalador de rescate. No presenta síntomas en reposo.'
    }
  ],
  listaChequeo: {
    mediosOrientacion: {
      gps: true,
      brujula: true,
      otro: 'Mapa topográfico impreso'
    },
    telefonosComunicacion: {
      movil: true,
      satelital: 'Iridium 9555 - +8816 1234 5678'
    },
    radiosComunicacion: {
      vhf: true,
      uhf: false,
      duales: 'VHF 146.520 MHz'
    },
    cartaTopografica: true,
    chequeoAlimentacion: true,
    chequeoEquipoTecnico: true,
    chequeoEquipoCampamento: true,
    chequeoVestuario: true,
    proteccionFrioSolar: true
  },
  equipoTecnico: {
    piolets: 4,
    crampones: 4,
    metrosCuerdaDinamica: 60,
    metrosCuerdaSemiEstatica: 30,
    cascos: 4,
    arneses: 4,
    aseguradores: 8,
    ascendedores: 4,
    mosquetones: 20,
    cordines: 10,
    linternas: 4
  },
  botiquin: {
    elementosEntablillado: true,
    inmovilizadorCuello: true,
    vendajesFerulas: true,
    apósitosCintas: true,
    pinzasTijera: true,
    guantesQuirurgicos: true,
    sueroFisiologico: true,
    analgesicos: true,
    antinflamatorios: true,
    antiespasmodicos: true,
    antihistaminicos: true,
    antidiarreicos: true,
    antigripal: true,
    salesHidratantes: true,
    manualPrimerosAuxilios: true,
    cremaQuemaduras: true,
    libretaLapiz: true,
    mantaTermica: true,
    espejoSilbato: true,
    termometro: true,
    mantaAgua: true,
    fosforosEncendedor: true,
    otros: 'Oxímetro de pulso, vendas elásticas, gasas estériles'
  },
  supervivencia: {
    otros: 'Kit de supervivencia con espejo señalización, silbato, fósforos a prueba de agua'
  }
}

/**
 * Función helper para llenar el formulario con datos dummy
 */
export function fillDummyData(log: MountainLog): MountainLog {
  return {
    ...log,
    avisoSalida: dummyAvisoSalida as MountainLog['avisoSalida'],
    title: dummyAvisoSalida.actividad?.lugarDestino || log.title,
    location: dummyAvisoSalida.actividad?.regionDestino || log.location,
    mountainName: dummyAvisoSalida.actividad?.lugarDestino || log.mountainName
  }
}
