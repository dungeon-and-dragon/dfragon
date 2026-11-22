import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

export function useRouteReload(routeId: string, needed: boolean): void {
  const router = useRouter()

  useEffect(() => {
    if (needed) {
      router.invalidate({ filter: (match) => match.routeId === routeId })
    }
  }, [router, routeId, needed])
}
