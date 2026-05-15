'use client'

import { useEffect, useEffectEvent } from 'react'

export function useAutoRefresh(refresh: () => Promise<void> | void, intervalMs = 8000) {
  const runRefresh = useEffectEvent(() => {
    void refresh()
  })

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      runRefresh()
    }, intervalMs)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runRefresh()
      }
    }

    const handleFocus = () => {
      runRefresh()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [intervalMs])
}
