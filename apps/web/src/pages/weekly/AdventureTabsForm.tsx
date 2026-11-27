import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AdventureNameForm } from '#features/adventure-search'
import { useRefreshAdventureActivity } from './api/useAdventureActivity'
import { useRefreshAdventureEquipment } from './api/useAdventureEquipment'
import { useRefreshAdventureWeekly } from './api/useAdventureWeekly'

export function AdventureTabsForm({
  adventureName,
  onAdventureOpen
}: {
  adventureName: string
  onAdventureOpen: (adventureName: string) => void
}): React.JSX.Element {
  const refreshActivity = useRefreshAdventureActivity()
  const refreshWeekly = useRefreshAdventureWeekly()
  const refreshEquipment = useRefreshAdventureEquipment()
  const [refreshing, setRefreshing] = useState(false)
  const { refreshedAt, markRefreshed } = useRefreshedAt(adventureName)
  const coolingDown = useCoolingDown(refreshedAt)

  async function handleRefresh(): Promise<void> {
    markRefreshed(Date.now())
    setRefreshing(true)
    await Promise.all([
      refreshActivity(adventureName),
      refreshWeekly(adventureName),
      refreshEquipment(adventureName)
    ])
    setRefreshing(false)
  }

  return (
    <AdventureNameForm
      initialName={adventureName}
      onAdventureOpen={onAdventureOpen}
      refreshing={refreshing}
      refreshDisabled={coolingDown}
      onRefresh={handleRefresh}
      className="px-4 py-2 max-sm:w-full max-sm:border-t max-sm:border-line"
    />
  )
}

const REFRESH_COOLDOWN_MS = 5 * 60_000

function refreshedAtKey(adventureName: string) {
  return ['adventure', adventureName, 'refreshed-at'] as const
}

// 탭을 옮기면 버튼이 다시 그려지므로, 마지막으로 누른 시각을 모험단별로 query 캐시에 둔다.
function useRefreshedAt(adventureName: string): {
  refreshedAt: number | null | undefined
  markRefreshed: (at: number) => void
} {
  const queryClient = useQueryClient()
  const key = refreshedAtKey(adventureName)
  const { data } = useQuery<number | null>({
    queryKey: key,
    queryFn: () => null,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY
  })

  function markRefreshed(at: number): void {
    queryClient.setQueryData(key, at)
  }

  return { refreshedAt: data, markRefreshed }
}

function useCoolingDown(refreshedAt: number | null | undefined): boolean {
  const [cooledAt, setCooledAt] = useState<number>()

  useEffect(() => {
    if (refreshedAt == null) {
      return
    }

    const timer = window.setTimeout(
      () => setCooledAt(refreshedAt),
      refreshedAt + REFRESH_COOLDOWN_MS - Date.now()
    )

    return () => window.clearTimeout(timer)
  }, [refreshedAt])

  return refreshedAt != null && cooledAt !== refreshedAt
}
