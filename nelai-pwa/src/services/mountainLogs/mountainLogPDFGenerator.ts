/**
 * Generador de PDF para bitácoras de montañismo
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDFDocument } from 'pdf-lib'
import type { MountainLog } from '@/types/mountainLogs'
import { calculatePDFHash } from '@/services/pdf/PDFHash'
import { injectGPSMetadata } from '@/services/pdf/PDFMetadata'
import { generateMapImageBase64 } from '@/components/mountainLogs/RouteMap'
import { aggregateExifFromMountainLog } from '@/utils/exifAggregation'

export interface MountainLogPDFOptions {
  log: MountainLog
  includeImages?: boolean // Si incluir imágenes en el PDF (puede hacer el archivo muy grande)
  authorName?: string // Nombre del autor (cuenta de la wallet)
}

/**
 * Genera un PDF completo de la bitácora de montañismo
 */
export async function generateMountainLogPDF(
  options: MountainLogPDFOptions
): Promise<{
  pdfBase64: string
  pdfHash: string
  pdfSize: number
}> {
  const { log, includeImages = false, authorName } = options

  // Crear instancia de jsPDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  // Configurar metadata del PDF
  pdf.setProperties({
    title: log.title || 'Bitácora de Montañismo',
    author: authorName || log.relatedAccount || 'criterIA',
    subject: 'Bitácora de Montañismo',
    keywords: ['montañismo', 'bitácora', 'expedición', log.mountainName || '', log.location || ''].filter(Boolean).join(', '),
    creator: 'CriterIA',
    producer: 'CriterIA PDF',
  })

  // Inyectar metadata GPS si hay ubicación inicial
  if (log.startLocation) {
    injectGPSMetadata(pdf, log.startLocation)
  }

  let yPosition = 20
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)

  // ===== PORTADA =====
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('BITÁCORA DE MONTAÑISMO', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // Leyenda para bitácoras históricas
  if (log.isHistorical) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100) // Gris
    pdf.text('BITÁCORA HISTÓRICA', pageWidth / 2, yPosition, { align: 'center' })
    pdf.setTextColor(0, 0, 0) // Volver a negro
    yPosition += 8
  }

  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'normal')
  pdf.text(log.title || 'Sin título', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 10

  if (log.mountainName) {
    pdf.setFontSize(14)
    pdf.text(`Montaña: ${log.mountainName}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 8
  }

  if (log.location) {
    pdf.setFontSize(12)
    pdf.text(`Ubicación: ${log.location}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 8
  }

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'italic')
  const startDate = new Date(log.startDate).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  pdf.text(`Fecha de inicio: ${startDate}`, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 6

  if (log.endDate) {
    const endDate = new Date(log.endDate).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    pdf.text(`Fecha de fin: ${endDate}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 6
  }

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  const statusText = {
    draft: 'Borrador',
    in_progress: 'En Progreso',
    completed: 'Finalizada',
    cancelled: 'Cancelada',
  }[log.status] || log.status
  pdf.text(`Estado: ${statusText}`, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // ===== PLANEACIÓN =====
  if (log.planeacion) {
    if (yPosition > pageHeight - 40) {
      pdf.addPage()
      yPosition = 20
    }

    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PLANEACIÓN DE EXPEDICIÓN', margin, yPosition)
    yPosition += 8

    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')

    const planeacionData = [
      ['Campo', 'Valor'],
      ['Tipo de Actividad', log.planeacion.tipoActividad || 'No especificado'],
      ['Dificultad', log.planeacion.dificultad || 'No especificada'],
      ['Duración Estimada', log.planeacion.duracionEstimada ? `${log.planeacion.duracionEstimada} días` : 'No especificada'],
      ['Temporada', log.planeacion.temporada || 'No especificada'],
    ]

    if (log.planeacion.notas) {
      planeacionData.push(['Notas', log.planeacion.notas])
    }

    autoTable(pdf, {
      head: [planeacionData[0]],
      body: planeacionData.slice(1),
      startY: yPosition,
      margin: { left: margin, right: margin },
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] },
    })
    yPosition = (pdf as any).lastAutoTable.finalY + 10
  }

  // ===== AVISO DE SALIDA =====
  if (log.avisoSalida) {
    if (yPosition > pageHeight - 60) {
      pdf.addPage()
      yPosition = 20
    }

    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text('AVISO DE SALIDA - SOCORRO DE MONTAÑA', margin, yPosition)
    yPosition += 8

    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Guía', margin, yPosition)
    yPosition += 6

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    const guia = log.avisoSalida.guia
    const guiaInfo = [
      `Nombre: ${guia.nombres} ${guia.apellidos}`,
      guia.email ? `Email: ${guia.email}` : '',
      guia.telefono ? `Teléfono: ${guia.telefono}` : '',
      guia.rutPasaporte ? `RUT/Pasaporte: ${guia.rutPasaporte}` : '',
      guia.nacionalidad ? `Nacionalidad: ${guia.nacionalidad}` : '',
      guia.edad ? `Edad: ${guia.edad}` : '',
      guia.profesion ? `Profesión: ${guia.profesion}` : '',
    ].filter(Boolean)

    guiaInfo.forEach((line) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage()
        yPosition = 20
      }
      pdf.text(line, margin, yPosition)
      yPosition += 5
    })
    yPosition += 3

    // Actividad
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Actividad', margin, yPosition)
    yPosition += 6

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    const actividad = log.avisoSalida.actividad
    const actividadInfo = [
      `Región de Destino: ${actividad.regionDestino}`,
      `Lugar de Destino: ${actividad.lugarDestino}`,
      actividad.rutaOpcional ? `Ruta: ${actividad.rutaOpcional}` : '',
      `Número de Participantes: ${actividad.numParticipantes}`,
      `Actividad a Practicar: ${actividad.actividadPracticar}`,
      `Fecha de Salida: ${new Date(actividad.fechaSalida).toLocaleDateString('es-ES')}`,
      `Fecha de Regreso: ${new Date(actividad.fechaRegreso).toLocaleDateString('es-ES')}`,
      `Hora de Inicio: ${actividad.horaInicio}`,
      `Hora de Término: ${actividad.horaTermino}`,
      `Aprovisionamiento: ${actividad.aprovisionamientoDias} días`,
    ].filter(Boolean)

    actividadInfo.forEach((line) => {
      if (yPosition > pageHeight - 20) {
        pdf.addPage()
        yPosition = 20
      }
      pdf.text(line, margin, yPosition)
      yPosition += 5
    })
    yPosition += 5

    // Participantes
    if (log.avisoSalida.participantes && log.avisoSalida.participantes.length > 0) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage()
        yPosition = 20
      }

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Participantes', margin, yPosition)
      yPosition += 6

      const participantesTable = [
        ['Nombre', 'C.I./Identidad', 'Teléfono'],
        ...log.avisoSalida.participantes.map(p => [
          p.nombres,
          p.ciIdentidad,
          p.telefono,
        ]),
      ]

      autoTable(pdf, {
        head: [participantesTable[0]],
        body: participantesTable.slice(1),
        startY: yPosition,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
      })
      yPosition = (pdf as any).lastAutoTable.finalY + 10
    }

    // Contactos de Emergencia
    if (log.avisoSalida.contactosEmergencia && log.avisoSalida.contactosEmergencia.length > 0) {
      if (yPosition > pageHeight - 40) {
        pdf.addPage()
        yPosition = 20
      }

      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Contactos de Emergencia', margin, yPosition)
      yPosition += 6

      const contactosTable = [
        ['Nombre', 'Teléfono'],
        ...log.avisoSalida.contactosEmergencia.map(c => [c.nombre, c.telefono]),
      ]

      autoTable(pdf, {
        head: [contactosTable[0]],
        body: contactosTable.slice(1),
        startY: yPosition,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 139, 202] },
      })
      yPosition = (pdf as any).lastAutoTable.finalY + 10
    }
  }

  // ===== MILESTONES =====
  if (log.milestones && log.milestones.length > 0) {
    if (yPosition > pageHeight - 40) {
      pdf.addPage()
      yPosition = 20
    }

    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text('HITOS DE LA EXPEDICIÓN', margin, yPosition)
    yPosition += 10

    // Ordenar milestones por timestamp
    const sortedMilestones = [...log.milestones].sort((a, b) => a.timestamp - b.timestamp)

    for (let i = 0; i < sortedMilestones.length; i++) {
      const milestone = sortedMilestones[i]

      if (yPosition > pageHeight - 50) {
        pdf.addPage()
        yPosition = 20
      }

      // Tipo y título
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      const typeText = {
        checkpoint: 'Punto de Control',
        camp: 'Campamento',
        summit: 'Cumbre',
        photo: 'Foto',
        note: 'Nota',
        custom: 'Personalizado',
      }[milestone.type] || milestone.type
      pdf.text(`${i + 1}. ${typeText}: ${milestone.title}`, margin, yPosition)
      yPosition += 6

      // Timestamp - mostrar fechas/horas manuales si están disponibles (bitácoras históricas)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'italic')
      if (milestone.metadata?.fechaInicio || milestone.metadata?.horaInicio) {
        // Mostrar fecha/hora manual para históricas
        const fechaInicio = milestone.metadata.fechaInicio
        const horaInicio = milestone.metadata.horaInicio
        if (fechaInicio) {
          const fechaFormateada = new Date(fechaInicio).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
          const horaTexto = horaInicio ? ` ${horaInicio}` : ''
          pdf.text(`Fecha de Inicio: ${fechaFormateada}${horaTexto}`, margin, yPosition)
          yPosition += 4
        }
        if (milestone.metadata.fechaLlegada || milestone.metadata.horaLlegada) {
          const fechaLlegada = milestone.metadata.fechaLlegada
          const horaLlegada = milestone.metadata.horaLlegada
          if (fechaLlegada) {
            const fechaFormateada = new Date(fechaLlegada).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
            const horaTexto = horaLlegada ? ` ${horaLlegada}` : ''
            pdf.text(`Fecha de Llegada: ${fechaFormateada}${horaTexto}`, margin, yPosition)
            yPosition += 4
          }
        }
        if (milestone.metadata.fechaSalida || milestone.metadata.horaSalida) {
          const fechaSalida = milestone.metadata.fechaSalida
          const horaSalida = milestone.metadata.horaSalida
          if (fechaSalida) {
            const fechaFormateada = new Date(fechaSalida).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
            const horaTexto = horaSalida ? ` ${horaSalida}` : ''
            pdf.text(`Fecha de Salida: ${fechaFormateada}${horaTexto}`, margin, yPosition)
            yPosition += 4
          }
        }
      } else {
        // Mostrar timestamp automático para bitácoras activas
        const milestoneDate = new Date(milestone.timestamp).toLocaleString('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        pdf.text(`Fecha: ${milestoneDate}`, margin, yPosition)
        yPosition += 5
      }

      // GPS
      if (milestone.gpsPoint) {
        pdf.setFontSize(9)
        pdf.setFont('helvetica', 'normal')
        pdf.text(
          `GPS: ${milestone.gpsPoint.latitude.toFixed(6)}, ${milestone.gpsPoint.longitude.toFixed(6)}`,
          margin,
          yPosition
        )
        yPosition += 4
        if (milestone.gpsPoint.altitude) {
          pdf.text(`Altitud: ${Math.round(milestone.gpsPoint.altitude)} m`, margin, yPosition)
          yPosition += 4
        }
        if (milestone.gpsPoint.accuracy) {
          pdf.text(`Precisión: ±${Math.round(milestone.gpsPoint.accuracy)} m`, margin, yPosition)
          yPosition += 4
        }
      }

      // Descripción
      if (milestone.description) {
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        const descLines = pdf.splitTextToSize(milestone.description, contentWidth)
        pdf.text(descLines, margin, yPosition)
        yPosition += descLines.length * 5 + 3
      }

      // Metadata adicional (excluyendo fechas/horas que ya se mostraron arriba)
      if (milestone.metadata) {
        const metaInfo: string[] = []
        if (milestone.metadata.elevation) {
          metaInfo.push(`Elevación: ${milestone.metadata.elevation} m`)
        }
        if (milestone.metadata.weather) {
          metaInfo.push(`Clima: ${milestone.metadata.weather}`)
        }
        if (milestone.metadata.temperature) {
          metaInfo.push(`Temperatura: ${milestone.metadata.temperature}°C`)
        }
        if (milestone.metadata.duration) {
          metaInfo.push(`Duración: ${milestone.metadata.duration} min`)
        }
        if (milestone.metadata.distance) {
          metaInfo.push(`Distancia: ${milestone.metadata.distance} km`)
        }

        if (metaInfo.length > 0) {
          pdf.setFontSize(9)
          pdf.setFont('helvetica', 'italic')
          pdf.text(metaInfo.join(' • '), margin, yPosition)
          yPosition += 5
        }
      }

      // Imágenes
      if (milestone.images && milestone.images.length > 0) {
        if (includeImages) {
          // Agregar cada imagen al PDF
          for (let imgIndex = 0; imgIndex < milestone.images.length; imgIndex++) {
            const image = milestone.images[imgIndex]
            
            // Verificar si necesitamos una nueva página
            if (yPosition > pageHeight - 60) {
              pdf.addPage()
              yPosition = 20
            }

            try {
              // Redimensionar imagen para que quepa en el PDF
              const maxWidth = contentWidth // Ancho disponible
              const maxHeight = 50 // Altura máxima en mm
              
              // Obtener dimensiones de la imagen desde metadata si están disponibles
              let imgWidth = image.metadata.width || 800
              let imgHeight = image.metadata.height || 600
              
              // Si no hay dimensiones en metadata, intentar obtenerlas de la imagen base64
              if (!image.metadata.width || !image.metadata.height) {
                // Crear un elemento Image para obtener dimensiones
                const img = new Image()
                const srcForDimensions = image.data?.startsWith('data:') ? image.data : `data:${image.metadata.mimeType || 'image/jpeg'};base64,${image.data || ''}`
                img.src = srcForDimensions
                
                // Esperar a que la imagen se cargue
                await new Promise<void>((resolve) => {
                  img.onload = () => {
                    imgWidth = img.width
                    imgHeight = img.height
                    resolve()
                  }
                  img.onerror = () => {
                    // Usar dimensiones por defecto si falla
                    imgWidth = 800
                    imgHeight = 600
                    resolve()
                  }
                  // Timeout de seguridad
                  setTimeout(() => resolve(), 1000)
                })
              }
              
              // Calcular dimensiones manteniendo aspect ratio
              const aspectRatio = imgWidth / imgHeight
              let finalWidth = maxWidth
              let finalHeight = maxWidth / aspectRatio
              
              if (finalHeight > maxHeight) {
                finalHeight = maxHeight
                finalWidth = maxHeight * aspectRatio
              }
              
              // Determinar el formato de la imagen
              const imageFormat = image.metadata.mimeType?.includes('png') ? 'PNG' : 'JPEG'
              // Asegurar data URL válida (jsPDF acepta data:image/...;base64,...)
              let imageData = image.data
              if (imageData && !imageData.startsWith('data:')) {
                const mime = imageFormat === 'PNG' ? 'image/png' : 'image/jpeg'
                imageData = `data:${mime};base64,${imageData}`
              }
              
              // Agregar imagen al PDF
              pdf.addImage(
                imageData,
                imageFormat,
                margin,
                yPosition,
                finalWidth,
                finalHeight
              )
              
              yPosition += finalHeight + 3
              
              // Agregar caption si hay descripción
              if (image.description) {
                pdf.setFontSize(8)
                pdf.setFont('helvetica', 'italic')
                const captionLines = pdf.splitTextToSize(image.description, contentWidth)
                pdf.text(captionLines, margin, yPosition)
                yPosition += captionLines.length * 4 + 2
              }
              
              // Agregar información de la imagen (opcional)
              pdf.setFontSize(7)
              pdf.setFont('helvetica', 'normal')
              pdf.text(
                `Imagen ${imgIndex + 1}/${milestone.images.length} - ${image.metadata.filename}`,
                margin,
                yPosition
              )
              yPosition += 4
            } catch (error) {
              console.error('Error al agregar imagen al PDF:', error)
              // Continuar sin la imagen si hay error
              pdf.setFontSize(8)
              pdf.setFont('helvetica', 'italic')
              pdf.text(`[Imagen ${imgIndex + 1} no disponible]`, margin, yPosition)
              yPosition += 5
            }
          }
        } else {
          // Solo mencionar cantidad si no se incluyen
          pdf.setFontSize(9)
          pdf.setFont('helvetica', 'italic')
          pdf.text(`Imágenes: ${milestone.images.length} (no incluidas en PDF)`, margin, yPosition)
          yPosition += 4
        }
      }

      yPosition += 5
    }
  }

  // ===== MAPA DE LA RUTA =====
  // Obtener todos los puntos GPS
  const allGPSPoints: Array<{ latitude: number; longitude: number }> = []
  if (log.milestones) {
    log.milestones.forEach(m => {
      if (m.gpsPoint) {
        allGPSPoints.push({ latitude: m.gpsPoint.latitude, longitude: m.gpsPoint.longitude })
      }
    })
  }
  if (log.gpsPoints && log.gpsPoints.length > 0) {
    log.gpsPoints.forEach(p => {
      allGPSPoints.push({ latitude: p.latitude, longitude: p.longitude })
    })
  }

  if (allGPSPoints.length > 0) {
    if (yPosition > pageHeight - 80) {
      pdf.addPage()
      yPosition = 20
    }

    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text('MAPA DE LA RUTA', margin, yPosition)
    yPosition += 8

    try {
      // Generar imagen del mapa
      // Intentar generar el mapa, pero no fallar si no se puede
      let mapImageBase64: string | null = null
      try {
        mapImageBase64 = await generateMapImageBase64(log)
      } catch (error) {
        console.warn('[Mountain Log PDF] No se pudo generar el mapa, continuando sin él:', error)
        // Continuar sin el mapa - no es crítico
      }
      
      if (mapImageBase64) {
        // Redimensionar imagen del mapa para que quepa en el PDF
        const maxWidth = contentWidth
        const maxHeight = 80 // mm

        // Crear imagen para obtener dimensiones
        const img = new Image()
        img.src = mapImageBase64
        
        await new Promise<void>((resolve) => {
          img.onload = () => {
            try {
              const aspectRatio = img.width / img.height
              let finalWidth = maxWidth
              let finalHeight = maxWidth / aspectRatio
              
              if (finalHeight > maxHeight) {
                finalHeight = maxHeight
                finalWidth = maxHeight * aspectRatio
              }

              // Agregar imagen del mapa al PDF
              pdf.addImage(
                mapImageBase64,
                'PNG',
                margin,
                yPosition,
                finalWidth,
                finalHeight
              )
              
              yPosition += finalHeight + 5
            } catch (error) {
              console.error('Error al agregar mapa al PDF:', error)
            }
            resolve()
          }
          img.onerror = () => resolve()
          setTimeout(() => resolve(), 2000) // Timeout de seguridad
        })
      } else {
        // Si no se puede generar el mapa, mostrar información de los puntos
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        pdf.text(`Ruta con ${allGPSPoints.length} puntos GPS registrados`, margin, yPosition)
        yPosition += 5
      }
    } catch (error) {
      console.error('Error al generar mapa para PDF:', error)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Ruta con ${allGPSPoints.length} puntos GPS registrados`, margin, yPosition)
      yPosition += 5
    }
  }

  // ===== ESTADÍSTICAS =====
  if (log.statistics) {
    if (yPosition > pageHeight - 50) {
      pdf.addPage()
      yPosition = 20
    }

    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text('ESTADÍSTICAS', margin, yPosition)
    yPosition += 8

    const statsData: Array<[string, string]> = []
    if (log.statistics.totalDistance) {
      statsData.push(['Distancia Total', `${(log.statistics.totalDistance / 1000).toFixed(2)} km`])
    }
    if (log.statistics.totalElevationGain) {
      statsData.push(['Elevación Ganada', `${log.statistics.totalElevationGain.toFixed(0)} m`])
    }
    if (log.statistics.totalElevationLoss) {
      statsData.push(['Elevación Perdida', `${log.statistics.totalElevationLoss.toFixed(0)} m`])
    }
    if (log.statistics.maxElevation) {
      statsData.push(['Elevación Máxima', `${log.statistics.maxElevation.toFixed(0)} m`])
    }
    if (log.statistics.minElevation) {
      statsData.push(['Elevación Mínima', `${log.statistics.minElevation.toFixed(0)} m`])
    }
    if (log.statistics.maxSpeed) {
      statsData.push(['Velocidad Máxima', `${(log.statistics.maxSpeed * 3.6).toFixed(1)} km/h`])
    }
    if (log.statistics.totalDuration) {
      const hours = Math.floor(log.statistics.totalDuration / 3600)
      const minutes = Math.floor((log.statistics.totalDuration % 3600) / 60)
      statsData.push(['Duración Total', `${hours}h ${minutes}m`])
    }

    if (statsData.length > 0) {
      autoTable(pdf, {
        head: [['Métrica', 'Valor']],
        body: statsData,
        startY: yPosition,
        margin: { left: margin, right: margin },
        styles: { fontSize: 10 },
        headStyles: { fillColor: [66, 139, 202] },
      })
      yPosition = (pdf as any).lastAutoTable.finalY + 10
    }
  }

  // ===== FOOTER =====
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'italic')
    pdf.text(
      `Generado el ${new Date().toLocaleDateString('es-ES')} por criterIA - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Generar PDF como ArrayBuffer
  const pdfArrayBuffer = pdf.output('arraybuffer')
  
  // Cargar el PDF con pdf-lib para establecer metadatos correctamente
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer)
  
  // Establecer metadatos usando pdf-lib (esto asegura que se guarden correctamente)
  pdfDoc.setTitle(log.title || 'Bitácora de Montañismo')
  pdfDoc.setAuthor(authorName || log.relatedAccount || 'criterIA')
  
  // Agregar información de la cuenta Substrate en el Subject (para metadatos X.509)
  const subjectParts = ['Bitácora de Montañismo']
  if (log.relatedAccount) {
    subjectParts.push(`Substrate Account: ${log.relatedAccount}`)
  }
  // Subject: incluir EXIF/cámara, GPS y resumen para que aparezca en Propiedades del documento
  const exifAgg = aggregateExifFromMountainLog(log)
  let subjectStr = subjectParts.join(' | ')
  if (exifAgg?.subjectText) {
    subjectStr += ` | ${exifAgg.subjectText}`
  }
  // Resumen de contenido: fotos y milestones (visible en Propiedades del documento)
  const totalImages = (log.milestones || []).reduce((n, m) => n + (m.images?.length || 0), 0) + (log.images?.length || 0)
  if (totalImages > 0) {
    subjectStr += ` | ${totalImages} foto(s)`
  }
  if (log.startLocation) {
    subjectStr += ` | GPS inicio: ${log.startLocation.latitude.toFixed(4)}, ${log.startLocation.longitude.toFixed(4)}`
  }
  pdfDoc.setSubject(subjectStr)
  
  pdfDoc.setCreator('criterIA')
  pdfDoc.setProducer('CriterIA PDF')
  
  // Agregar keywords incluyendo información de la cuenta Substrate y EXIF/cámara
  const keywords = [
    'montañismo',
    'bitácora',
    'expedición',
    log.mountainName || '',
    log.location || '',
  ]
  if (log.relatedAccount) {
    keywords.push(`SubstrateAccount:${log.relatedAccount}`)
  }
  if (exifAgg?.keywordsText?.length) {
    keywords.push(...exifAgg.keywordsText)
  }
  if (log.startLocation?.altitude != null) {
    keywords.push(`AltitudInicio:${Math.round(log.startLocation.altitude)}m`)
  }
  pdfDoc.setKeywords(keywords.filter(Boolean))
  
  // Establecer fecha de creación
  pdfDoc.setCreationDate(new Date())
  pdfDoc.setModificationDate(new Date())

  // Guardar PDF modificado con metadatos
  const modifiedPdfBytes = await pdfDoc.save()
  const pdfSize = modifiedPdfBytes.length

  // Convertir Uint8Array a base64
  const pdfBase64 = uint8ArrayToBase64(modifiedPdfBytes)

  // Calcular hash
  const pdfHash = await calculatePDFHash(modifiedPdfBytes)

  return {
    pdfBase64,
    pdfHash,
    pdfSize,
  }
}

/**
 * Convierte Uint8Array a base64
 */
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return btoa(binary)
}
