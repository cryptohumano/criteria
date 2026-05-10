/**
 * Hook para obtener bitácoras recientes del usuario
 */

import { useState, useEffect } from 'react'
import { getAllMountainLogs, getMountainLogsByAccount } from '@/utils/mountainLogStorage'
import type { MountainLog } from '@/types/mountainLogs'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'

export function useRecentMountainLogs(limit: number = 5) {
  const { activeAccount } = useActiveAccount()
  const [recentLogs, setRecentLogs] = useState<MountainLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadRecentLogs = async () => {
      try {
        setIsLoading(true)
        let logs: MountainLog[] = []

        // Si hay cuenta activa, buscar solo en sus bitácoras
        if (activeAccount) {
          logs = await getMountainLogsByAccount(activeAccount)
        } else {
          // Si no hay cuenta activa, buscar en todas
          logs = await getAllMountainLogs()
        }

        // Ordenar por fecha de creación (más recientes primero) y limitar
        logs.sort((a, b) => b.createdAt - a.createdAt)
        setRecentLogs(logs.slice(0, limit))
      } catch (error) {
        console.error('[useRecentMountainLogs] Error al cargar bitácoras recientes:', error)
        setRecentLogs([])
      } finally {
        setIsLoading(false)
      }
    }

    loadRecentLogs()
  }, [activeAccount, limit])

  return { recentLogs, isLoading }
}
