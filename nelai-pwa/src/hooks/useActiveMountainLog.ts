/**
 * Hook para obtener la bitácora activa del usuario
 */

import { useState, useEffect } from 'react'
import { getMountainLogsByStatus, getMountainLogsByAccount } from '@/utils/mountainLogStorage'
import type { MountainLog } from '@/types/mountainLogs'
import { useActiveAccount } from '@/contexts/ActiveAccountContext'

export function useActiveMountainLog() {
  const { activeAccount } = useActiveAccount()
  const [activeLog, setActiveLog] = useState<MountainLog | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadActiveLog = async () => {
      try {
        setIsLoading(true)
        let logs: MountainLog[] = []

        // Si hay cuenta activa, buscar solo en sus bitácoras
        if (activeAccount) {
          logs = await getMountainLogsByAccount(activeAccount)
        } else {
          // Si no hay cuenta activa, buscar en todas
          logs = await getMountainLogsByStatus('active')
        }

        // Filtrar solo las activas
        const activeLogs = logs.filter(log => log.status === 'active')
        
        // Si hay cuenta activa, priorizar las de esa cuenta
        if (activeAccount && activeLogs.length > 0) {
          const accountLogs = activeLogs.filter(log => log.relatedAccount === activeAccount)
          setActiveLog(accountLogs.length > 0 ? accountLogs[0] : activeLogs[0])
        } else {
          setActiveLog(activeLogs.length > 0 ? activeLogs[0] : null)
        }
      } catch (error) {
        console.error('[useActiveMountainLog] Error al cargar bitácora activa:', error)
        setActiveLog(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadActiveLog()
  }, [activeAccount])

  return { activeLog, isLoading }
}
