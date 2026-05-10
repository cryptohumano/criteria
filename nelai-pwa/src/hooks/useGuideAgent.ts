import { useState, useCallback } from 'react'
import {
  GUIDE_AGENT_CONFIG,
  isGuideDismissed,
  setGuideDismissed,
  type GuideActionType,
} from '@/config/guideAgent'

export function useGuideAgent(actionType: GuideActionType) {
  const [showModal, setShowModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const shouldShowGuide = useCallback((): boolean => {
    return (
      GUIDE_AGENT_CONFIG.enabled &&
      GUIDE_AGENT_CONFIG.enabledActions.includes(actionType) &&
      !isGuideDismissed(actionType)
    )
  }, [actionType])

  const triggerGuide = useCallback(
    (onAcknowledged: () => void) => {
      if (!shouldShowGuide()) {
        onAcknowledged()
        return
      }
      setPendingAction(() => onAcknowledged)
      setShowModal(true)
    },
    [shouldShowGuide]
  )

  const acknowledge = useCallback(() => {
    setGuideDismissed(actionType)
    setShowModal(false)
    const action = pendingAction
    setPendingAction(null)
    action?.()
  }, [actionType, pendingAction])

  return {
    showModal,
    setShowModal,
    triggerGuide,
    acknowledge,
    shouldShowGuide,
  }
}
