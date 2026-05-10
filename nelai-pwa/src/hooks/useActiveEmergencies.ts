/**
 * Hook para obtener emergencias activas del usuario
 */

import { useState, useEffect } from 'react'
import { getAllEmergencies } from '@/utils/emergencyStorage'
import type { Emergency } from '@/types/emergencies'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'

export function useActiveEmergencies() {
  const { activeAccount } = useActiveAccount()
  const [activeEmergencies, setActiveEmergencies] = useState<Emergency[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadActiveEmergencies = async () => {
      try {
        setIsLoading(true)
        const allEmergencies = await getAllEmergencies()

        // Filtrar emergencias activas (no resueltas ni canceladas)
        const active = allEmergencies.filter(e => 
          e.status !== 'resolved' && 
          e.status !== 'cancelled' &&
          // Si hay cuenta activa, filtrar por cuenta
          (!activeAccount || e.accountAddress === activeAccount)
        )

        // Ordenar por severidad y fecha (críticas primero, luego por fecha)
        active.sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
          const severityDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4)
          if (severityDiff !== 0) return severityDiff
          return b.createdAt - a.createdAt
        })

        setActiveEmergencies(active)
      } catch (error) {
        console.error('[useActiveEmergencies] Error al cargar emergencias activas:', error)
        setActiveEmergencies([])
      } finally {
        setIsLoading(false)
      }
    }

    loadActiveEmergencies()
  }, [activeAccount])

  return { activeEmergencies, isLoading }
}
