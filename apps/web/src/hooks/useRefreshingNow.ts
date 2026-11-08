import { useEffect, useState } from 'react'
import { getElapsedTimeRefreshDelay } from '#core/lib/time-format'

export function useRefreshingNow(at: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), getElapsedTimeRefreshDelay(now - at))

    return () => window.clearTimeout(timer)
  }, [at, now])

  return now
}
